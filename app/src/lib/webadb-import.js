// Experimental, browser-only ADB import via WebUSB (Tango ADB).
// No server, no network calls, no telemetry, no APK patching, no privilege bypass.
// This module never saves settings: callers fill the existing draft fields only.

const EYECON_PACKAGE = 'com.eyecon.global';
const TRUECALLER_PACKAGE = 'com.truecaller';

let librariesPromise = null;

/** Load the browser-safe Tango packages once, ahead of the user's click. */
export function preloadUsbLibraries() {
  if (!librariesPromise) {
    librariesPromise = Promise.all([
      import('@yume-chan/adb'),
      import('@yume-chan/adb-daemon-webusb'),
      import('@yume-chan/adb-credential-web'),
    ]).then(([adb, webusb, credential]) => ({
      Adb: adb.Adb,
      AdbDaemonTransport: adb.AdbDaemonTransport,
      AdbDaemonWebUsbDeviceManager: webusb.AdbDaemonWebUsbDeviceManager,
      AdbWebCredentialStore: credential.default,
    }));
  }
  return librariesPromise;
}

/** Synchronous gate, safe to call while rendering the client-only Settings dialog. */
export function isWebUsbAvailable() {
  return typeof navigator !== 'undefined' && Boolean(navigator.usb);
}

export class UsbImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'UsbImportError';
    this.code = code;
  }
}

// Mirrors authChecksum() in src/lib/providers/eyecon.js exactly.
export function computeCidChecksum(cid) {
  let total = 0;
  for (const part of String(cid ?? '').split('-')) {
    if (!part) continue;
    const char = part[0];
    if (/[0-9]/.test(char)) total += Number(char);
    else if (/[a-f]/i.test(char)) total += 10 + char.toLowerCase().charCodeAt(0) - 97;
  }
  return String(total);
}

function text(value) {
  return String(value ?? '').replace(/\r/g, '').trim();
}

function looksNotDebuggable(value) {
  return /not debuggable/i.test(value);
}

function fail(code, message) {
  throw new UsbImportError(code, message);
}

// ---------------------------------------------------------------------------
// Connection (must be started directly from a click so WebUSB keeps activation)
// ---------------------------------------------------------------------------

async function closeUsbDevice(device) {
  try {
    await device?.raw?.close?.();
  } catch {
    // Device was already disconnected or the interface was released by transport.close().
  }
}

export async function connectUsbDevice() {
  if (!isWebUsbAvailable()) {
    fail(
      'WEBUSB_UNSUPPORTED',
      'This browser does not expose WebUSB. Use Chrome/Edge over HTTPS or localhost, or use the local Python helper.',
    );
  }

  const libs = await preloadUsbLibraries();
  const manager = libs.AdbDaemonWebUsbDeviceManager.BROWSER;
  if (!manager) {
    fail('WEBUSB_UNSUPPORTED', 'WebUSB is unavailable (insecure context or unsupported browser). Use the local Python helper.');
  }

  let device;
  try {
    device = await manager.requestDevice();
  } catch (error) {
    if (String(error?.name || '') === 'NotFoundError') {
      fail('NO_USB_DEVICE', 'No device was selected in the browser picker.');
    }
    throw error;
  }
  if (!device) fail('NO_USB_DEVICE', 'No device was selected in the browser picker.');

  let connection;
  try {
    connection = await device.connect();
  } catch (error) {
    // connect() opens the device and claims the interface before transferring packets.
    await closeUsbDevice(device);
    const message = String(error?.message || error || '');
    if (
      error?.constructor?.name === 'DeviceBusyError' ||
      /busy|claim.?interface|access denied|not supported|permission|already in used/i.test(message)
    ) {
      fail(
        'USB_DRIVER_BUSY',
        'The ADB USB interface is already claimed, commonly by Google ADB or a Windows driver. Close other ADB tools; on Windows you may need a WinUSB driver (Zadig).',
      );
    }
    throw error;
  }

  let transport;
  try {
    transport = await libs.AdbDaemonTransport.authenticate({
      serial: device.serial,
      connection,
      credentialStore: new libs.AdbWebCredentialStore('Caller ID Lookup'),
    });
  } catch (error) {
    // Tango keeps `connection` open on authenticate failure, so release the interface here.
    await closeUsbDevice(device);
    const message = String(error?.message || error || '');
    if (/unauthor|confirm|timeout|timed out/i.test(message)) {
      fail(
        'ADB_UNAUTHORIZED',
        'The phone has not authorized this computer. Unlock the phone and accept "Allow USB debugging?", then retry the connection.',
      );
    }
    throw error;
  }

  return {
    adb: new libs.Adb(transport),
    transport,
    connection,
    device,
    // AdbDaemonWebUsbDevice.name is raw.productName; USBDevice has no `product` field.
    label: device.name || device.serial || 'USB device',
  };
}

export async function disconnectUsbSession(session) {
  if (!session) return;
  // Adb.close() calls transport.close(); with the default preserveConnection=false that
  // closes the WebUSB stream, which in turn calls raw.close() and releases the interface.
  try {
    await session.adb?.close?.();
  } catch {
    try {
      await session.transport?.close?.();
    } catch {
      // Already closed.
    }
  }
  await closeUsbDevice(session.device);
}

// ---------------------------------------------------------------------------
// Minimal shell helpers
// ---------------------------------------------------------------------------

async function runText(adb, command) {
  const shell = adb.subprocess.shellProtocol;
  if (shell) {
    const result = await shell.spawnWaitText(command);
    return { stdout: text(result.stdout), stderr: text(result.stderr), exitCode: result.exitCode };
  }
  return { stdout: text(await adb.subprocess.noneProtocol.spawnWaitText(command)), stderr: '', exitCode: 0 };
}

async function runBytes(adb, command) {
  const shell = adb.subprocess.shellProtocol;
  if (shell) return (await shell.spawnWait(command)).stdout;
  return adb.subprocess.noneProtocol.spawnWait(command);
}

async function assertInstalled(adb, packageName, code, label) {
  const result = await runText(adb, ['pm', 'path', packageName]);
  if (!result.stdout.startsWith('package:')) {
    fail(code, `${label} is not installed on this device.`);
  }
}

// ---------------------------------------------------------------------------
// Tiny SQLite reader for Android's shared_preference_v2 table.
// Reads the file bytes already pulled over ADB; never scans raw bytes for a CID.
// ---------------------------------------------------------------------------

function readVarint(buffer, offset) {
  let value = 0;
  for (let index = 0; index < 9; index += 1) {
    const byte = buffer[offset + index];
    if (byte === undefined) throw new Error('Truncated SQLite varint');
    if (index === 8) return { value: value * 256 + byte, offset: offset + 9 };
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, offset: offset + index + 1 };
  }
  throw new Error('Invalid SQLite varint');
}

function readU16(buffer, offset) {
  return buffer[offset] * 256 + buffer[offset + 1];
}

function readU32(buffer, offset) {
  return buffer[offset] * 0x1000000 + buffer[offset + 1] * 0x10000 + buffer[offset + 2] * 256 + buffer[offset + 3];
}

function decodeRecord(payload) {
  const header = readVarint(payload, 0);
  const headerSize = header.value;
  const serials = [];
  let cursor = header.offset;
  while (cursor < headerSize) {
    const item = readVarint(payload, cursor);
    serials.push(item.value);
    cursor = item.offset;
  }

  let offset = headerSize;
  const decoder = new TextDecoder('utf-8');
  return serials.map((serial) => {
    if (serial === 0) return null;
    if (serial >= 1 && serial <= 6) {
      const width = [0, 1, 2, 3, 4, 6, 8][serial];
      let value = 0;
      for (let index = 0; index < width; index += 1) value = value * 256 + payload[offset + index];
      offset += width;
      return value;
    }
    if (serial === 7) {
      offset += 8;
      return null;
    }
    if (serial === 8) return 0;
    if (serial === 9) return 1;
    if (serial >= 12) {
      const length = Math.floor((serial - 12) / 2);
      const bytes = payload.subarray(offset, offset + length);
      offset += length;
      return serial % 2 === 0 ? bytes : decoder.decode(bytes);
    }
    return null;
  });
}

function readCellPayload(buffer, cellOffset, pageSize) {
  let cursor = cellOffset;
  const payloadInfo = readVarint(buffer, cursor);
  cursor = payloadInfo.offset;
  cursor = readVarint(buffer, cursor).offset; // rowid, unused
  const total = payloadInfo.value;
  const maxLocal = pageSize - 35;
  const minLocal = Math.floor(((pageSize - 12) * 32) / 255) - 23;
  let local = total;
  if (total > maxLocal) {
    local = minLocal + ((total - minLocal) % (pageSize - 4));
    if (local > maxLocal) local = minLocal;
  }

  const pieces = [buffer.subarray(cursor, cursor + local)];
  let remaining = total - local;
  let overflow = readU32(buffer, cursor + local);
  while (remaining > 0 && overflow > 0) {
    const base = (overflow - 1) * pageSize;
    const chunk = Math.min(remaining, pageSize - 4);
    pieces.push(buffer.subarray(base + 4, base + 4 + chunk));
    remaining -= chunk;
    overflow = readU32(buffer, base);
  }
  if (remaining > 0) throw new Error('Truncated SQLite overflow chain');
  const merged = new Uint8Array(total);
  let written = 0;
  for (const piece of pieces) {
    merged.set(piece, written);
    written += piece.length;
  }
  return merged;
}

function walkTable(buffer, pageNumber, pageSize, visit, depth = 0) {
  if (depth > 32 || pageNumber < 1) throw new Error('Invalid SQLite page tree');
  const base = (pageNumber - 1) * pageSize;
  const headerOffset = pageNumber === 1 ? 100 : 0;
  const pageType = buffer[base + headerOffset];
  const cellCount = readU16(buffer, base + headerOffset + 3);
  const rightChild = readU32(buffer, base + headerOffset + 8);

  if (pageType === 0x05) {
    // Interior table pages store the right-child pointer at +8, then
    // (left child, rowid) cell pointers from +12. Leaf pages use +8 directly.
    const pointerBase = base + headerOffset + 12;
    for (let index = 0; index < cellCount; index += 1) {
      const cell = readU16(buffer, pointerBase + index * 2);
      walkTable(buffer, readU32(buffer, base + cell), pageSize, visit, depth + 1);
    }
    walkTable(buffer, rightChild, pageSize, visit, depth + 1);
    return;
  }
  if (pageType !== 0x0d) throw new Error('Unsupported SQLite page type');

  const pointerBase = base + headerOffset + 8;
  for (let index = 0; index < cellCount; index += 1) {
    const cell = readU16(buffer, pointerBase + index * 2);
    visit(decodeRecord(readCellPayload(buffer, base + cell, pageSize)));
  }
}

function sqliteClientId(bytes) {
  const magic = new TextDecoder('ascii').decode(bytes.subarray(0, 16));
  if (magic !== 'SQLite format 3\u0000') {
    fail('EYECON_PARSE_FAILED', 'The pulled file is not a SQLite database. No raw byte scanning was attempted.');
  }
  const pageSizeRaw = readU16(bytes, 16);
  const pageSize = pageSizeRaw === 1 ? 65536 : pageSizeRaw;
  if (pageSize < 512) fail('EYECON_PARSE_FAILED', 'Invalid SQLite page size.');

  let rootPage = null;
  walkTable(bytes, 1, pageSize, (row) => {
    if (row[1] === 'shared_preference_v2' && row[0] === 'table') rootPage = Number(row[3]);
  });
  if (!rootPage) fail('EYECON_PARSE_FAILED', 'Table shared_preference_v2 was not found in contactdb.');

  const parts = [];
  walkTable(bytes, rootPage, pageSize, (row) => {
    if (row[0] === 'clientId') {
      parts.push({ part: Number(row[2] ?? 0), data: String(row[3] ?? '') });
    }
  });
  if (!parts.length) {
    fail('EYECON_PARSE_FAILED', "No row with key='clientId' in shared_preference_v2. Finish Eyecon registration first.");
  }
  parts.sort((a, b) => a.part - b.part);
  const cid = parts.map((item) => item.data).join('').trim();
  if (!cid) fail('EYECON_PARSE_FAILED', "The 'clientId' value is empty.");
  return cid;
}

// ---------------------------------------------------------------------------
// Provider reads
// ---------------------------------------------------------------------------

export async function readEyeconViaUsb(adb) {
  await assertInstalled(adb, EYECON_PACKAGE, 'EYECON_NOT_INSTALLED', 'Eyecon');

  const listing = await runText(adb, ['run-as', EYECON_PACKAGE, 'ls', 'databases/contactdb*']);
  const combined = `${listing.stdout}\n${listing.stderr}`;
  if (looksNotDebuggable(combined)) {
    fail(
      'EYECON_NOT_DEBUGGABLE',
      'Eyecon is not debuggable on this stock phone. Use your own debuggable build or the local Python helper; registration must already be complete.',
    );
  }
  const entries = combined.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!entries.some((entry) => /(^|\/)contactdb$/.test(entry))) {
    fail('EYECON_DB_NOT_FOUND', 'databases/contactdb was not readable via run-as. Finish registration and retry.');
  }
  if (entries.some((entry) => /(^|\/)contactdb-wal$/.test(entry))) {
    const wal = await runBytes(adb, ['run-as', EYECON_PACKAGE, 'cat', 'databases/contactdb-wal']);
    if (wal.length > 32) {
      fail(
        'EYECON_DB_LOCKED',
        'The database has an active write-ahead log. Close the Eyecon app completely, then retry.',
      );
    }
  }

  const bytes = await runBytes(adb, ['run-as', EYECON_PACKAGE, 'cat', 'databases/contactdb']);
  if (!bytes.length) fail('EYECON_DB_NOT_FOUND', 'databases/contactdb was empty via run-as.');
  const cid = sqliteClientId(bytes);
  return { cid, checksum: computeCidChecksum(cid) };
}

function readPreference(xml, name) {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const element = [...doc.getElementsByTagName('string')].find((node) => node.getAttribute('name') === name);
    if (element) return text(element.textContent);
  }
  const match = xml.match(new RegExp(`<string\\s+name="${name}"[^>]*>([\\s\\S]*?)<\\/string>`));
  return match ? text(match[1]) : '';
}

export async function readTrueCallerViaUsb(adb) {
  await assertInstalled(adb, TRUECALLER_PACKAGE, 'TRUECALLER_NOT_INSTALLED', 'TrueCaller');

  const result = await runText(adb, ['run-as', TRUECALLER_PACKAGE, 'cat', 'shared_prefs/account.xml']);
  const combined = `${result.stdout}\n${result.stderr}`;
  if (looksNotDebuggable(combined)) {
    fail(
      'TRUECALLER_NOT_DEBUGGABLE',
      'not exportable on a stock phone: TrueCaller is not debuggable. Paste your own installationId or use the local Python helper.',
    );
  }
  if (!/<map[\s>]/.test(combined) && !/<\?xml/.test(combined)) {
    fail(
      'TRUECALLER_NOT_DEBUGGABLE',
      'account.xml could not be read via run-as. Stock phones cannot export this value; paste it manually or use the local Python helper.',
    );
  }

  const installationId = readPreference(combined, 'installationId');
  if (!installationId) {
    fail('TRUECALLER_PARSE_FAILED', 'No installationId was found in account.xml.');
  }

  const fetchTime = Number(String(combined.match(/name="installationIdFetchTime"\s+value="(\d+)"/)?.[1] ?? ''));
  let expiry = '';
  if (Number.isFinite(fetchTime) && fetchTime > 0) {
    const ttlMatch = combined.match(/name="installationIdTtl"\s+value="(\d+)"/);
    const ttl = Number(ttlMatch?.[1] ?? 72 * 60 * 60 * 1000);
    const stamp = new Date(fetchTime + (Number.isFinite(ttl) ? ttl : 72 * 60 * 60 * 1000));
    if (!Number.isNaN(stamp.valueOf())) expiry = stamp.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return { installationId, expiry };
}

// ---------------------------------------------------------------------------
// Failure copy for the inline status list (no proxy or request noise)
// ---------------------------------------------------------------------------

export function describeUsbError(error) {
  if (error?.code) return `${error.code}: ${error.message}`;
  const message = String(error?.message || error || 'Unknown error');
  const lower = message.toLowerCase();
  if (lower.includes('notfounderror') || lower.includes('no device selected')) {
    return 'NO_USB_DEVICE: No device was selected. Pick your phone in the browser dialog and retry.';
  }
  if (lower.includes('busy') || lower.includes('claim') || lower.includes('access denied')) {
    return 'USB_DRIVER_BUSY: Another tool owns the ADB interface. Close other ADB tools; on Windows install a WinUSB driver, then retry.';
  }
  if (lower.includes('unauthor')) {
    return 'ADB_UNAUTHORIZED: Unlock the phone and accept the "Allow USB debugging?" prompt, then retry.';
  }
  if (lower.includes('networkerror') || lower.includes('disconnect')) {
    return 'USB_DISCONNECTED: The device went away. Reconnect the cable and retry the connection.';
  }
  return `USB_IMPORT_FAILED: ${message}`;
}

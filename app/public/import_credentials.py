#!/usr/bin/env python3
"""Local-only helper for reading your own Android app credentials over ADB.

Runs entirely on this machine: no network requests, no uploads, no telemetry, no
clipboard access, no APK patching, no bundled credentials, and no attempts to
bypass app protections. It can only read what ADB already lets you read on a
device you control.

Ground truth: a stock, non-rooted, non-debuggable phone cannot expose either
value. Eyecon needs a debuggable rebuild (run-as) or root. TrueCaller needs a
debuggable rebuild or an explicit --truecaller-root opt-in on your own device.
"""

import argparse
import datetime
import pathlib
import sqlite3
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

EYECON_PACKAGE = 'com.eyecon.global'
TRUECALLER_PACKAGE = 'com.truecaller'
CONTACTDB = 'databases/contactdb'
CONTACTDB_WAL = 'databases/contactdb-wal'
TRUECALLER_ACCOUNT = '/data/data/com.truecaller/shared_prefs/account.xml'
SQLITE_HEADER = b'SQLite format 3\x00'
DEFAULT_TTL_MS = 72 * 60 * 60 * 1000  # documented local TTL; server enforcement unconfirmed

# Preference keys confirmed in truecaller_research/AUTH_AND_TESTING_FINDINGS.md section 8.
TC_FETCH_TIME_KEY = 'installationIdFetchTime'
TC_TTL_KEY = 'installationIdTtl'


class HelperFailure(Exception):
    """A failure with one of the documented machine-readable codes."""

    def __init__(self, code, detail):
        super().__init__(detail)
        self.code = code
        self.detail = detail


def decode(data):
    if data is None:
        return ''
    if isinstance(data, bytes):
        return data.decode('utf-8', 'replace')
    return str(data)


def combined_output(completed):
    out = completed.stdout if isinstance(completed.stdout, bytes) else (completed.stdout or b'')
    err = completed.stderr if isinstance(completed.stderr, bytes) else (completed.stderr or b'')
    return decode(out + b'\n' + err)


def run_adb(adb, args, timeout=30):
    try:
        return subprocess.run(
            [adb, *args],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError:
        raise HelperFailure(
            'ADB_NOT_FOUND',
            f'adb executable not found: {adb!r}. Install Android SDK Platform Tools or pass --adb PATH.',
        )
    except subprocess.TimeoutExpired:
        raise HelperFailure('NO_DEVICE', 'adb command timed out; check the cable and device state.')
    except OSError as exc:
        raise HelperFailure('ADB_NOT_FOUND', f'could not start adb {adb!r}: {exc}')


def device_args(serial, *parts):
    return ['-s', serial, *parts]


def resolve_device(adb, requested_serial):
    entries = []
    for line in decode(run_adb(adb, ['devices']).stdout).splitlines()[1:]:
        fields = line.split()
        if len(fields) >= 2:
            entries.append((fields[0], fields[1]))

    if requested_serial:
        for serial, state in entries:
            if serial != requested_serial:
                continue
            if state == 'device':
                return serial
            if state == 'unauthorized':
                raise HelperFailure(
                    'UNAUTHORIZED',
                    f'{serial} is unauthorized. Unlock the phone and accept the RSA debugging prompt.',
                )
            raise HelperFailure('NO_DEVICE', f'{serial} is {state!r}, not ready for adb commands.')
        raise HelperFailure('NO_DEVICE', f'Serial {requested_serial!r} was not listed by adb devices.')

    ready = [serial for serial, state in entries if state == 'device']
    if len(ready) > 1:
        raise HelperFailure(
            'MULTIPLE_DEVICES',
            'Several devices are connected: ' + ', '.join(ready) + '. Re-run with --serial <serial>.',
        )
    if len(ready) == 1:
        return ready[0]
    unauthorized = [serial for serial, state in entries if state == 'unauthorized']
    if unauthorized:
        raise HelperFailure(
            'UNAUTHORIZED',
            'Device is unauthorized: ' + ', '.join(unauthorized)
            + '. Unlock the phone and accept the RSA debugging prompt.',
        )
    raise HelperFailure('NO_DEVICE', 'No connected device was listed by adb devices. Enable USB debugging and check the cable.')


def package_installed(adb, serial, package):
    completed = run_adb(adb, device_args(serial, 'shell', 'pm', 'path', package))
    return decode(completed.stdout).strip().startswith('package:')


def looks_not_debuggable(text):
    lowered = text.lower()
    return 'not debuggable' in lowered or ('run-as' in lowered and 'debuggable' in lowered)


# Mirrors authChecksum() in app/src/lib/providers/eyecon.js exactly:
# sum of Character.getNumericValue(first char) per hyphen-separated segment.
def auth_checksum(cid):
    total = 0
    for part in str(cid or '').split('-'):
        if not part:
            continue
        char = part[0]
        if '0' <= char <= '9':
            total += int(char)
        elif 'a' <= char.lower() <= 'f':
            total += 10 + ord(char.lower()) - ord('a')
    return str(total)


def eyecon_has_wal(adb, serial):
    completed = run_adb(
        adb,
        device_args(serial, 'shell', 'run-as', EYECON_PACKAGE, 'ls', 'databases/contactdb*'),
    )
    text = combined_output(completed)
    if looks_not_debuggable(text):
        raise HelperFailure(
            'EYECON_NOT_DEBUGGABLE',
            'com.eyecon.global is not debuggable. Use your own debuggable rebuild or a rooted device; registration must already be complete.',
        )
    entries = [line.strip().replace('\\', '/') for line in decode(completed.stdout).splitlines()]
    has_db = any(entry == 'contactdb' or entry.endswith('/contactdb') for entry in entries)
    has_wal = any(entry.endswith('/contactdb-wal') for entry in entries)
    if not has_db:
        raise HelperFailure(
            'EYECON_DB_NOT_FOUND',
            'databases/contactdb was not readable via run-as. ' + (text.strip() or 'No such file or directory'),
        )
    return has_wal


def remote_bytes(adb, serial, package, remote_path):
    # exec-out avoids line-ending translation, so SQLite bytes stay intact.
    completed = run_adb(adb, device_args(serial, 'exec-out', 'run-as', package, 'cat', remote_path))
    return completed.stdout or b''


def read_eyecon_inner(adb, serial):
    if not package_installed(adb, serial, EYECON_PACKAGE):
        raise HelperFailure('EYECON_NOT_INSTALLED', f'{EYECON_PACKAGE} is not installed on this device.')

    has_wal = eyecon_has_wal(adb, serial)

    temp_dir = pathlib.Path(tempfile.mkdtemp(prefix='callerid-import-'))
    db_path = temp_dir / 'contactdb'
    wal_path = temp_dir / 'contactdb-wal'
    try:
        db_bytes = remote_bytes(adb, serial, EYECON_PACKAGE, CONTACTDB)
        if not db_bytes:
            raise HelperFailure('EYECON_DB_NOT_FOUND', 'databases/contactdb was empty via run-as.')
        if not db_bytes.startswith(SQLITE_HEADER):
            raise HelperFailure(
                'EYECON_PARSE_FAILED',
                'pulled contactdb is not a SQLite database. No raw byte scanning was attempted.',
            )
        db_path.write_bytes(db_bytes)

        if has_wal:
            wal_bytes = remote_bytes(adb, serial, EYECON_PACKAGE, CONTACTDB_WAL)
            if wal_bytes:
                wal_path.write_bytes(wal_bytes)

        try:
            connection = sqlite3.connect(str(db_path))
            try:
                row = connection.execute(
                    "SELECT data FROM shared_preference_v2 WHERE key='clientId'"
                ).fetchone()
            finally:
                connection.close()
        except sqlite3.DatabaseError as exc:
            lowered = str(exc).lower()
            if 'locked' in lowered or 'busy' in lowered:
                raise HelperFailure('EYECON_DB_LOCKED', f'contactdb is locked: {exc}')
            raise HelperFailure('EYECON_PARSE_FAILED', f'could not query shared_preference_v2: {exc}')

        if not row or row[0] is None:
            raise HelperFailure(
                'EYECON_PARSE_FAILED',
                "no row with key='clientId' in table shared_preference_v2; finish registration first.",
            )
        raw = row[0]
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode('utf-8', 'replace')
        cid = str(raw).strip()
        if not cid:
            raise HelperFailure('EYECON_PARSE_FAILED', "the 'clientId' value is empty.")

        return {'cid': cid, 'checksum': auth_checksum(cid)}
    finally:
        for path in (
            wal_path,
            db_path,
            temp_dir / 'contactdb-journal',
            temp_dir / 'contactdb-shm',
        ):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
        try:
            temp_dir.rmdir()
        except OSError:
            pass


def read_eyecon(adb, serial):
    try:
        return read_eyecon_inner(adb, serial)
    except HelperFailure:
        raise
    except Exception as exc:
        raise HelperFailure('EYECON_PARSE_FAILED', f'unexpected error reading Eyecon data: {exc}') from exc


def looks_like_xml(text):
    return '<map' in text or '<?xml' in text


def preference_value(root, tag, name, value_attribute=None):
    for element in root.iter(tag):
        if element.get('name') != name:
            continue
        if value_attribute:
            return element.get(value_attribute)
        return ''.join(element.itertext()).strip()
    return None


def expiry_estimate(root):
    raw_fetch = preference_value(root, 'long', TC_FETCH_TIME_KEY, 'value')
    if not raw_fetch or not str(raw_fetch).strip().lstrip('-').isdigit():
        return None
    raw_ttl = preference_value(root, 'long', TC_TTL_KEY, 'value')
    ttl_ms = int(raw_ttl) if raw_ttl and str(raw_ttl).strip().lstrip('-').isdigit() else DEFAULT_TTL_MS
    try:
        stamp = datetime.datetime.fromtimestamp(
            (int(raw_fetch) + ttl_ms) / 1000, tz=datetime.timezone.utc
        )
    except (OverflowError, OSError, ValueError):
        return None
    return stamp.strftime('%Y-%m-%dT%H:%M:%SZ')


def read_truecaller_inner(adb, serial, use_root):
    if not package_installed(adb, serial, TRUECALLER_PACKAGE):
        raise HelperFailure(
            'TRUECALLER_NOT_INSTALLED', f'{TRUECALLER_PACKAGE} is not installed on this device.'
        )

    if use_root:
        completed = run_adb(
            adb,
            device_args(
                serial,
                'shell',
                f'su -c "cat {TRUECALLER_ACCOUNT}"',
            ),
        )
        text = combined_output(completed)
        lowered = text.lower()
        if completed.returncode != 0 or any(
            marker in lowered
            for marker in ('su: not found', 'not found', 'permission denied', 'not allowed', 'shell is not root')
        ):
            raise HelperFailure(
                'TRUECALLER_ROOT_NOT_AVAILABLE',
                'su is missing or denied. No bypass was attempted; use a device you control with working root.',
            )
    else:
        completed = run_adb(
            adb,
            device_args(serial, 'shell', 'run-as', TRUECALLER_PACKAGE, 'cat', 'shared_prefs/account.xml'),
        )
        text = combined_output(completed)
        if looks_not_debuggable(text) or completed.returncode != 0:
            raise HelperFailure(
                'TRUECALLER_NOT_DEBUGGABLE',
                'stock app is not debuggable; no supported ADB export.',
            )

    if not looks_like_xml(text):
        raise HelperFailure('TRUECALLER_PARSE_FAILED', 'account.xml was empty or was not readable as XML.')

    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise HelperFailure('TRUECALLER_PARSE_FAILED', f'account.xml is not valid XML: {exc}')

    installation_id = preference_value(root, 'string', 'installationId')
    if not installation_id:
        raise HelperFailure(
            'TRUECALLER_PARSE_FAILED',
            'no non-empty installationId string was found in account.xml.',
        )

    return {'installation_id': installation_id, 'expiry': expiry_estimate(root)}


def read_truecaller(adb, serial, use_root):
    try:
        return read_truecaller_inner(adb, serial, use_root)
    except HelperFailure:
        raise
    except Exception as exc:
        raise HelperFailure('TRUECALLER_PARSE_FAILED', f'unexpected error reading TrueCaller data: {exc}') from exc


def print_report(eyecon, truecaller):
    if eyecon.get('cid'):
        print(f"Eyecon CID: {eyecon['cid']}")
        print(f"  e-auth-c: {eyecon['checksum']}")
    else:
        print('Eyecon CID: UNAVAILABLE')
        print(f"  Code: {eyecon['code']}")
        print(f"  Reason: {eyecon['detail']}")

    print()

    if truecaller.get('installation_id'):
        print(f"TrueCaller installationId: {truecaller['installation_id']}")
        if truecaller.get('expiry'):
            print(f"  local expiry estimate: {truecaller['expiry']}  (server TTL unconfirmed)")
    else:
        print('TrueCaller installationId: UNAVAILABLE_ON_STOCK')
        print(f"  Reason: {truecaller['detail']}")
        print(f"  Code: {truecaller['code']}")
        if truecaller['code'] == 'TRUECALLER_NOT_DEBUGGABLE':
            print('  Note: --truecaller-root is advanced/opt-in only, on a device you control.')


def main(argv=None):
    parser = argparse.ArgumentParser(
        description='Local-only ADB helper for your own Eyecon CID and TrueCaller installationId.',
        epilog=(
            'Stock, non-rooted, non-debuggable phones cannot expose these values. '
            'This helper makes no network requests and sends nothing anywhere.'
        ),
    )
    parser.add_argument('--serial', help='ADB device serial (required when multiple devices are connected)')
    parser.add_argument('--adb', default='adb', help='path to adb (default: adb on PATH)')
    parser.add_argument(
        '--truecaller-root',
        action='store_true',
        help='advanced, opt-in only: try su to read TrueCaller prefs on a device you control (default: never attempt root)',
    )
    args = parser.parse_args(argv)

    try:
        serial = resolve_device(args.adb, args.serial)
    except HelperFailure as exc:
        print(f'{exc.code}: {exc.detail}')
        return 1

    try:
        eyecon = read_eyecon(args.adb, serial)
    except HelperFailure as exc:
        eyecon = {'code': exc.code, 'detail': exc.detail}

    try:
        truecaller = read_truecaller(args.adb, serial, args.truecaller_root)
    except HelperFailure as exc:
        truecaller = {'code': exc.code, 'detail': exc.detail}

    print_report(eyecon, truecaller)
    return 0


if __name__ == '__main__':
    sys.exit(main())

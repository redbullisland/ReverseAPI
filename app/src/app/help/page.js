import Link from 'next/link';

export const metadata = {
  title: 'Android Credential Help · Caller ID Lookup',
};

const steps = [
  {
    title: 'Install what the browser needs',
    body: (
      <>
        Install{' '}
        <a
          className="text-brand-blue underline underline-offset-2"
          href="https://developer.android.com/tools/releases/platform-tools"
          target="_blank"
          rel="noreferrer"
        >
          Android SDK Platform Tools
        </a>
        . Use Chrome or Edge on a real desktop browser window. The embedded OpenCode browser exposes
        WebUSB but its native device picker did not appear during testing, so it cannot complete the
        device-selection step.
      </>
    ),
  },
  {
    title: 'Prepare the phone',
    body: (
      <>
        On the phone, open <strong>Settings → About phone</strong> and tap <strong>Build number</strong>{' '}
        7 times to enable Developer options. Then open <strong>Developer options</strong> and enable{' '}
        <strong>USB debugging</strong>. Keep the phone unlocked and nearby.
      </>
    ),
  },
  {
    title: 'Connect the phone now',
    body: (
      <>
        Plug the phone in with USB and unlock its screen. Accept the{' '}
        <strong>&ldquo;Allow USB debugging?&rdquo;</strong> RSA prompt. This is the point where the
        device should be connected — after Platform Tools and USB debugging are ready, and with the
        web app Settings panel already open.
      </>
    ),
  },
  {
    title: 'Run the browser import',
    body: (
      <>
        In the app, open <strong>Settings → Get credentials from Android (ADB) → Import via USB</strong>{' '}
        and click <strong>Connect &amp; read</strong>. Select your phone in the browser picker. The app
        will show pending/running/success/failed for USB connection, Eyecon CID, and TrueCaller
        installationId. Values are only copied into the draft fields; click{' '}
        <strong>Save settings</strong> when you have reviewed them.
      </>
    ),
  },
  {
    title: 'If the picker does not appear',
    body: (
      <>
        On Windows, Google&rsquo;s ADB driver usually owns the ADB USB interface, so WebUSB cannot
        claim it. Close other ADB tools, then install a WinUSB driver for the ADB interface with{' '}
        <a
          className="text-brand-blue underline underline-offset-2"
          href="https://zadig.akeo.ie/"
          target="_blank"
          rel="noreferrer"
        >
          Zadig
        </a>
        . After switching drivers, command-line <code>adb</code> may stop working until the driver is
        switched back. If you do not want to change drivers, use the local helper below instead.
      </>
    ),
  },
];

const findings = [
  ['ADB device state', 'WORKS', 'adb devices listed jnroyp6tjzztqwfm as authorized/device.'],
  ['Embedded browser WebUSB gate', 'WORKS', 'navigator.usb was present; Connect & read was enabled.'],
  [
    'Embedded browser device picker',
    'BLOCKED',
    'Automated click produced NO_USB_DEVICE; the native picker did not appear. Use a real Chrome/Edge window.',
  ],
  [
    'Windows ADB driver conflict',
    'EXPECTED',
    'Google ADB normally claims the interface; WinUSB/Zadig is needed before WebUSB can claim it.',
  ],
  [
    'Stock phone credential export',
    'NOT POSSIBLE',
    'Neither Eyecon CID nor TrueCaller installationId is exportable from a stock non-debuggable phone.',
  ],
  [
    'Local Python helper',
    'AVAILABLE',
    'Uses adb directly; works only with your own debuggable or rooted setup. No network calls.',
  ],
];

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="w-full border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center bg-brand-dark text-white">
              ?
            </span>
            <span className="truncate font-heading text-[18px] font-semibold tracking-[-0.15px] text-foreground">
              Caller ID Lookup · Help
            </span>
          </div>
          <Link href="/" className="btn btn-secondary btn-compact">
            Back to lookup
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
        <section className="ui-panel flex flex-col gap-3 p-6">
          <p className="field-label">Android credential import</p>
          <h1 className="font-heading text-[28px] leading-8 font-semibold tracking-[-0.4px] text-foreground">
            Get your keys from the device
          </h1>
          <p className="max-w-3xl text-[14px] leading-6 text-muted-foreground">
            This app never holds your credentials on a server. You can paste them manually, use the
            experimental browser USB import, or use the local helper. A stock, non-rooted,
            non-debuggable phone cannot export either value — the helper only works with a device you
            own that is already debuggable or rooted.
          </p>
        </section>

        <section className="ui-panel">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-[18px] font-semibold text-foreground">
              When to connect the phone
            </h2>
          </div>
          <div className="p-5">
            <p className="border-l-2 border-brand-blue bg-muted px-3 py-2.5 text-[13px] leading-5 text-foreground">
              Connect the phone <strong>after</strong> Platform Tools are installed, USB debugging is
              enabled, and you have this page or the Settings panel open in a real Chrome/Edge window.
              Keep the screen unlocked and accept the RSA prompt when it appears.
            </p>
          </div>
        </section>

        <section className="ui-panel">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-[18px] font-semibold text-foreground">
              WebUSB import · step by step
            </h2>
          </div>
          <ol className="flex flex-col divide-y divide-border">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4 p-5">
                <span className="flex size-7 shrink-0 items-center justify-center bg-brand-blue text-[12px] font-semibold text-white">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[15px] font-semibold text-foreground">{step.title}</h3>
                  <p className="text-[13px] leading-5 text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ui-panel">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-[18px] font-semibold text-foreground">
              What worked in our verification
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12px] leading-5">
              <thead className="bg-muted text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Check</th>
                  <th className="px-4 py-2">Result</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {findings.map(([check, result, notes]) => (
                  <tr key={check}>
                    <td className="px-4 py-3 font-medium text-foreground">{check}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{result}</td>
                    <td className="px-4 py-3 text-muted-foreground">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ui-panel">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-[18px] font-semibold text-foreground">
              Reliable fallback · local helper
            </h2>
          </div>
          <div className="flex flex-col gap-3 p-5 text-[13px] leading-5 text-muted-foreground">
            <p>
              Download <a href="/import_credentials.py" download className="text-brand-blue underline underline-offset-2">import_credentials.py</a>{' '}
              from Settings or run the tracked copy. It uses only Python&rsquo;s standard library and
              your existing <code>adb</code> driver.
            </p>
            <pre className="overflow-x-auto border border-border bg-muted px-3 py-2 font-mono text-[12px] text-foreground">
              python import_credentials.py
              {'\n'}python import_credentials.py --serial &lt;serial&gt;
              {'\n'}python import_credentials.py --serial &lt;serial&gt; --truecaller-root
            </pre>
            <p>
              Root is opt-in only. The helper makes no network requests and sends nothing anywhere.
              If a value is unavailable, it prints a code such as{' '}
              <code>EYECON_NOT_DEBUGGABLE</code> or <code>TRUECALLER_NOT_DEBUGGABLE</code>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

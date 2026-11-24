'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  KeyRound,
  LoaderCircle,
  Phone,
  Search,
  Settings2,
  Upload,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROVIDERS, getProvider, lookup } from '@/lib/providers';
import { authChecksum } from '@/lib/providers/eyecon';
import { COUNTRIES, loadSettings, saveSettings } from '@/lib/settings';

const REQUIRED_SECRETS = { eyecon: 'cid', truecaller: 'token' };
const SECRET_LABELS = { eyecon: 'Client ID', truecaller: 'installationId' };

function parseNumbers(raw) {
  return String(raw ?? '')
    .split(/[\n,;]+/)
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter((part) => part && !/^(phone|number|numbers|phone_number|msisdn)$/i.test(part));
}

function countryValue(dialCode) {
  return dialCode || 'custom';
}

function formatE164(cli, fallback) {
  const digits = String(cli ?? '').replace(/\D/g, '');
  if (!digits) return fallback;
  if (digits.startsWith('880') && digits.length === 13) {
    return `+880 ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return `+${digits}`;
}

/** Merge names from every provider so names — not providers — lead the result. */
function collectNames(results) {
  const byName = new Map();
  for (const result of results) {
    for (const rawName of result.names ?? []) {
      const name = String(rawName).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, { name, sources: [] });
      const entry = byName.get(key);
      if (!entry.sources.includes(result.providerName)) entry.sources.push(result.providerName);
    }
  }
  return [...byName.values()];
}

function readyLabel(count) {
  if (!count) return 'No numbers yet';
  return `${count} ${count === 1 ? 'number' : 'numbers'} ready`;
}

function SecretChip({ children }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center border border-border bg-muted px-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </span>
  );
}

function BrandHeader({ onOpenSettings }) {
  return (
    <header className="w-full border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center bg-brand-dark text-white">
            <Phone className="size-[18px]" aria-hidden="true" />
          </span>
          <span className="truncate font-heading text-[18px] font-semibold tracking-[-0.15px] text-foreground">
            Caller ID Lookup
          </span>
        </div>

        <DialogTrigger asChild>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn btn-secondary btn-compact"
          >
            <Settings2 className="size-4 text-muted-foreground" aria-hidden="true" />
            Settings
          </button>
        </DialogTrigger>
      </div>
    </header>
  );
}

function StatusStrip({ missingProvider, error, onOpenSettings }) {
  if (!missingProvider && !error) return null;
  const isSetup = Boolean(missingProvider);
  const isInputError = String(error).startsWith('Enter at least one');
  const detail = isSetup
    ? `Open Settings and paste your ${SECRET_LABELS[missingProvider.id]}. The value stays in this browser only.`
    : isInputError
      ? error
      : 'One or more sources were unavailable. Full messages are in Technical details below.';

  return (
    <div
      role={isSetup ? 'status' : 'alert'}
      className={`flex flex-col gap-3 border px-4 py-3 sm:flex-row sm:items-center ${
        isSetup
          ? 'border-[#B4C5FF] bg-[#EEF2FF] text-foreground'
          : 'border-[#E8B4AF] bg-error-container text-error-ink'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center text-white ${
            isSetup ? 'bg-brand-blue' : 'bg-destructive'
          }`}
        >
          {isSetup ? (
            <KeyRound className="size-4" aria-hidden="true" />
          ) : (
            <AlertCircle className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5">
            {isSetup ? `${missingProvider.name} setup needed` : 'Lookup could not finish'}
          </p>
          <p className="mt-0.5 text-[13px] leading-5 whitespace-pre-line opacity-85">{detail}</p>
        </div>
      </div>
      {isSetup && (
        <button type="button" onClick={onOpenSettings} className="btn btn-primary btn-compact self-start sm:self-auto">
          Open Settings
        </button>
      )}
    </div>
  );
}

function NumberResult({ group }) {
  const names = collectNames(group.results);
  const flagged = group.results.some((result) => result.spam_level > 0);
  const failures = group.results.map((result) => result.error).filter(Boolean);

  function nameClass(index) {
    if (index === 0) return 'font-heading text-[22px] font-semibold leading-7 text-foreground';
    if (index === 1) return 'font-heading text-[17px] font-semibold leading-6 text-foreground';
    if (index === 2) return 'text-[15px] font-medium leading-5 text-foreground';
    return 'text-[14px] leading-5 text-muted-foreground';
  }

  return (
    <section className="ui-panel">
      <header className="ui-panel-header flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="kicker shrink-0">Number</span>
          <span className="truncate font-mono text-[14px] font-medium tracking-tight text-foreground">
            {formatE164(group.cli, group.number)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {flagged && (
            <span className="inline-flex h-6 items-center gap-1.5 bg-error-container px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-error-ink">
              <AlertCircle className="size-3.5" aria-hidden="true" />
              Spam flagged
            </span>
          )}
          <span className="text-[12px] tabular-nums text-muted-foreground">
            {names.length} {names.length === 1 ? 'name' : 'names'}
          </span>
        </div>
      </header>

      {names.length > 0 ? (
        <ol className="divide-y divide-border">
          {names.map((item, index) => (
            <li
              key={item.name}
              className={`grid grid-cols-[24px_minmax(0,1fr)] gap-3 px-5 py-3.5 ${
                index === 0 ? 'border-l-2 border-brand-blue bg-[#F8FAFF]' : ''
              }`}
            >
              <span className="pt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                <span className={`${nameClass(index)} min-w-0 break-words`}>{item.name}</span>
                <span className="flex shrink-0 flex-wrap gap-1.5">
                  {item.sources.map((source) => (
                    <SecretChip key={source}>{source}</SecretChip>
                  ))}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-5 py-9 text-center">
          <span className="mx-auto flex size-9 items-center justify-center border border-border bg-muted text-muted-foreground">
            <Search className="size-4" aria-hidden="true" />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-foreground">No names returned</p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            Try name history mode, another source, or a different number.
          </p>
        </div>
      )}

      {failures.length > 0 && (
        <footer className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">
          {failures.length} {failures.length === 1 ? 'source' : 'sources'} unavailable · details below
        </footer>
      )}
    </section>
  );
}

export default function Home() {
  const [settings, setSettings] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [csvName, setCsvName] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const csvInputRef = useRef(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (settings) saveSettings(settings);
  }, [settings]);

  const selectedProviders = useMemo(
    () => (settings?.providers ?? []).map(getProvider).filter((provider) => !provider.placeholder),
    [settings?.providers]
  );

  const missingProvider = selectedProviders.find(
    (provider) =>
      !String(settings?.secrets?.[provider.id]?.[REQUIRED_SECRETS[provider.id]] ?? '').trim()
  );

  if (!settings) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="w-full border-b border-border bg-card">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-6 py-4">
            <span className="flex size-9 items-center justify-center bg-brand-dark text-white">
              <Phone className="size-[18px]" aria-hidden="true" />
            </span>
            <span className="font-heading text-[18px] font-semibold">Caller ID Lookup</span>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-4xl flex-1 items-start px-6 py-8">
          <div className="ui-panel flex w-full items-center gap-3 px-6 py-5 text-[13px] text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-brand-blue" aria-hidden="true" />
            Loading saved settings…
          </div>
        </main>
      </div>
    );
  }

  const selectedCountry = COUNTRIES.find((country) => country.code === settings.dialCode);
  const numberCount = parseNumbers(settings.number).length;
  const providerNames = selectedProviders.map((provider) => provider.name).join(' + ') || 'No sources';

  function patch(patchObject) {
    setError('');
    setSettings((previous) => ({ ...previous, ...patchObject }));
  }

  function changeProviders(providers) {
    if (!providers.length) return;
    setError('');
    setSettings((previous) => ({ ...previous, providers, provider: providers[0] }));
  }

  function prepareDraft() {
    setDraft(JSON.parse(JSON.stringify(settings)));
    setError('');
    setSettingsOpen(true);
  }

  function patchDraft(patchObject) {
    setDraft((previous) => ({ ...previous, ...patchObject }));
  }

  function patchDraftSecret(providerId, key, value) {
    setDraft((previous) => ({
      ...previous,
      secrets: {
        ...previous.secrets,
        [providerId]: { ...(previous.secrets[providerId] ?? {}), [key]: value },
      },
    }));
  }

  function toggleDraftProvider(providerId, enabled) {
    setDraft((previous) => {
      const has = previous.providers.includes(providerId);
      if (enabled === has) return previous;
      if (!enabled && previous.providers.length === 1) return previous;
      const providers = enabled
        ? [...previous.providers, providerId]
        : previous.providers.filter((id) => id !== providerId);
      return { ...previous, providers, provider: providers[0] };
    });
  }

  function saveDraft() {
    setSettings(draft);
    setError('');
    setSettingsOpen(false);
  }

  async function runLookups(numbers) {
    const list = numbers.map((number) => number.trim()).filter(Boolean);
    if (!list.length) {
      setError('Enter at least one phone number above.');
      return;
    }
    if (missingProvider) {
      prepareDraft();
      return;
    }

    setBusy(true);
    setError('');
    setResults([]);

    const groups = [];
    const errors = [];
    for (const number of list) {
      const group = { number, cli: '', results: [] };
      for (const provider of selectedProviders) {
        const providerSecrets = settings.secrets[provider.id] ?? {};
        try {
          const data = await lookup(provider.id, {
            number,
            dialCode: settings.dialCode,
            countryCode: selectedCountry?.iso ?? '',
            ...providerSecrets,
            mode: settings.mode,
            lang: settings.lang,
            source: settings.source,
            proxyTemplate: settings.proxyTemplate,
          });
          group.cli = group.cli || data.cli;
          group.results.push({ providerId: provider.id, providerName: provider.name, ...data });
          if (!data.ok && data.error) errors.push(`${provider.name}: ${data.error}`);
        } catch (err) {
          group.results.push({
            providerId: provider.id,
            providerName: provider.name,
            ok: false,
            status: 0,
            names: [],
            spam_level: -1,
            spam_text: 'Unavailable',
            error: err.message,
            raw: '',
            url: '',
            proxied: false,
          });
          errors.push(`${provider.name}: ${err.message}`);
        }
      }
      groups.push(group);
    }

    setResults(groups);
    if (errors.length) setError(errors.join('\n'));
    setBusy(false);
  }

  function submit(event) {
    event.preventDefault();
    runLookups(parseNumbers(settings.number));
  }

  async function loadCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvName(file.name);
    const text = await file.text();
    patch({ number: parseNumbers(text).join('\n') });
    event.target.value = '';
  }

  const rawEntries = results.flatMap((group) =>
    group.results.map((result) => ({ number: group.number, result }))
  );

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <div className="flex min-h-screen flex-col">
        <BrandHeader onOpenSettings={prepareDraft} />

        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 pt-6 pb-12">
          <StatusStrip
            missingProvider={missingProvider}
            error={error}
            onOpenSettings={prepareDraft}
          />

          <section className="ui-panel">
            <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="font-heading text-[22px] leading-7 font-bold tracking-[-0.25px] text-foreground">
                  Look up a number
                </h1>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                  Names from your enabled sources. Credentials stay in this browser.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="kicker shrink-0">Sources</span>
                <div
                  className="segment-group flex w-full sm:w-auto"
                  role="group"
                  aria-label="Lookup providers"
                >
                  {PROVIDERS.map((provider) => {
                    const active = settings.providers.includes(provider.id);
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        aria-pressed={active}
                        data-active={active ? 'true' : undefined}
                        onClick={() => {
                          const next = active
                            ? settings.providers.filter((id) => id !== provider.id)
                            : [...settings.providers, provider.id];
                          changeProviders(next);
                        }}
                        className="segment-button"
                      >
                        {active && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
                        {provider.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="kicker">Mode</span>
                  <RadioGroup
                    value={settings.mode}
                    onValueChange={(value) => patch({ mode: value })}
                    className="segment-group segment-group-sm flex w-full sm:w-auto"
                    aria-label="Lookup mode"
                  >
                    <label
                      htmlFor="mode-callerid"
                      data-active={settings.mode === 'callerid' ? 'true' : undefined}
                      className="segment-button segment-button-sm cursor-pointer"
                    >
                      <RadioGroupItem value="callerid" id="mode-callerid" className="sr-only radio-square" />
                      Caller ID
                    </label>
                    <label
                      htmlFor="mode-search"
                      data-active={settings.mode === 'search' ? 'true' : undefined}
                      className="segment-button segment-button-sm cursor-pointer"
                    >
                      <RadioGroupItem value="search" id="mode-search" className="sr-only radio-square" />
                      Name history
                    </label>
                  </RadioGroup>
                  <span className="hidden text-[12px] text-muted-foreground lg:inline">
                    {settings.mode === 'callerid' ? 'Current caller' : 'Past names'}
                  </span>
                </div>

                <div className="flex min-w-0 items-center gap-3 text-[12px] text-muted-foreground">
                  {csvName && (
                    <span className="max-w-[180px] truncate border-r border-border pr-3" title={csvName}>
                      CSV · {csvName}
                    </span>
                  )}
                  <span className="font-mono tabular-nums text-foreground">{readyLabel(numberCount)}</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-12 md:items-start">
                <div className="md:col-span-3">
                  <label className="field-label" htmlFor="dial-code">
                    Country code
                  </label>
                  <Select
                    value={countryValue(settings.dialCode)}
                    onValueChange={(value) => patch({ dialCode: value === 'custom' ? '' : value })}
                  >
                    <SelectTrigger id="dial-code" className="control">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem
                          key={country.code || 'custom'}
                          value={country.code || 'custom'}
                        >
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                    Leading 0 is stripped.
                  </p>
                </div>

                <div className="md:col-span-6">
                  <label className="field-label" htmlFor="phone-numbers">
                    Phone numbers
                    <span className="ml-auto normal-case tracking-normal text-muted-foreground">
                      commas or new lines
                    </span>
                  </label>
                  <textarea
                    id="phone-numbers"
                    rows={3}
                    className="control control-textarea"
                    value={settings.number}
                    onChange={(event) => patch({ number: event.target.value })}
                    placeholder={selectedCountry?.placeholder || '+880 17XX XXX XXX'}
                  />
                </div>

                <div className="md:col-span-3">
                  <span className="field-label">Actions</span>
                  <div className="flex h-20 flex-col gap-2">
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={loadCsv}
                    />
                    <button
                      type="button"
                      onClick={() => csvInputRef.current?.click()}
                      className="btn btn-secondary h-9 w-full"
                    >
                      <Upload className="size-4 text-muted-foreground" aria-hidden="true" />
                      Upload .csv
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn btn-primary h-9 w-full"
                    >
                      {busy ? (
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Search className="size-4" aria-hidden="true" />
                      )}
                      {busy ? 'Working…' : 'Look up'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </section>

          {busy && (
            <section className="ui-panel" aria-live="polite">
              <header className="ui-panel-header flex items-center gap-3">
                <LoaderCircle className="size-4 animate-spin text-brand-blue" aria-hidden="true" />
                <div>
                  <p className="text-[14px] font-semibold leading-5 text-foreground">Looking up names</p>
                  <p className="text-[12px] leading-4 text-muted-foreground">Asking {providerNames}…</p>
                </div>
              </header>
              <div className="flex flex-col gap-3 px-5 py-5">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <span className="h-3 w-6 shrink-0 animate-pulse bg-muted" />
                    <span
                      className={`h-3 animate-pulse bg-muted ${
                        row === 0 ? 'w-2/5' : row === 1 ? 'w-1/3' : 'w-1/4'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {!busy && results.length === 0 && (
            <section className="border border-dashed border-border bg-card/60 px-6 py-10 text-center">
              <span className="mx-auto flex size-10 items-center justify-center border border-border bg-muted text-muted-foreground">
                <Search className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-heading text-[18px] font-semibold text-foreground">
                No lookups yet
              </h2>
              <p className="mx-auto mt-1 max-w-md text-[13px] leading-5 text-muted-foreground">
                Enter a number above and choose Look up. Names will appear here, ranked with the
                source for each one.
              </p>
            </section>
          )}

          {!busy && results.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="font-heading text-[18px] font-semibold text-foreground">Names found</h2>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">Highest-ranked name first</p>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  <span className="font-mono tabular-nums text-foreground">{results.length}</span>{' '}
                  {results.length === 1 ? 'number' : 'numbers'} · {providerNames}
                </p>
              </div>

              {results.map((group, groupIndex) => (
                <NumberResult key={`${group.number}-${groupIndex}`} group={group} />
              ))}

              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex w-full items-center gap-2 py-1 text-left text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
                    Technical details
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3 pt-3">
                  {rawEntries.map(({ number, result }, index) => (
                    <div key={`${number}-${index}`} className="flex flex-col gap-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {result.providerName} · {number}
                      </p>
                      <pre className="raw-block">
                        {result.targetUrl || result.url}
                        {'\n'}
                        HTTP {result.status}
                        {result.error ? `\n${result.error}` : ''}
                        {'\n'}
                        {result.raw || '(empty)'}
                      </pre>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </section>
          )}
        </main>

        <DialogContent className="dialog-shell">
          <DialogHeader className="dialog-header">
            <DialogTitle className="dialog-title">Provider settings</DialogTitle>
            <DialogDescription className="dialog-description">
              Paste your own credentials, choose sources, then save. Nothing is sent to a server.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <div className="mb-4 border-l-2 border-brand-blue bg-muted px-3 py-2.5 text-[12px] leading-5 text-muted-foreground">
                <strong className="text-foreground">First time here?</strong> Paste a value below,
                keep that provider enabled, then save. The browser remembers it.
              </div>

              <div className="flex flex-col gap-4">
                {PROVIDERS.map((provider) => {
                  const enabled = draft.providers.includes(provider.id);
                  const requiredKey = REQUIRED_SECRETS[provider.id];
                  const ready = requiredKey
                    ? String(draft.secrets?.[provider.id]?.[requiredKey] ?? '').trim()
                    : true;

                  return (
                    <section key={provider.id} className="ui-panel">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-foreground">{provider.name}</h3>
                          <span
                            className={`inline-flex h-5 items-center px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                              !enabled
                                ? 'bg-muted text-muted-foreground'
                                : ready
                                  ? 'bg-success-container text-success'
                                  : 'bg-error-container text-error-ink'
                            }`}
                          >
                            {!enabled ? 'Off' : ready ? 'Ready' : 'Needs credentials'}
                          </span>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
                          <Checkbox
                            checked={enabled}
                            onCheckedChange={(checked) => toggleDraftProvider(provider.id, !!checked)}
                            aria-label={`Enable ${provider.name}`}
                            className="checkbox-square"
                          />
                          Enable
                        </label>
                      </div>

                      {enabled && (
                        <div className="flex flex-col gap-3 p-4">
                          {provider.SECRET_FIELDS.map((field) => (
                            <div key={field.key} className="flex flex-col">
                              <label className="field-label" htmlFor={`secret-${provider.id}-${field.key}`}>
                                {field.label}
                              </label>
                              <input
                                id={`secret-${provider.id}-${field.key}`}
                                type={['cid', 'token'].includes(field.key) ? 'password' : 'text'}
                                className="control control-compact font-mono"
                                value={draft.secrets?.[provider.id]?.[field.key] ?? ''}
                                onChange={(event) =>
                                  patchDraftSecret(provider.id, field.key, event.target.value)
                                }
                                placeholder={provider.DEFAULT_SECRETS?.[field.key] || ''}
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                {field.help}
                              </p>
                            </div>
                          ))}
                          {provider.id === 'eyecon' && (
                            <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
                              Computed <code>e-auth-c</code>:{' '}
                              <code className="text-foreground">
                                {authChecksum(draft.secrets?.eyecon?.cid)}
                              </code>
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}

                <details className="ui-panel">
                  <summary className="cursor-pointer px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Advanced · relay / CORS proxy
                  </summary>
                  <div className="border-t border-border p-4">
                    <label className="field-label" htmlFor="proxy-template">
                      Proxy URL template
                    </label>
                    <input
                      id="proxy-template"
                      className="control control-compact font-mono"
                      value={draft.proxyTemplate ?? ''}
                      onChange={(event) => patchDraft({ proxyTemplate: event.target.value })}
                      placeholder="https://your-proxy.example/?url={url}&{headers}"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                      Blank uses the built-in relay. Tokens: <code>{'{url}'}</code>,{' '}
                      <code>{'{rawUrl}'}</code>, <code>{'{headers}'}</code>. A third-party proxy
                      sees your credentials and numbers.
                    </p>
                  </div>
                </details>
              </div>
            </div>
          )}

          <DialogFooter className="dialog-footer">
            <span className="mr-auto text-[11px] text-muted-foreground">Saved in this browser only</span>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="btn btn-secondary btn-compact"
            >
              Cancel
            </button>
            <button type="button" onClick={saveDraft} disabled={!draft} className="btn btn-primary btn-compact px-4">
              Save settings
            </button>
          </DialogFooter>
        </DialogContent>
      </div>
    </Dialog>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronRight,
  KeyRound,
  LoaderCircle,
  Phone,
  Search,
  Settings2,
  Upload,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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

function statusVariant(level) {
  if (level === 0) return 'default';
  if (level > 0) return 'destructive';
  return 'secondary';
}

function ProviderResultCard({ result, mode }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{result.providerName}</span>
          <Badge variant={statusVariant(result.spam_level)}>{result.spam_text}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Names{result.names?.length ? ` (${result.names.length})` : ''}
          </p>
          {result.names?.length ? (
            <ul className="flex flex-col gap-1.5">
              {result.names.map((name, index) => (
                <li key={`${name}-${index}`} className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className={index === 0 ? 'font-medium' : 'text-muted-foreground'}>{name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No names found</p>
          )}
        </div>
        {result.entries?.[0]?.carrier && (
          <p className="text-xs text-muted-foreground">Carrier: {result.entries[0].carrier}</p>
        )}
        {result.error && <p className="text-xs text-destructive">{result.error}</p>}
      </CardContent>
      <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
        <span>
          HTTP {result.status}
          {result.proxied ? ' · via proxy' : ''}
        </span>
        <span>{mode === 'search' ? 'Search / name history' : 'Caller ID'}</span>
      </CardFooter>
    </Card>
  );
}

export default function Home() {
  const [settings, setSettings] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [csvName, setCsvName] = useState('');
  const [results, setResults] = useState([]);
  const [runMeta, setRunMeta] = useState(null);
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
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }

  const selectedCountry = COUNTRIES.find((country) => country.code === settings.dialCode);
  const batchCount = parseNumbers(settings.batchNumbers).length;

  function patch(patchObject) {
    setSettings((previous) => ({ ...previous, ...patchObject }));
  }

  function patchSecret(providerId, key, value) {
    setSettings((previous) => ({
      ...previous,
      secrets: {
        ...previous.secrets,
        [providerId]: { ...(previous.secrets[providerId] ?? {}), [key]: value },
      },
    }));
  }

  function changeProviders(providers) {
    if (!providers.length) return;
    setSettings((previous) => ({ ...previous, providers, provider: providers[0] }));
  }

  function prepareDraft() {
    setDraft(JSON.parse(JSON.stringify(settings)));
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
    setSettingsOpen(false);
  }

  async function runLookups(numbers) {
    const list = numbers.map((number) => number.trim()).filter(Boolean);
    if (!list.length) {
      setError('Enter at least one phone number.');
      return;
    }
    if (missingProvider) {
      setError(`${missingProvider.name} details are missing. Open Settings to add them.`);
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
    setRunMeta({
      mode: settings.mode,
      providers: selectedProviders.map((provider) => provider.name),
      count: list.length,
    });
    if (errors.length) setError(errors.join('\n'));
    setBusy(false);
  }

  function submit(event) {
    event.preventDefault();
    if (settings.inputMode === 'batch') runLookups(parseNumbers(settings.batchNumbers));
    else runLookups([settings.number]);
  }

  async function loadCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvName(file.name);
    const text = await file.text();
    const numbers = parseNumbers(text);
    patch({ batchNumbers: numbers.join('\n') });
    event.target.value = '';
  }

  const rawEntries = results.flatMap((group) =>
    group.results.map((result) => ({ number: group.number, result }))
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Phone className="size-[18px]" />
          </div>
          <span className="text-base font-medium">Caller ID Lookup</span>
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={prepareDraft}>
              <Settings2 />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Provider settings</DialogTitle>
              <DialogDescription>
                Credentials are stored only in this browser&apos;s localStorage. Nothing is sent to
                our servers.
              </DialogDescription>
            </DialogHeader>

            {draft && (
              <div className="flex flex-col gap-3">
                {PROVIDERS.map((provider) => {
                  const enabled = draft.providers.includes(provider.id);
                  return (
                    <div key={provider.id} className="flex flex-col gap-3 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{provider.name}</span>
                          <Badge variant={enabled ? 'default' : 'secondary'}>
                            {enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <Checkbox
                          checked={enabled}
                          onCheckedChange={(checked) => toggleDraftProvider(provider.id, !!checked)}
                          aria-label={`Enable ${provider.name}`}
                        />
                      </div>
                      {enabled &&
                        provider.SECRET_FIELDS.map((field) => (
                          <div key={field.key} className="flex flex-col gap-1.5">
                            <Label htmlFor={`secret-${provider.id}-${field.key}`}>
                              {field.label}
                            </Label>
                            <Input
                              id={`secret-${provider.id}-${field.key}`}
                              type={['cid', 'token'].includes(field.key) ? 'password' : 'text'}
                              className="font-mono"
                              value={draft.secrets?.[provider.id]?.[field.key] ?? ''}
                              onChange={(event) =>
                                patchDraftSecret(provider.id, field.key, event.target.value)
                              }
                              placeholder={provider.DEFAULT_SECRETS?.[field.key] ?? ''}
                              autoComplete="off"
                              spellCheck={false}
                            />
                            <p className="text-xs text-muted-foreground">{field.help}</p>
                          </div>
                        ))}
                      {enabled && provider.id === 'eyecon' && (
                        <p className="text-xs text-muted-foreground">
                          Computed <code>e-auth-c</code> checksum:{' '}
                          <strong>{authChecksum(draft.secrets?.eyecon?.cid)}</strong>
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-col gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Advanced</span>
                    <Badge variant="outline">CORS proxy</Badge>
                  </div>
                  <Label htmlFor="proxy-template">Proxy URL template</Label>
                  <Input
                    id="proxy-template"
                    className="font-mono"
                    value={draft.proxyTemplate ?? ''}
                    onChange={(event) => patchDraft({ proxyTemplate: event.target.value })}
                    placeholder="https://your-proxy.example/?url={url}&{headers}"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Blank uses the built-in same-origin relay. Tokens:{' '}
                    <code>{'{url}'}</code> encoded URL, <code>{'{rawUrl}'}</code> raw URL,{' '}
                    <code>{'{headers}'}</code> upstream headers. A third-party proxy sees your
                    credentials and numbers.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveDraft} disabled={!draft}>
                Save settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-12">
        {missingProvider && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {missingProvider.name} {SECRET_LABELS[missingProvider.id]} required before lookup.
              </span>
              <Button variant="outline" size="sm" onClick={prepareDraft}>
                <KeyRound />
                Add credentials
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4 px-(--card-spacing) pt-(--card-spacing)">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-lg leading-snug font-medium">Look up a number</h2>
              <p className="text-xs text-muted-foreground">
                Client-only lookups. Credentials stay in your browser.
              </p>
            </div>
            <ToggleGroup
              type="multiple"
              value={settings.providers}
              onValueChange={changeProviders}
              variant="outline"
              size="sm"
              aria-label="Lookup providers"
            >
              {PROVIDERS.map((provider) => (
                <ToggleGroupItem key={provider.id} value={provider.id}>
                  {provider.name}
                </ToggleGroupItem>
              ))}
              <ToggleGroupItem value="numverify" disabled aria-label="NumVerify, coming soon">
                NumVerify
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Tabs
                value={settings.inputMode}
                onValueChange={(value) => patch({ inputMode: value })}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList variant="line">
                    <TabsTrigger value="single">Single number</TabsTrigger>
                    <TabsTrigger value="batch">Multiple / CSV</TabsTrigger>
                  </TabsList>
                  {settings.inputMode === 'batch' && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {batchCount} {batchCount === 1 ? 'number' : 'numbers'}
                    </span>
                  )}
                </div>

                <TabsContent value="single" className="pt-4">
                  <div className="grid gap-3 md:grid-cols-12 md:items-end">
                    <div className="flex flex-col gap-1.5 md:col-span-4">
                      <Label htmlFor="dial-code-single">Country code</Label>
                      <Select
                        value={countryValue(settings.dialCode)}
                        onValueChange={(value) =>
                          patch({ dialCode: value === 'custom' ? '' : value })
                        }
                      >
                        <SelectTrigger id="dial-code-single" className="w-full">
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
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-5">
                      <Label htmlFor="phone-single">Phone number</Label>
                      <Input
                        id="phone-single"
                        type="tel"
                        inputMode="tel"
                        value={settings.number}
                        onChange={(event) => patch({ number: event.target.value })}
                        placeholder={selectedCountry?.placeholder ?? '017XX XXX XXX'}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Button type="submit" className="w-full" disabled={busy}>
                        {busy ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Search />
                        )}
                        {busy ? 'Looking up…' : 'Look up'}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="batch" className="pt-4">
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 md:grid-cols-12 md:items-start">
                      <div className="flex flex-col gap-1.5 md:col-span-4">
                        <Label htmlFor="dial-code-batch">Default country code</Label>
                        <Select
                          value={countryValue(settings.dialCode)}
                          onValueChange={(value) =>
                            patch({ dialCode: value === 'custom' ? '' : value })
                          }
                        >
                          <SelectTrigger id="dial-code-batch" className="w-full">
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
                      </div>
                      <div className="flex flex-col gap-1.5 md:col-span-8">
                        <Label htmlFor="phone-batch">
                          Phone numbers (comma or newline separated)
                        </Label>
                        <Textarea
                          id="phone-batch"
                          rows={3}
                          className="font-mono"
                          value={settings.batchNumbers}
                          onChange={(event) => patch({ batchNumbers: event.target.value })}
                          placeholder="01632-027018, 01711-004521"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={loadCsv}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => csvInputRef.current?.click()}
                      >
                        <Upload />
                        {csvName || 'Upload .csv'}
                      </Button>
                      <Button type="submit" disabled={busy}>
                        {busy ? <LoaderCircle className="animate-spin" /> : <Search />}
                        {busy ? 'Looking up…' : 'Look up all'}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:gap-6">
                <span className="text-xs text-muted-foreground">Mode</span>
                <RadioGroup
                  value={settings.mode}
                  onValueChange={(value) => patch({ mode: value })}
                  className="flex flex-row gap-5"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="callerid" id="mode-callerid" />
                    <Label htmlFor="mode-callerid" className="font-normal">
                      Caller ID
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="search" id="mode-search" />
                    <Label htmlFor="mode-search" className="font-normal">
                      Search / name history
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        )}

        {results.length > 0 && runMeta && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-base font-medium">Results</h2>
                {results[0].cli && (
                  <span className="font-mono text-sm text-muted-foreground">{results[0].cli}</span>
                )}
              </div>
              <Badge variant="outline">
                {runMeta.providers.join(', ')} ·{' '}
                {runMeta.mode === 'search' ? 'Search / name history' : 'Caller ID'}
              </Badge>
            </div>

            {results.map((group, groupIndex) => (
              <div key={`${group.number}-${groupIndex}`} className="flex flex-col gap-2">
                {results.length > 1 && (
                  <p className="text-xs text-muted-foreground">Input: {group.number}</p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {group.results.map((result, resultIndex) => (
                    <ProviderResultCard
                      key={`${result.providerId}-${resultIndex}`}
                      result={result}
                      mode={runMeta.mode}
                    />
                  ))}
                </div>
              </div>
            ))}

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-muted-foreground [&[data-state=open]_svg]:rotate-90"
                >
                  <ChevronRight className="transition-transform" />
                  Request URL &amp; raw response
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-3 pt-2">
                {rawEntries.map(({ number, result }, index) => (
                  <div key={`${number}-${index}`} className="flex flex-col gap-1">
                    <p className="text-xs font-medium">
                      {result.providerName} · {number}
                    </p>
                    <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap break-all">
                      {result.targetUrl || result.url}
                      {'\n'}
                      HTTP {result.status}
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
    </div>
  );
}

import { DEFAULT_PROVIDER, PROVIDERS } from './providers';

export const STORAGE_KEY = 'callerid-lookup:settings:v1';

export const COUNTRIES = [
  { code: '+880', label: 'Bangladesh (+880)', placeholder: '017XX XXX XXX', iso: 'BD' },
  { code: '+91', label: 'India (+91)', placeholder: 'XXXXXXXXXX', iso: 'IN' },
  { code: '+92', label: 'Pakistan (+92)', placeholder: '3XXXXXXXXX', iso: 'PK' },
  { code: '+977', label: 'Nepal (+977)', placeholder: '9XXXXXXXXX', iso: 'NP' },
  { code: '+94', label: 'Sri Lanka (+94)', placeholder: '7XXXXXXXX', iso: 'LK' },
  { code: '+1', label: 'USA / Canada (+1)', placeholder: 'XXXXXXXXXX', iso: 'US' },
  { code: '+44', label: 'UK (+44)', placeholder: '7XXXXXXXXX', iso: 'GB' },
  { code: '+61', label: 'Australia (+61)', placeholder: '4XXXXXXXXX', iso: 'AU' },
  { code: '+971', label: 'UAE (+971)', placeholder: '5XXXXXXXXX', iso: 'AE' },
  { code: '+966', label: 'Saudi Arabia (+966)', placeholder: '5XXXXXXXXX', iso: 'SA' },
  { code: '', label: 'Custom / full number', placeholder: '+880 17XX XXX XXX', iso: '' },
];

// NEXT_PUBLIC_* values are inlined into the browser bundle by Next.js. They are
// convenience defaults only — anything pasted in the UI overrides them and is
// persisted to localStorage by saveSettings().
const ENV_SECRET_VALUES = {
  eyecon: { cid: (process.env.NEXT_PUBLIC_EYECON_CLIENT_ID || '').trim() },
  truecaller: { token: (process.env.NEXT_PUBLIC_TRUECALLER_TOKEN || '').trim() },
};

const DEFAULT_SECRETS = Object.fromEntries(
  PROVIDERS.map((provider) => [
    provider.id,
    {
      ...(provider.DEFAULT_SECRETS ?? {}),
      ...Object.fromEntries(
        Object.entries(ENV_SECRET_VALUES[provider.id] ?? {}).filter(([, value]) => value)
      ),
    },
  ])
);

export const DEFAULT_SETTINGS = {
  // `providers` is the source of truth for the multi-select UI. `provider` is kept
  // in sync as the first active provider for the provider lookup helpers.
  providers: [DEFAULT_PROVIDER],
  provider: DEFAULT_PROVIDER,
  inputMode: 'single',
  dialCode: '+880',
  number: '',
  batchNumbers: '',
  mode: 'callerid',
  lang: 'en',
  source: 'callerid-web',
  proxyTemplate: (process.env.NEXT_PUBLIC_CORS_PROXY_TEMPLATE || '').trim(),
  secrets: DEFAULT_SECRETS,
};

export function loadSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;

    const secrets = { ...DEFAULT_SECRETS };
    for (const provider of PROVIDERS) {
      // Ignore empty saved values so a stale localStorage entry cannot erase an
      // env-provided default (NEXT_PUBLIC_* is a dev convenience only).
      const savedSecrets = Object.fromEntries(
        Object.entries(saved.secrets?.[provider.id] ?? {}).filter(([, value]) =>
          String(value ?? '').trim()
        )
      );
      secrets[provider.id] = { ...DEFAULT_SECRETS[provider.id], ...savedSecrets };
    }
    const merged = { ...DEFAULT_SETTINGS, ...saved, secrets };

    // Migrate the old single-provider settings shape.
    if (!Array.isArray(merged.providers) || merged.providers.length === 0) {
      merged.providers = [merged.provider || DEFAULT_PROVIDER];
    }
    merged.provider = merged.providers[0];

    // The single/batch screens were merged: one text field now holds all numbers.
    if (!String(merged.number ?? '').trim() && String(merged.batchNumbers ?? '').trim()) {
      merged.number = merged.batchNumbers;
    }

    // A stale empty proxy override should fall back to the env-provided relay URL.
    if (!String(merged.proxyTemplate ?? '').trim()) {
      merged.proxyTemplate = DEFAULT_SETTINGS.proxyTemplate;
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be disabled (private mode / quota); the app still works.
  }
}

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
  provider: DEFAULT_PROVIDER,
  dialCode: '+880',
  number: '',
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
      secrets[provider.id] = {
        ...DEFAULT_SECRETS[provider.id],
        ...(saved.secrets?.[provider.id] ?? {}),
      };
    }
    return { ...DEFAULT_SETTINGS, ...saved, secrets };
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

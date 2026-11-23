import { DEFAULT_PROVIDER, PROVIDERS } from './providers';

export const STORAGE_KEY = 'callerid-lookup:settings:v1';

export const COUNTRIES = [
  { code: '+880', label: 'Bangladesh (+880)', placeholder: '017XX XXX XXX' },
  { code: '+91', label: 'India (+91)', placeholder: 'XXXXXXXXXX' },
  { code: '+92', label: 'Pakistan (+92)', placeholder: '3XXXXXXXXX' },
  { code: '+977', label: 'Nepal (+977)', placeholder: '9XXXXXXXXX' },
  { code: '+94', label: 'Sri Lanka (+94)', placeholder: '7XXXXXXXX' },
  { code: '+1', label: 'USA / Canada (+1)', placeholder: 'XXXXXXXXXX' },
  { code: '+44', label: 'UK (+44)', placeholder: '7XXXXXXXXX' },
  { code: '+61', label: 'Australia (+61)', placeholder: '4XXXXXXXXX' },
  { code: '+971', label: 'UAE (+971)', placeholder: '5XXXXXXXXX' },
  { code: '+966', label: 'Saudi Arabia (+966)', placeholder: '5XXXXXXXXX' },
  { code: '', label: 'Custom / full number', placeholder: '+880 17XX XXX XXX' },
];

const DEFAULT_SECRETS = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, { ...(provider.DEFAULT_SECRETS ?? {}) }])
);

export const DEFAULT_SETTINGS = {
  provider: DEFAULT_PROVIDER,
  dialCode: '+880',
  number: '',
  mode: 'callerid',
  lang: 'en',
  source: 'callerid-web',
  proxyTemplate: '',
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

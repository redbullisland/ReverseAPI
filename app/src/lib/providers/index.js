import * as eyecon from './eyecon';
import * as truecaller from './truecaller';

export const PROVIDERS = [eyecon, truecaller];
export const DEFAULT_PROVIDER = eyecon.id;

export function getProvider(id) {
  return PROVIDERS.find((provider) => provider.id === id) ?? eyecon;
}

export async function lookup(providerId, payload) {
  const provider = getProvider(providerId);
  const result = await provider.lookup(payload);
  return { ...result, provider: provider.id };
}

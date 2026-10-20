const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}
export function randomToken(): string { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export async function digest(value: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function challenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
}
async function encryptionKey(secret: string, clientId: string) {
  if (!secret || !clientId) throw new Error('Missing encryption configuration');
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(clientId), info: encoder.encode('cabosystems-google-calendar-v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
// A random IV and authenticated purpose prevent token/verifier substitution.
// Rotating the Google client secret requires reconnecting this integration.
export async function seal(value: string, secret: string, clientId: string, purpose: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) }, await encryptionKey(secret, clientId), encoder.encode(value));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(cipher))}`;
}
export async function unseal(value: string, secret: string, clientId: string, purpose: string): Promise<string> {
  const [version, iv, cipher, extra] = value.split('.');
  if (version !== 'v1' || !iv || !cipher || extra) throw new Error('Invalid encrypted credential');
  const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: encoder.encode(purpose) }, await encryptionKey(secret, clientId), decode(cipher));
  return new TextDecoder().decode(result);
}

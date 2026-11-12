/** Encode UTF-8 string to base64url (no padding). */
export function encodeBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode base64url to UTF-8 string. Returns null on invalid input. */
export function decodeBase64Url(encoded) {
  if (typeof encoded !== 'string' || encoded.length === 0) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  const pad = (4 - (encoded.length % 4)) % 4;
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export const MAX_SIGNALING_CHARS = 32768;

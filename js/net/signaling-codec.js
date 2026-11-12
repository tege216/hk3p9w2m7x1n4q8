import {
  decodeBase64Url,
  encodeBase64Url,
  MAX_SIGNALING_CHARS,
} from '../util/base64url.js';

const FRAGMENT_PREFIX = 'v1=';

/** @typedef {{ v: 1, kind: 'offer'|'answer', sdp: string, iceComplete: boolean, meta: { gameId: string, nick?: string, roleHint?: string } }} SignalingPayload */

export function randomGameId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {SignalingPayload} payload
 * @returns {string}
 */
export function encodeSignaling(payload) {
  const json = JSON.stringify(payload);
  return encodeBase64Url(json);
}

/**
 * @param {string} raw
 * @returns {{ ok: true, payload: SignalingPayload } | { ok: false }}
 */
export function decodeSignaling(raw) {
  if (typeof raw !== 'string') return { ok: false };
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SIGNALING_CHARS) {
    return { ok: false };
  }
  let b64 = trimmed;
  if (trimmed.includes('#')) {
    const hash = trimmed.slice(trimmed.indexOf('#') + 1);
    if (hash.startsWith(FRAGMENT_PREFIX)) {
      b64 = hash.slice(FRAGMENT_PREFIX.length);
    }
  }
  const json = decodeBase64Url(b64);
  if (!json) return { ok: false };
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    return { ok: false };
  }
  if (!validatePayload(obj)) return { ok: false };
  return { ok: true, payload: obj };
}

/** @param {unknown} obj */
function validatePayload(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const p = /** @type {Record<string, unknown>} */ (obj);
  if (p.v !== 1) return false;
  if (p.kind !== 'offer' && p.kind !== 'answer') return false;
  if (typeof p.sdp !== 'string' || p.sdp.length < 10) return false;
  if (typeof p.iceComplete !== 'boolean') return false;
  if (!p.meta || typeof p.meta !== 'object') return false;
  const meta = /** @type {Record<string, unknown>} */ (p.meta);
  if (typeof meta.gameId !== 'string' || !/^[a-f0-9]{32}$/.test(meta.gameId)) {
    return false;
  }
  if (meta.nick != null && typeof meta.nick !== 'string') return false;
  return true;
}

/**
 * @param {string} base64Payload
 * @returns {string}
 */
export function inviteUrl(base64Payload) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#${FRAGMENT_PREFIX}${base64Payload}`;
}

export function readInviteFromFragment() {
  const hash = location.hash;
  if (!hash.startsWith(`#${FRAGMENT_PREFIX}`)) return null;
  const b64 = hash.slice(`#${FRAGMENT_PREFIX}`.length);
  return decodeSignaling(b64);
}

export function clearFragmentFromUrl() {
  history.replaceState(null, '', location.pathname + location.search);
}

export const ICE_GATHER_TIMEOUT_MS = 18000;

/** Default STUN — verify provider terms before production use. */
export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * @param {RTCPeerConnection} pc
 * @returns {Promise<{ sdp: string, iceComplete: boolean }>}
 */
export function waitForIceGathering(pc) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (iceComplete) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onState);
      const desc = pc.localDescription;
      if (!desc?.sdp) {
        resolve({ sdp: '', iceComplete: false });
        return;
      }
      resolve({ sdp: desc.sdp, iceComplete });
    };
    const onState = () => {
      if (pc.iceGatheringState === 'complete') finish(true);
    };
    pc.addEventListener('icegatheringstatechange', onState);
    if (pc.iceGatheringState === 'complete') {
      finish(true);
      return;
    }
    const timer = setTimeout(() => finish(false), ICE_GATHER_TIMEOUT_MS);
  });
}

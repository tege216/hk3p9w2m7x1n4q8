import { MAX_SIGNALING_CHARS } from '../js/util/base64url.js';
import {
  decodeSignaling,
  encodeSignaling,
} from '../js/net/signaling-codec.js';

const payload = {
  v: 1,
  kind: 'offer',
  sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n',
  iceComplete: true,
  meta: { gameId: 'a'.repeat(32), roleHint: 'host' },
};

const enc = encodeSignaling(payload);
const dec = decodeSignaling(enc);
if (!dec.ok) throw new Error('roundtrip failed');
if (dec.payload.meta.gameId !== payload.meta.gameId) throw new Error('gameId mismatch');

const bad = decodeSignaling('!!!');
if (bad.ok) throw new Error('should reject bad');
if (decodeSignaling('x'.repeat(MAX_SIGNALING_CHARS + 1)).ok) {
  throw new Error('should reject long');
}

console.log('signaling tests ok');

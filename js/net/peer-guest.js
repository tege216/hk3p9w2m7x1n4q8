import { decodeSignaling, encodeSignaling, waitForIceGathering } from './signaling-codec.js';
import { createPeerConnection, waitForRemoteDataChannel } from './peer-common.js';

/**
 * @param {import('./signaling-codec.js').SignalingPayload} offerPayload
 * @param {{ nick?: string, onStatus?: (s: string) => void, onIce?: (s: RTCIceConnectionState) => void }} opts
 */
export async function createGuestAnswer(offerPayload, opts = {}) {
  if (offerPayload.kind !== 'offer') {
    throw new Error('invalid_offer');
  }
  const gameId = offerPayload.meta.gameId;
  const pc = createPeerConnection();

  opts.onStatus?.('Offerを適用中…');
  await pc.setRemoteDescription({ type: 'offer', sdp: offerPayload.sdp });

  opts.onStatus?.('Answerを作成中…');
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  opts.onStatus?.('ICE候補を収集中…');
  const { sdp, iceComplete } = await waitForIceGathering(pc);

  const payload = {
    v: 1,
    kind: 'answer',
    sdp,
    iceComplete,
    meta: { gameId, nick: opts.nick, roleHint: 'guest' },
  };
  const encoded = encodeSignaling(payload);

  const channelPromise = waitForRemoteDataChannel(pc, opts.onIce);

  return {
    gameId,
    pc,
    encoded,
    iceComplete,
    waitConnected: async () => {
      opts.onStatus?.('接続を確立中…');
      const dc = await channelPromise;
      return { pc, dc };
    },
  };
}

/**
 * @param {string} raw
 */
export function parseOfferInput(raw) {
  return decodeSignaling(raw);
}

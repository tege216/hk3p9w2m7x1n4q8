import { decodeSignaling, encodeSignaling, inviteUrl, randomGameId, waitForIceGathering } from './signaling-codec.js';
import {
  createPeerConnection,
  DATA_CHANNEL_LABEL,
  waitForChannelOpen,
} from './peer-common.js';

/**
 * @param {{ nick?: string, onStatus?: (s: string) => void, onIce?: (s: RTCIceConnectionState) => void }} opts
 */
export async function createHostInvite(opts = {}) {
  const gameId = randomGameId();
  const pc = createPeerConnection();
  const dc = pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });

  opts.onStatus?.('ICE候補を収集中…');

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const { sdp, iceComplete } = await waitForIceGathering(pc);

  const payload = {
    v: 1,
    kind: 'offer',
    sdp,
    iceComplete,
    meta: { gameId, nick: opts.nick, roleHint: 'host' },
  };
  const encoded = encodeSignaling(payload);
  const url = inviteUrl(encoded);

  return {
    gameId,
    pc,
    dc,
    encoded,
    inviteUrl: url,
    iceComplete,
    applyAnswer: (answerText) =>
      applyHostAnswer(pc, dc, gameId, answerText, opts),
  };
}

/**
 * @param {RTCPeerConnection} pc
 * @param {RTCDataChannel} dc
 * @param {string} expectedGameId
 * @param {string} answerRaw
 * @param {{ onStatus?: (s: string) => void, onIce?: (s: RTCIceConnectionState) => void }} opts
 */
async function applyHostAnswer(pc, dc, expectedGameId, answerRaw, opts) {
  const decoded = decodeSignaling(answerRaw);
  if (!decoded.ok) {
    throw new Error('invalid_answer');
  }
  const { payload } = decoded;
  if (payload.kind !== 'answer') throw new Error('invalid_answer');
  if (payload.meta.gameId !== expectedGameId) throw new Error('game_mismatch');

  opts.onStatus?.('接続を確立中…');
  await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });

  const channel = await waitForChannelOpen(dc, pc, opts.onIce);

  return { pc, dc: channel, iceComplete: payload.iceComplete };
}

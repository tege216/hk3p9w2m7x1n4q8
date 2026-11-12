import { RTC_CONFIG } from './signaling-codec.js';

export const DATA_CHANNEL_LABEL = 'othello-v1';

/**
 * @returns {RTCPeerConnection}
 */
export function createPeerConnection() {
  return new RTCPeerConnection(RTC_CONFIG);
}

/**
 * @param {RTCDataChannel} dc
 * @param {RTCPeerConnection} pc
 * @param {(state: RTCIceConnectionState) => void} [onIceState]
 */
export function waitForChannelOpen(dc, pc, onIceState) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('datachannel_timeout')), 60000);
    const onIce = () => onIceState?.(pc.iceConnectionState);
    pc.addEventListener('iceconnectionstatechange', onIce);
    const finish = () => {
      clearTimeout(timeout);
      pc.removeEventListener('iceconnectionstatechange', onIce);
      resolve(dc);
    };
    if (dc.readyState === 'open') {
      finish();
      return;
    }
    dc.addEventListener('open', finish, { once: true });
    dc.addEventListener(
      'error',
      () => {
        clearTimeout(timeout);
        reject(new Error('datachannel_error'));
      },
      { once: true }
    );
  });
}

/**
 * @param {RTCPeerConnection} pc
 * @param {(state: RTCIceConnectionState) => void} [onIceState]
 * @returns {Promise<RTCDataChannel>}
 */
export function waitForRemoteDataChannel(pc, onIceState) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) reject(new Error('datachannel_timeout'));
    }, 60000);

    pc.addEventListener('iceconnectionstatechange', () => {
      onIceState?.(pc.iceConnectionState);
    });

    const attach = (dc) => {
      if (resolved) return;
      if (dc.readyState === 'open') {
        resolved = true;
        clearTimeout(timeout);
        resolve(dc);
        return;
      }
      dc.addEventListener('open', () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        resolve(dc);
      });
    };

    pc.addEventListener('datachannel', (ev) => attach(ev.channel));
  });
}

/**
 * @param {RTCDataChannel} dc
 * @param {(msg: unknown) => void} onMessage
 */
export function bindChannelJson(dc, onMessage) {
  dc.addEventListener('message', (ev) => {
    if (typeof ev.data !== 'string') return;
    for (const line of ev.data.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        onMessage(JSON.parse(t));
      } catch {
        console.warn('invalid channel message');
      }
    }
  });
}

export function sendJson(dc, obj) {
  if (dc.readyState !== 'open') return false;
  dc.send(JSON.stringify(obj) + '\n');
  return true;
}

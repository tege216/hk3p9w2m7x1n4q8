import {
  applyMove,
  checkGameEnd,
  createInitialBoard,
  deserializeBoard,
  legalMoves,
  opponent,
  serializeBoard,
  BLACK,
  WHITE,
} from '../game/othello.js';
import { boardHash, hostColor, guestColor } from '../game/sync.js';
import { bindChannelJson, sendJson } from './peer-common.js';

const PROTOCOL = 1;

/**
 * @typedef {Object} GameSessionState
 * @property {import('../game/othello.js').Cell[][]} board
 * @property {'black'|'white'} turn
 * @property {number} seq
 * @property {number} passStreak
 * @property {boolean} gameOver
 * @property {'black'|'white'|'draw'|null} winner
 */

/**
 * @param {boolean} isHost
 * @param {string} gameId
 * @param {RTCDataChannel} dc
 * @param {{ onState: (s: GameSessionState) => void, onError: (code: string) => void, onDisconnect: () => void }} callbacks
 */
export function createGameSession(isHost, gameId, dc, callbacks) {
  /** @type {GameSessionState} */
  let state = {
    board: createInitialBoard(),
    turn: BLACK,
    seq: 0,
    passStreak: 0,
    gameOver: false,
    winner: null,
  };

  const myColor = isHost ? hostColor() : guestColor();
  const clientId = crypto.randomUUID();

  bindChannelJson(dc, (msg) => {
    handleMessage(msg).catch((e) => {
      console.error(e);
      callbacks.onError('sync');
    });
  });

  dc.addEventListener('close', () => callbacks.onDisconnect());
  dc.addEventListener('error', () => callbacks.onDisconnect());

  async function emitState() {
    callbacks.onState({ ...state, board: state.board.map((r) => r.slice()) });
  }

  async function sendSync() {
    if (!isHost) return;
    const hash = await boardHash(
      state.board,
      state.turn,
      state.seq,
      state.passStreak
    );
    sendJson(dc, {
      v: PROTOCOL,
      type: 'sync',
      gameId,
      board: serializeBoard(state.board),
      turn: state.turn,
      seq: state.seq,
      passStreak: state.passStreak,
      hash,
    });
  }

  async function handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    const m = /** @type {Record<string, unknown>} */ (msg);
    if (m.v !== PROTOCOL) return;

    switch (m.type) {
      case 'hello': {
        if (isHost) {
          await sendSync();
        }
        return;
      }
      case 'sync': {
        if (isHost) return;
        state.board = deserializeBoard(/** @type {number[][]} */ (m.board));
        state.turn = /** @type {'black'|'white'} */ (m.turn);
        state.seq = Number(m.seq);
        state.passStreak = Number(m.passStreak);
        const hash = await boardHash(
          state.board,
          state.turn,
          state.seq,
          state.passStreak
        );
        if (m.hash && m.hash !== hash) {
          sendJson(dc, { v: PROTOCOL, type: 'resyncRequest' });
          return;
        }
        sendJson(dc, {
          v: PROTOCOL,
          type: 'syncAck',
          seq: state.seq,
          hash,
        });
        await checkEndAndEmit();
        return;
      }
      case 'syncAck': {
        if (!isHost) return;
        return;
      }
      case 'move': {
        const x = Number(m.x);
        const y = Number(m.y);
        const seq = Number(m.seq);
        if (isHost) {
          if (seq !== state.seq + 1) {
            sendJson(dc, {
              v: PROTOCOL,
              type: 'moveReject',
              reason: 'seq',
              seq: state.seq,
            });
            await sendSync();
            return;
          }
          if (state.turn !== guestColor()) {
            sendJson(dc, {
              v: PROTOCOL,
              type: 'moveReject',
              reason: 'turn',
              seq: state.seq,
            });
            return;
          }
          const next = applyMove(state.board, x, y, state.turn);
          if (!next) {
            sendJson(dc, {
              v: PROTOCOL,
              type: 'moveReject',
              reason: 'illegal',
              seq: state.seq,
            });
            return;
          }
          state.board = next;
          state.seq = seq;
          state.passStreak = 0;
          state.turn = opponent(state.turn);
          await afterMoveHost();
        } else {
          /* guest already applied locally when sending */
        }
        return;
      }
      case 'moveReject': {
        if (isHost) return;
        callbacks.onError('move_rejected');
        sendJson(dc, { v: PROTOCOL, type: 'resyncRequest' });
        return;
      }
      case 'pass': {
        const seq = Number(m.seq);
        if (!isHost) return;
        if (seq !== state.seq + 1 || state.turn !== guestColor()) {
          await sendSync();
          return;
        }
        state.seq = seq;
        state.passStreak += 1;
        state.turn = opponent(state.turn);
        await afterMoveHost(true);
        return;
      }
      case 'resyncRequest': {
        if (isHost) await sendSync();
        return;
      }
      case 'gameOver': {
        state.gameOver = true;
        state.winner = /** @type {'black'|'white'|'draw'} */ (m.winner);
        await emitState();
        return;
      }
      default:
        break;
    }
  }

  async function afterMoveHost(fromPass = false) {
    const end = checkGameEnd(state.board, state.turn);
    if (end.ended) {
      state.gameOver = true;
      state.winner = end.winner ?? null;
      sendJson(dc, {
        v: PROTOCOL,
        type: 'gameOver',
        winner: state.winner,
        reason: end.reason,
      });
    } else if (!fromPass && legalMoves(state.board, state.turn).length === 0) {
      /* single pass — host applies pass for current turn if no moves */
      state.passStreak += 1;
      state.turn = opponent(state.turn);
      if (state.passStreak >= 2) {
        const e2 = checkGameEnd(state.board, state.turn);
        state.gameOver = true;
        state.winner = e2.winner ?? null;
        sendJson(dc, {
          v: PROTOCOL,
          type: 'gameOver',
          winner: state.winner,
          reason: 'pass',
        });
      }
    }
    await sendSync();
    await emitState();
  }

  async function checkEndAndEmit() {
    await emitState();
  }

  sendJson(dc, {
    v: PROTOCOL,
    type: 'hello',
    gameId,
    protocol: PROTOCOL,
    clientId,
    nick: null,
  });

  if (isHost) {
    sendSync().then(() => emitState());
  }

  return {
    getState: () => state,
    myColor,
    isHost,
    async tryMove(x, y) {
      if (state.gameOver) return false;
      if (state.turn !== myColor) return false;
      const moves = legalMoves(state.board, state.turn);
      if (!moves.some((m) => m.x === x && m.y === y)) return false;

      if (isHost) {
        const next = applyMove(state.board, x, y, state.turn);
        if (!next) return false;
        state.board = next;
        state.seq += 1;
        state.passStreak = 0;
        state.turn = opponent(state.turn);
        await afterMoveHost();
        return true;
      }

      const prevHash = await boardHash(
        state.board,
        state.turn,
        state.seq,
        state.passStreak
      );
      const next = applyMove(state.board, x, y, state.turn);
      if (!next) return false;
      state.board = next;
      const newSeq = state.seq + 1;
      sendJson(dc, {
        v: PROTOCOL,
        type: 'move',
        x,
        y,
        seq: newSeq,
        prevHash,
      });
      state.seq = newSeq;
      state.passStreak = 0;
      state.turn = opponent(state.turn);
      await emitState();
      return true;
    },
    async passTurn() {
      if (state.gameOver || state.turn !== myColor) return false;
      if (legalMoves(state.board, state.turn).length > 0) return false;

      if (isHost) {
        state.seq += 1;
        state.passStreak += 1;
        state.turn = opponent(state.turn);
        await afterMoveHost(true);
        return true;
      }

      sendJson(dc, {
        v: PROTOCOL,
        type: 'pass',
        seq: state.seq + 1,
      });
      state.seq += 1;
      state.passStreak += 1;
      state.turn = opponent(state.turn);
      await emitState();
      return true;
    },
  };
}

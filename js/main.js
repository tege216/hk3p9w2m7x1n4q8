import { createHostInvite } from './net/peer-host.js';
import { createGuestAnswer, parseOfferInput } from './net/peer-guest.js';
import { createGameSession } from './net/channel-protocol.js';
import {
  clearFragmentFromUrl,
  encodeSignaling,
  readInviteFromFragment,
} from './net/signaling-codec.js';
import { copyText } from './util/clipboard.js';
import { createBoardView, formatScore } from './ui/board.js';
import { createScreenHost, setStatus, showError } from './ui/screens.js';
import { legalMoves } from './game/othello.js';

/** @type {RTCPeerConnection|null} */
let activePc = null;
/** @type {ReturnType<typeof createHostInvite>|null} */
let hostSession = null;
/** @type {ReturnType<typeof createGameSession>|null} */
let gameSession = null;

const app = document.getElementById('app');
if (!app) throw new Error('missing #app');

const screens = createScreenHost(app);
screens.show('home');

function teardownPeer() {
  gameSession = null;
  if (activePc) {
    try {
      activePc.close();
    } catch {
      /* ignore */
    }
  }
  activePc = null;
  hostSession = null;
}

function goDisconnected(reason) {
  teardownPeer();
  screens.show('disconnected');
  const el = screens.$('disconnected', '[data-field="reason"]');
  if (el) el.textContent = reason;
}

function iceWarning(iceComplete) {
  if (iceComplete) return '';
  return 'ICE候補の収集が完了していない可能性があります。接続に失敗したら、20秒ほど待ってから招待を作り直してください。';
}

function startGame(isHost, gameId, dc) {
  screens.show('game');
  const boardWrap = screens.$('game', '[data-field="board"]');
  if (!boardWrap) return;

  const boardView = createBoardView(boardWrap, {
    onCellClick: (x, y) => {
      gameSession?.tryMove(x, y);
    },
  });

  const turnInfo = screens.$('game', '[data-field="turnInfo"]');
  const scoreEl = screens.$('game', '[data-field="score"]');
  const msgEl = screens.$('game', '[data-field="gameMessage"]');
  const connDot = screens.$('game', '[data-field="connDot"]');
  const passBtn = screens.$('game', '[data-action="pass"]');

  passBtn?.addEventListener('click', () => {
    gameSession?.passTurn();
  });

  const session = createGameSession(isHost, gameId, dc, {
    onState: (state) => {
      const gs = gameSession;
      if (!gs) return;
      const my = gs.myColor;
      boardView.render(state.board, state.turn, my, state.gameOver);
      const { black, white } = formatScore(state.board);
      if (scoreEl) scoreEl.textContent = `黒 ${black} ／ 白 ${white}`;
      if (turnInfo) {
        if (state.gameOver) {
          const w = state.winner;
          turnInfo.textContent =
            w === 'draw'
              ? '引き分け'
              : w === 'black'
                ? '黒の勝ち'
                : '白の勝ち';
        } else {
          turnInfo.textContent =
            state.turn === my ? 'あなたの手番' : '相手の手番';
        }
      }
      if (msgEl && !state.gameOver) {
        const canPass =
          state.turn === my && legalMoves(state.board, state.turn).length === 0;
        msgEl.textContent = canPass ? 'パスしかありません' : '';
      }
      if (passBtn) {
        passBtn.disabled =
          state.gameOver ||
          state.turn !== my ||
          legalMoves(state.board, state.turn).length > 0;
      }
    },
    onError: () => {
      if (msgEl) msgEl.textContent = '同期エラー。状態を再送しています…';
    },
    onDisconnect: () => goDisconnected('接続が切断されました。'),
  });
  gameSession = session;

  if (connDot) connDot.classList.add('online');
}

app.addEventListener('click', async (ev) => {
  const t = ev.target;
  if (!(t instanceof HTMLElement)) return;
  const action = t.getAttribute('data-action');
  if (!action) return;

  switch (action) {
    case 'play':
      screens.show('role');
      break;
    case 'backHome':
      screens.show('home');
      break;
    case 'backRole':
      teardownPeer();
      screens.show('role');
      break;
    case 'host':
      screens.show('hostSetup');
      break;
    case 'guest':
      screens.show('guestJoin');
      break;
    case 'createInvite':
      await onCreateInvite();
      break;
    case 'copyInvite':
      await copyInviteField('[data-field="inviteUrl"]');
      break;
    case 'copyCode':
      await copyInviteField('[data-field="inviteCode"]');
      break;
    case 'submitAnswer':
      await onSubmitAnswer();
      break;
    case 'cancelHost':
      teardownPeer();
      screens.show('role');
      break;
    case 'loadInvite':
      await onLoadInvite();
      break;
    case 'copyAnswer':
      await copyInviteField('[data-field="answerOut"]');
      break;
    case 'newGame':
      teardownPeer();
      screens.show('home');
      break;
    default:
      break;
  }
});

async function copyInviteField(sel) {
  const el = screens.$(screens.current, sel);
  if (!(el instanceof HTMLTextAreaElement)) return;
  const ok = await copyText(el.value);
  if (!ok) {
    el.select();
  }
}

async function onCreateInvite() {
  const nickEl = screens.$('hostSetup', '[data-field="nick"]');
  const nick =
    nickEl instanceof HTMLInputElement ? nickEl.value.trim() : undefined;

  screens.show('hostWaiting');
  setStatus(screens, 'hostWaiting', '招待を作成中…');
  showError(screens, '[data-field="error"]', '');

  try {
    hostSession = await createHostInvite({
      nick: nick || undefined,
      onStatus: (s) => setStatus(screens, 'hostWaiting', s),
    });
    activePc = hostSession.pc;

    const urlEl = screens.$('hostWaiting', '[data-field="inviteUrl"]');
    const codeEl = screens.$('hostWaiting', '[data-field="inviteCode"]');
    if (urlEl instanceof HTMLTextAreaElement) urlEl.value = hostSession.inviteUrl;
    if (codeEl instanceof HTMLTextAreaElement) codeEl.value = hostSession.encoded;

    const warn = screens.$('hostWaiting', '[data-field="iceWarn"]');
    if (warn) {
      const msg = iceWarning(hostSession.iceComplete);
      warn.textContent = msg;
      warn.hidden = !msg;
    }
    setStatus(
      screens,
      'hostWaiting',
      '友人にURLまたはコードを送り、返答が届いたら貼り付けてください。このページは閉じないでください。'
    );
  } catch (e) {
    console.error(e);
    showError(screens, '[data-field="error"]', '招待の作成に失敗しました。');
  }
}

async function onSubmitAnswer() {
  if (!hostSession) return;
  const paste = screens.$('hostWaiting', '[data-field="answerPaste"]');
  if (!(paste instanceof HTMLTextAreaElement)) return;
  showError(screens, '[data-field="error"]', '');
  screens.show('connecting');
  setStatus(screens, 'connecting', '返答を適用中…');

  try {
    const { dc } = await hostSession.applyAnswer(paste.value, {
      onStatus: (s) => setStatus(screens, 'connecting', s),
      onIce: (s) => {
        if (s === 'failed') {
          setStatus(
            screens,
            'connecting',
            '接続に失敗しました。ネットワークを変えるか、招待を作り直してください。'
          );
        }
      },
    });
    startGame(true, hostSession.gameId, dc);
  } catch (e) {
    console.error(e);
    screens.show('hostWaiting');
    showError(
      screens,
      '[data-field="error"]',
      '返答を適用できませんでした。内容が欠けていないか確認してください。'
    );
  }
}

async function onLoadInvite() {
  const input = screens.$('guestJoin', '[data-field="inviteInput"]');
  if (!(input instanceof HTMLTextAreaElement)) return;
  showError(screens, '[data-field="error"]', '');

  const parsed = parseOfferInput(input.value);
  if (!parsed.ok || parsed.payload.kind !== 'offer') {
    showError(
      screens,
      '[data-field="error"]',
      '招待の形式が正しくありません。'
    );
    return;
  }

  setStatus(screens, 'guestJoin', '返答を作成中…');
  try {
    teardownPeer();
    const guest = await createGuestAnswer(parsed.payload, {
      onStatus: (s) => setStatus(screens, 'guestJoin', s),
    });
    activePc = guest.pc;

    const out = screens.$('guestJoin', '[data-field="answerOut"]');
    if (out instanceof HTMLTextAreaElement) out.value = guest.encoded;

    const warn = screens.$('guestJoin', '[data-field="iceWarn"]');
    if (warn) {
      const msg = iceWarning(guest.iceComplete);
      warn.textContent = msg;
      warn.hidden = !msg;
    }

    setStatus(
      screens,
      'guestJoin',
      '返答をコピーして友人（A）の画面に貼り付けてもらってください。接続完了までこのページを開いたままにしてください。'
    );

    const { dc } = await guest.waitConnected();
    startGame(false, guest.gameId, dc);
  } catch (e) {
    console.error(e);
    screens.show('guestJoin');
    showError(screens, '[data-field="error"]', '参加処理に失敗しました。');
  }
}

async function initFromFragment() {
  const fromHash = readInviteFromFragment();
  if (!fromHash?.ok || fromHash.payload.kind !== 'offer') return;

  clearFragmentFromUrl();
  screens.show('guestJoin');
  const input = screens.$('guestJoin', '[data-field="inviteInput"]');
  const code = encodeSignaling(fromHash.payload);
  if (input instanceof HTMLTextAreaElement) input.value = code;
  await onLoadInvite();
}

initFromFragment().catch(console.error);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && activePc) {
    /* keep connection */
  }
});

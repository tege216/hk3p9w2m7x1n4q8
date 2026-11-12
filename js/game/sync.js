import { BLACK, serializeBoard } from './othello.js';

/**
 * @param {import('./othello.js').Cell[][]} board
 * @param {'black'|'white'} turn
 * @param {number} seq
 * @param {number} passStreak
 */
export async function boardHash(board, turn, seq, passStreak) {
  const payload = JSON.stringify({
    board: serializeBoard(board),
    turn,
    seq,
    passStreak,
  });
  const buf = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 16);
}

/** Host (invite creator) plays black. */
export function hostColor() {
  return BLACK;
}

export function guestColor() {
  return 'white';
}

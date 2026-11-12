/** @typedef {'empty'|'black'|'white'} Cell */
/** @typedef {'black'|'white'} Color */

export const BOARD_SIZE = 8;
export const EMPTY = 'empty';
export const BLACK = 'black';
export const WHITE = 'white';

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

/** @returns {Cell[][]} */
export function createInitialBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(EMPTY)
  );
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

/** @param {Cell[][]} board */
function inBounds(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

/** @param {Cell[][]} board @param {Color} color */
export function opponent(color) {
  return color === BLACK ? WHITE : BLACK;
}

/**
 * @param {Cell[][]} board
 * @param {number} x
 * @param {number} y
 * @param {Color} color
 * @returns {boolean}
 */
export function wouldFlip(board, x, y, color) {
  if (!inBounds(x, y) || board[y][x] !== EMPTY) return false;
  const opp = opponent(color);
  for (const [dx, dy] of DIRS) {
    let cx = x + dx;
    let cy = y + dy;
    let seenOpp = false;
    while (inBounds(cx, cy) && board[cy][cx] === opp) {
      seenOpp = true;
      cx += dx;
      cy += dy;
    }
    if (seenOpp && inBounds(cx, cy) && board[cy][cx] === color) {
      return true;
    }
  }
  return false;
}

/**
 * @param {Cell[][]} board
 * @param {Color} color
 * @returns {{x:number,y:number}[]}
 */
export function legalMoves(board, color) {
  const moves = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (wouldFlip(board, x, y, color)) moves.push({ x, y });
    }
  }
  return moves;
}

/**
 * @param {Cell[][]} board
 * @param {number} x
 * @param {number} y
 * @param {Color} color
 * @returns {Cell[][]|null}
 */
export function applyMove(board, x, y, color) {
  if (!wouldFlip(board, x, y, color)) return null;
  const next = board.map((row) => row.slice());
  next[y][x] = color;
  const opp = opponent(color);
  for (const [dx, dy] of DIRS) {
    let cx = x + dx;
    let cy = y + dy;
    const toFlip = [];
    while (inBounds(cx, cy) && next[cy][cx] === opp) {
      toFlip.push([cx, cy]);
      cx += dx;
      cy += dy;
    }
    if (toFlip.length > 0 && inBounds(cx, cy) && next[cy][cx] === color) {
      for (const [fx, fy] of toFlip) {
        next[fy][fx] = color;
      }
    }
  }
  return next;
}

/** @param {Cell[][]} board */
export function countStones(board) {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const c of row) {
      if (c === BLACK) black++;
      else if (c === WHITE) white++;
    }
  }
  return { black, white };
}

/**
 * @param {Cell[][]} board
 * @param {Color} turn
 * @returns {{ ended: boolean, winner?: Color|'draw', reason?: string }}
 */
export function checkGameEnd(board, turn) {
  const moves = legalMoves(board, turn);
  if (moves.length > 0) {
    return { ended: false };
  }
  const oppMoves = legalMoves(board, opponent(turn));
  if (oppMoves.length > 0) {
    return { ended: false };
  }
  const { black, white } = countStones(board);
  if (black > white) return { ended: true, winner: BLACK, reason: 'stones' };
  if (white > black) return { ended: true, winner: WHITE, reason: 'stones' };
  return { ended: true, winner: 'draw', reason: 'stones' };
}

/** Serialize board for sync: rows of 0/1/2 empty/black/white */
export function serializeBoard(board) {
  const map = { [EMPTY]: 0, [BLACK]: 1, [WHITE]: 2 };
  return board.map((row) => row.map((c) => map[c]));
}

/** @param {number[][]} data */
export function deserializeBoard(data) {
  const rev = ['empty', 'black', 'white'];
  return data.map((row) => row.map((n) => rev[n] ?? EMPTY));
}

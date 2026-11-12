import {
  applyMove,
  checkGameEnd,
  createInitialBoard,
  legalMoves,
  BLACK,
  WHITE,
  countStones,
} from '../js/game/othello.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  }
}

const board = createInitialBoard();
assert(legalMoves(board, BLACK).length === 4, 'initial black moves');
const next = applyMove(board, 2, 3, BLACK);
assert(next !== null, 'apply e3');
assert(next && countStones(next).black === 4, 'flip count');

let b = createInitialBoard();
b = applyMove(b, 2, 3, BLACK);
b = applyMove(b, 2, 2, WHITE);
assert(b !== null, 'white move');

const end = checkGameEnd(createInitialBoard(), BLACK);
assert(!end.ended, 'not ended at start');

if (failed) {
  process.exit(1);
}
console.log('othello tests ok');

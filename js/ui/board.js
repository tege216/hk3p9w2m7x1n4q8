import { legalMoves, countStones, BLACK, WHITE, EMPTY } from '../game/othello.js';

/**
 * @param {HTMLElement} container
 * @param {{ onCellClick: (x: number, y: number) => void }} handlers
 */
export function createBoardView(container, handlers) {
  container.innerHTML = '';
  container.classList.add('board');
  const cells = [];

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.dataset.x = String(x);
      btn.dataset.y = String(y);
      btn.setAttribute('aria-label', `マス ${x + 1}, ${y + 1}`);
      btn.addEventListener('click', () => handlers.onCellClick(x, y));
      container.appendChild(btn);
      cells.push(btn);
    }
  }

  /**
   * @param {import('../game/othello.js').Cell[][]} board
   * @param {'black'|'white'} turn
   * @param {'black'|'white'} myColor
   * @param {boolean} gameOver
   */
  function render(board, turn, myColor, gameOver) {
    const hints =
      !gameOver && turn === myColor
        ? new Set(
            legalMoves(board, turn).map((m) => `${m.x},${m.y}`)
          )
        : new Set();

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const idx = y * 8 + x;
        const btn = cells[idx];
        const v = board[y][x];
        btn.className = 'cell';
        if (v === BLACK) btn.classList.add('black');
        else if (v === WHITE) btn.classList.add('white');
        else btn.classList.add('empty');
        if (hints.has(`${x},${y}`)) btn.classList.add('hint');
        btn.disabled = gameOver || turn !== myColor || v !== EMPTY;
      }
    }
  }

  return { render };
}

/**
 * @param {import('../game/othello.js').Cell[][]} board
 */
export function formatScore(board) {
  const { black, white } = countStones(board);
  return { black, white };
}

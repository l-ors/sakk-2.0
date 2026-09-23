// A classic minimax engine with alpha-beta pruning.
//
// The search works on the real board array: every move is played, searched and
// then taken back. Inside the search a move that captures the Földesúr simply
// wins, which is how mate is found without slow legality checks.

const MATE_SCORE = 100000;
const KING_VALUE = 1000;

// --- What a position is worth ----------------------------------------------

// Seen from "color": bigger is better for that side
function evaluate(board, color) {
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      let worth = piece.type === "king" ? KING_VALUE : PIECES[piece.type].value;

      // Developed pieces (already off their own back row) are worth a little more
      if (piece.type !== "king" && r !== homeRow(piece.color)) worth += 0.2;

      // So are pieces near the middle columns
      worth += 0.04 * (COLS / 2 - Math.abs(c - (COLS - 1) / 2));

      score += piece.color === color ? worth : -worth;
    }
  }

  return score;
}

// --- Moves -----------------------------------------------------------------

// Every move of one side, captures first so alpha-beta can cut earlier
function engineMoves(board, color) {
  const moves = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;

      for (const move of getMoves(board, r, c)) {
        const target = board[move.row][move.col];
        moves.push({
          from: { row: r, col: c },
          to: { row: move.row, col: move.col },
          gain: target ? (target.type === "king" ? KING_VALUE : PIECES[target.type].value) : 0
        });
      }
    }
  }

  moves.sort((a, b) => b.gain - a.gain);
  return moves;
}

// Plays a move and remembers everything needed to take it back
function playMove(board, move) {
  const piece = board[move.from.row][move.from.col];
  const memo = { piece: piece, captured: board[move.to.row][move.to.col], type: piece.type, moved: piece.moved };

  board[move.to.row][move.to.col] = piece;
  board[move.from.row][move.from.col] = null;
  piece.moved = true;

  // In the search a Jobbágy always becomes a Földesúrnő
  if (piece.type === "pawn" && move.to.row === homeRow(enemyColor(piece.color))) piece.type = "queen";

  return memo;
}

function takeBackMove(board, move, memo) {
  memo.piece.type = memo.type;
  memo.piece.moved = memo.moved;
  board[move.from.row][move.from.col] = memo.piece;
  board[move.to.row][move.to.col] = memo.captured;
}

// --- The search ------------------------------------------------------------

function negamax(board, depth, alpha, beta, color) {
  if (depth === 0) return evaluate(board, color);

  const moves = engineMoves(board, color);
  if (moves.length === 0) return -MATE_SCORE;

  let best = -Infinity;

  for (const move of moves) {
    // Taking the Földesúr ends everything, no need to look further
    if (move.gain === KING_VALUE) return MATE_SCORE + depth;

    const memo = playMove(board, move);
    const score = -negamax(board, depth - 1, -beta, -alpha, enemyColor(color));
    takeBackMove(board, move, memo);

    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;   // the other side would never allow this
  }

  return best;
}

// Searches the real moves one by one, giving the page a breath between them
// so the progress bar can move. Calls onDone with the best move, or null.
function chooseEngineMove(board, color, depth, onProgress, onDone) {
  const moves = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      for (const move of getLegalMoves(board, r, c)) {
        const target = board[move.row][move.col];
        moves.push({
          from: { row: r, col: c },
          to: { row: move.row, col: move.col },
          gain: target ? PIECES[target.type].value : 0
        });
      }
    }
  }

  moves.sort((a, b) => b.gain - a.gain);

  if (moves.length === 0) {
    onProgress(1);
    onDone(null);
    return;
  }

  let index = 0;
  let best = moves[0];
  let bestScore = -Infinity;

  function searchNext() {
    const move = moves[index++];
    const memo = playMove(board, move);
    const score = -negamax(board, depth - 1, -Infinity, Infinity, enemyColor(color));
    takeBackMove(board, move, memo);

    if (score > bestScore) {
      bestScore = score;
      best = move;
    }

    onProgress(index / moves.length);

    if (index < moves.length) setTimeout(searchNext, 0);
    else onDone(best);
  }

  onProgress(0);
  setTimeout(searchNext, 0);
}

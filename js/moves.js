// Move generation: which squares can the piece at (row, col) go to?
// Returns a list of { row, col } targets.

function getMoves(board, row, col) {
  const piece = board[row][col];
  const def = PIECES[piece.type];
  const moves = [];

  // Single jumps (king, knight)
  if (def.steps) {
    for (const [dr, dc] of def.steps) {
      const r = row + dr;
      const c = col + dc;
      if (isInside(r, c) && (board[r][c] === null || board[r][c].color !== piece.color)) {
        moves.push({ row: r, col: c });
      }
    }
  }

  // Sliding (rook, bishop, queen): keep going until something blocks the way.
  // Some pieces have a limited range, and some bounce off the board edge like a ball.
  if (def.slides) {
    const range = def.range || Infinity;

    for (const [startDr, startDc] of def.slides) {
      let dr = startDr;
      let dc = startDc;
      let r = row;
      let c = col;

      for (let step = 0; step < range; step++) {
        // Bounce: flip the part of the direction that would leave the board
        if (def.bounce) {
          if (!isInside(r + dr, c)) dr = -dr;
          if (!isInside(r, c + dc)) dc = -dc;
        }

        r += dr;
        c += dc;
        if (!isInside(r, c)) break;

        const target = board[r][c];
        if (target === null) {
          moves.push({ row: r, col: c });
        } else {
          if (target.color !== piece.color) moves.push({ row: r, col: c });
          break;
        }
      }
    }
  }

  // Fixed routes (vadász): walk the steps one by one. The piece may stop only on
  // squares marked "stop", and anything standing in the way blocks the rest of the route.
  if (def.paths) {
    for (const path of def.paths) {
      let r = row;
      let c = col;

      for (const step of path) {
        r += step.dr;
        c += step.dc;
        if (!isInside(r, c)) break;

        const target = board[r][c];
        if (target === null) {
          if (step.stop) moves.push({ row: r, col: c });
        } else {
          if (step.stop && target.color !== piece.color) moves.push({ row: r, col: c });
          break;
        }
      }
    }
  }

  if (piece.type === "pawn") {
    addPawnMoves(board, row, col, piece, moves);
  }

  return moves;
}

// Every move of a piece, castling included. Use this one from the game.
function getAllMoves(board, row, col) {
  const moves = getMoves(board, row, col);

  if (board[row][col].type === "king") {
    for (const move of getCastlingMoves(board, row, col)) moves.push(move);
  }

  return moves;
}

// Every move that is also allowed: it must not leave your own Földesúr in check
function getLegalMoves(board, row, col) {
  return getAllMoves(board, row, col).filter(move => !leavesKingInCheck(board, row, col, move));
}

// Tries a move on the board, looks at the result, then takes it back
function leavesKingInCheck(board, row, col, move) {
  const piece = board[row][col];
  const captured = board[move.row][move.col];

  board[move.row][move.col] = piece;
  board[row][col] = null;

  const inCheck = isInCheck(board, piece.color);

  board[row][col] = piece;
  board[move.row][move.col] = captured;
  return inCheck;
}

// Does this side have any move left at all?
function hasAnyLegalMove(board, color) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color && getLegalMoves(board, r, c).length > 0) return true;
    }
  }
  return false;
}

function isInCheck(board, color) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color && piece.type === "king") {
        return isAttacked(board, r, c, enemyColor(color));
      }
    }
  }
  return false;
}

// Is the given square attacked by the given color?
function isAttacked(board, row, col, byColor) {
  // A fake enemy piece is put on the square, so pawn captures count too
  const original = board[row][col];
  board[row][col] = { type: "pawn", color: enemyColor(byColor), moved: true };

  let attacked = false;
  for (let r = 0; r < ROWS && !attacked; r++) {
    for (let c = 0; c < COLS && !attacked; c++) {
      const piece = board[r][c];
      if (piece && piece.color === byColor) {
        attacked = getMoves(board, r, c).some(m => m.row === row && m.col === col);
      }
    }
  }

  board[row][col] = original;
  return attacked;
}

// Castling: the Földesúr steps two squares towards a kovács in the corner and the
// kovács jumps to the far side of it. Rules: the Földesúr stands on its starting
// square, the squares in between are empty, and it is not in check now and does
// not cross or land on an attacked square. Earlier moves are forgiven.
function getCastlingMoves(board, row, col) {
  const king = board[row][col];
  const moves = [];
  const enemy = enemyColor(king.color);

  if (row !== homeRow(king.color) || col !== KING_COL) return moves;
  if (isAttacked(board, row, col, enemy)) return moves;

  const sides = [
    { rookCol: 0, dir: -1, rookType: "rookLeft" },
    { rookCol: COLS - 1, dir: 1, rookType: "rookRight" }
  ];

  for (const side of sides) {
    const rook = board[row][side.rookCol];
    if (!rook || rook.color !== king.color || rook.type !== side.rookType) continue;

    // Every square between the Földesúr and the kovács must be empty
    let free = true;
    for (let c = Math.min(col, side.rookCol) + 1; c < Math.max(col, side.rookCol); c++) {
      if (board[row][c] !== null) free = false;
    }
    if (!free) continue;

    // The two squares the Földesúr crosses must be safe
    if (isAttacked(board, row, col + side.dir, enemy)) continue;
    if (isAttacked(board, row, col + 2 * side.dir, enemy)) continue;

    moves.push({ row: row, col: col + 2 * side.dir });
  }

  return moves;
}

function addPawnMoves(board, row, col, piece, moves) {
  const forward = piece.color === "white" ? -1 : 1; // white moves up (towards row 0)

  // One square forward or backward
  for (const dir of [forward, -forward]) {
    if (isInside(row + dir, col) && board[row + dir][col] === null) {
      moves.push({ row: row + dir, col: col });
    }
  }

  // Two squares forward, only on the pawn's very first move and never backwards
  if (!piece.moved &&
      isInside(row + 2 * forward, col) &&
      board[row + forward][col] === null &&
      board[row + 2 * forward][col] === null) {
    moves.push({ row: row + 2 * forward, col: col });
  }

  // Diagonal captures, forward only
  for (const dc of [-1, 1]) {
    const r = row + forward;
    const c = col + dc;
    if (isInside(r, c) && board[r][c] !== null && board[r][c].color !== piece.color) {
      moves.push({ row: r, col: c });
    }
  }
}

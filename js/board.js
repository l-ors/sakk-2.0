// Board setup. The board is a 2D array: board[row][col] is either null
// or a piece object like { type: "pawn", color: "white", moved: false }.

const ROWS = 8;
const COLS = 10;

// Left and right are as seen on the screen, for both colors
const BACK_ROW = ["rookLeft", "vadasz", "knight", "bishop", "queen", "king", "bishop", "knight", "vadasz", "rookRight"];

function createPiece(type, color) {
  // moved: becomes true after the piece's first move (pawns may step two squares only before that)
  return { type: type, color: color, moved: false };
}

function createInitialBoard() {
  const board = [];
  for (let row = 0; row < ROWS; row++) {
    board.push(new Array(COLS).fill(null));
  }

  for (let col = 0; col < COLS; col++) {
    board[0][col] = createPiece(BACK_ROW[col], "black");
    board[1][col] = createPiece("pawn", "black");
    board[ROWS - 2][col] = createPiece("pawn", "white");
    board[ROWS - 1][col] = createPiece(BACK_ROW[col], "white");
  }

  return board;
}

// The row where a color's pieces start, and the column the Földesúr starts on
const KING_COL = BACK_ROW.indexOf("king");

function homeRow(color) {
  return color === "white" ? ROWS - 1 : 0;
}

function enemyColor(color) {
  return color === "white" ? "black" : "white";
}

function isInside(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

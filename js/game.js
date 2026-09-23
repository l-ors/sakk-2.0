// Game state, rendering and clicks. This file ties everything together.

const COLOR_NAMES = { white: "Világos", black: "Sötét" };

// What a Jobbágy may become on the far side (anything but the Földesúr)
const PROMOTION_CHOICES = ["queen", "rookLeft", "rookRight", "bishop", "knight", "vadasz"];

const state = {
  mode: "casual",   // "casual" (no clock), "timed" (with clock), "ai" (not ready yet)
  freeHand: false,  // casual mode: move any piece anywhere, no rules
  flip: false,      // timed mode: turn the board towards the player to move
  board: createInitialBoard(),
  turn: "white",
  selected: null,   // { row, col } of the selected piece, or null
  moves: [],        // squares the selected piece can move to
  winner: null,
  draw: false,
  captured: { white: [], black: [] },     // piece types each side has taken
  clock: { white: 0, black: 0 }           // seconds left, used in timed mode
};

// In "ai" mode the computer plays the dark pieces
const ENGINE_COLOR = "black";

// A choice waiting for the player: { row, col, color, options, onPick }
let pendingChoice = null;

let thinking = false;

let clockTimer = null;
let clockLastTick = 0;

const gameEl = document.getElementById("game");
const playEl = document.getElementById("play");
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const modeSelect = document.getElementById("mode-select");
const timeSelect = document.getElementById("time-select");
const depthSelect = document.getElementById("depth-select");
const thinkEl = document.getElementById("think");
const freeHandBox = document.getElementById("freehand");
const flipBox = document.getElementById("flip");

const trays = {
  white: { taken: document.getElementById("taken-white"), lead: document.getElementById("lead-white") },
  black: { taken: document.getElementById("taken-black"), lead: document.getElementById("lead-black") }
};

const clockEls = {
  white: document.getElementById("clock-white"),
  black: document.getElementById("clock-black")
};

// --- Drawing ---------------------------------------------------------------

// Is the board turned around right now?
function isFlipped() {
  return state.mode === "timed" && state.flip && state.turn === "black";
}

// Turns a board square into a screen square, and back again
function displayPos(row, col) {
  if (isFlipped()) return { row: ROWS - 1 - row, col: COLS - 1 - col };
  return { row: row, col: col };
}

function render() {
  gameEl.dataset.mode = state.mode;
  playEl.classList.toggle("flipped", isFlipped());
  boardEl.style.setProperty("--cols", COLS);
  boardEl.style.setProperty("--rows", ROWS);
  boardEl.innerHTML = "";

  // Squares are drawn in screen order, each one showing the board square behind it
  for (let screenRow = 0; screenRow < ROWS; screenRow++) {
    for (let screenCol = 0; screenCol < COLS; screenCol++) {
      const pos = displayPos(screenRow, screenCol);
      boardEl.appendChild(createSquare(pos.row, pos.col));
    }
  }

  if (pendingChoice) renderPicker();
  renderTrays();
  renderClocks();
  renderStatus();
}

function createSquare(row, col) {
  const square = document.createElement("div");
  square.className = "square " + ((row + col) % 2 === 0 ? "light" : "dark");
  square.dataset.row = row;
  square.dataset.col = col;

  const piece = state.board[row][col];
  if (piece) {
    const pieceEl = document.createElement("span");
    pieceEl.className = "piece " + piece.color;
    pieceEl.innerHTML = pieceSvg(piece.type);
    square.appendChild(pieceEl);
  }

  if (state.selected && state.selected.row === row && state.selected.col === col) {
    square.classList.add("selected");
  }
  if (isMoveTarget(row, col)) {
    square.classList.add(piece ? "capture" : "move");
  }

  return square;
}

// The choice list, growing from the square where the piece landed
function renderPicker() {
  const pos = displayPos(pendingChoice.row, pendingChoice.col);
  const count = pendingChoice.options.length;
  const fitsDownwards = pos.row + count <= ROWS;

  const topRow = fitsDownwards ? pos.row : pos.row + 1 - count;

  // Floating above the squares, so it cannot push the board around
  const picker = document.createElement("div");
  picker.id = "picker";
  picker.style.left = "calc(var(--square) * " + pos.col + ")";
  picker.style.top = "calc(var(--square) * " + topRow + ")";
  picker.style.height = "calc(var(--square) * " + count + ")";

  const options = fitsDownwards ? pendingChoice.options : pendingChoice.options.slice().reverse();
  for (const type of options) {
    const option = document.createElement("div");
    option.className = "picker-option";
    option.dataset.type = type;
    option.title = PIECES[type].name;
    option.innerHTML = '<span class="piece ' + pendingChoice.color + '">' + pieceSvg(type) + "</span>";
    picker.appendChild(option);
  }

  boardEl.appendChild(picker);
}

// Shows the pieces each side has taken, and how many points it leads by
function renderTrays() {
  const whiteLead = materialValue("white") - materialValue("black");

  for (const color of ["white", "black"]) {
    const enemy = enemyColor(color);
    const lead = color === "white" ? whiteLead : -whiteLead;

    trays[color].taken.innerHTML = state.captured[color]
      .map(type => '<span class="piece mini ' + enemy + '">' + pieceSvg(type) + "</span>")
      .join("");
    trays[color].lead.textContent = lead > 0 ? "+" + lead : "";
  }
}

function renderClocks() {
  for (const color of ["white", "black"]) {
    clockEls[color].textContent = formatTime(state.clock[color]);
    clockEls[color].classList.toggle("active", state.turn === color && !state.winner);
  }
}

function renderStatus() {
  if (state.winner) {
    statusEl.textContent = COLOR_NAMES[state.winner] + " nyert!";
  } else if (state.draw) {
    statusEl.textContent = "Döntetlen (patt)";
  } else if (state.freeHand && state.mode === "casual") {
    statusEl.textContent = "Szabad kéz: bármit bárhová";
  } else if (thinking) {
    statusEl.textContent = "A gép gondolkodik…";
  } else if (pendingChoice) {
    statusEl.textContent = "Válassz bábut";
  } else if (state.selected) {
    const def = PIECES[state.board[state.selected.row][state.selected.col].type];
    statusEl.textContent = COLOR_NAMES[state.turn] + " lép – " + def.name +
      (def.value ? " (" + def.value + " pont)" : "");
  } else {
    statusEl.textContent = COLOR_NAMES[state.turn] + " lép";
  }

  if (!state.winner && !state.draw && isInCheck(state.board, state.turn)) {
    statusEl.textContent += " – Sakk!";
  }
}

function formatTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes + ":" + (rest < 10 ? "0" : "") + rest;
}

// Total worth of one side's pieces still on the board
function materialValue(color) {
  let sum = 0;
  for (const row of state.board) {
    for (const piece of row) {
      if (piece && piece.color === color) sum += PIECES[piece.type].value;
    }
  }
  return sum;
}

function isMoveTarget(row, col) {
  return state.moves.some(m => m.row === row && m.col === col);
}

// --- Playing ---------------------------------------------------------------

function onSquareClick(row, col) {
  if (pendingChoice || thinking) return;
  if (state.mode === "ai" && state.turn === ENGINE_COLOR) return;

  if (state.freeHand && state.mode === "casual") {
    freeHandClick(row, col);
    return;
  }

  if (state.winner || state.draw) return;

  if (isMoveTarget(row, col)) {
    const from = state.selected;
    const to = { row: row, col: col };
    const piece = state.board[from.row][from.col];

    // A Lovász taking a piece: it may turn itself into a Jobbágy
    if (PIECES[piece.type].convertsCaptured && state.board[to.row][to.col] !== null) {
      state.selected = null;
      state.moves = [];
      askChoice(to.row, to.col, ["knight", "pawn"], piece.color, function (type) {
        makeMove(from, to, type);
        render();
      });
    } else {
      makeMove(from, to);
    }
  } else {
    selectPiece(row, col);
  }

  render();
}

// Free hand: pick up any piece and put it down anywhere
function freeHandClick(row, col) {
  if (state.selected) {
    const piece = state.board[state.selected.row][state.selected.col];
    state.board[state.selected.row][state.selected.col] = null;
    state.board[row][col] = piece;
    state.selected = null;
  } else if (state.board[row][col]) {
    state.selected = { row: row, col: col };
  }

  render();
}

function selectPiece(row, col) {
  const piece = state.board[row][col];

  if (piece && piece.color === state.turn) {
    state.selected = { row: row, col: col };
    state.moves = getLegalMoves(state.board, row, col);
  } else {
    state.selected = null;
    state.moves = [];
  }
}

// "becomes" is the piece type the mover turns into (a Lovász may become a Jobbágy)
function makeMove(from, to, becomes) {
  const piece = state.board[from.row][from.col];
  const captured = state.board[to.row][to.col];

  state.board[to.row][to.col] = piece;
  state.board[from.row][from.col] = null;
  piece.moved = true;
  if (becomes) piece.type = becomes;

  if (captured) {
    state.captured[piece.color].push(captured.type);
    if (captured.type === "king") state.winner = piece.color;
  }

  // Castling: the kovács jumps to the far side of the Földesúr
  if (piece.type === "king" && Math.abs(to.col - from.col) === 2) {
    moveCastlingRook(to.row, from.col, to.col);
  }

  finishMove(piece, to.row, to.col);
}

function moveCastlingRook(row, kingFromCol, kingToCol) {
  const dir = kingToCol > kingFromCol ? 1 : -1;
  const rookCol = dir === 1 ? COLS - 1 : 0;
  const rook = state.board[row][rookCol];

  state.board[row][rookCol] = null;
  state.board[row][kingToCol - dir] = rook;
  rook.moved = true;
}

// A Jobbágy on the enemy's back row is traded for a piece of the player's choice
function finishMove(piece, row, col) {
  const enemyBackRow = homeRow(enemyColor(piece.color));

  if (!state.winner && piece.type === "pawn" && row === enemyBackRow) {
    // The engine always takes a Földesúrnő
    if (state.mode === "ai" && piece.color === ENGINE_COLOR) {
      piece.type = "queen";
      endTurn();
      return;
    }

    askChoice(row, col, PROMOTION_CHOICES, piece.color, function (type) {
      piece.type = type;
      endTurn();
      render();
    });
    return;
  }

  endTurn();
}

function askChoice(row, col, options, color, onPick) {
  pendingChoice = { row: row, col: col, options: options, color: color, onPick: onPick };
}

function endTurn() {
  state.selected = null;
  state.moves = [];
  state.turn = enemyColor(state.turn);

  checkGameEnd();
  if (state.mode === "timed" && !state.winner) startClock();
  if (state.mode === "ai") setTimeout(engineTurn, 30);
}

// --- The computer's turn ---------------------------------------------------

function engineTurn() {
  if (thinking || pendingChoice) return;
  if (state.mode !== "ai" || state.turn !== ENGINE_COLOR) return;
  if (state.winner || state.draw) return;

  thinking = true;
  statusEl.textContent = "A gép gondolkodik…";

  chooseEngineMove(state.board, ENGINE_COLOR, Number(depthSelect.value),
    function (done) { thinkEl.value = done; },
    function (move) {
      thinking = false;
      if (move) makeMove(move.from, move.to);
      render();
    });
}

// No move left means mate (the other side wins) or a draw
function checkGameEnd() {
  if (state.winner || hasAnyLegalMove(state.board, state.turn)) return;

  if (isInCheck(state.board, state.turn)) state.winner = enemyColor(state.turn);
  else state.draw = true;

  stopClock();
}

// --- Clock -----------------------------------------------------------------

function startClock() {
  if (clockTimer) return;
  clockLastTick = Date.now();
  clockTimer = setInterval(tickClock, 200);
}

function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}

function tickClock() {
  const now = Date.now();
  const elapsed = (now - clockLastTick) / 1000;
  clockLastTick = now;

  state.clock[state.turn] -= elapsed;

  if (state.clock[state.turn] <= 0) {
    state.clock[state.turn] = 0;
    state.winner = enemyColor(state.turn);
    stopClock();
    render();
    return;
  }

  renderClocks();
}

// --- New game and modes ----------------------------------------------------

function resetGame() {
  stopClock();
  thinking = false;
  thinkEl.value = 0;
  state.board = createInitialBoard();
  state.turn = "white";
  state.selected = null;
  state.moves = [];
  state.winner = null;
  state.draw = false;
  state.captured = { white: [], black: [] };
  pendingChoice = null;

  const minutes = Number(timeSelect.value);
  state.clock = { white: minutes * 60, black: minutes * 60 };

  render();
}

// --- Clicks ----------------------------------------------------------------

boardEl.addEventListener("click", function (event) {
  const option = event.target.closest(".picker-option");
  if (option) {
    const choice = pendingChoice;
    pendingChoice = null;
    choice.onPick(option.dataset.type);
    return;
  }

  const square = event.target.closest(".square");
  if (square) onSquareClick(Number(square.dataset.row), Number(square.dataset.col));
});

document.getElementById("reset").addEventListener("click", resetGame);

modeSelect.addEventListener("change", function () {
  state.mode = modeSelect.value;
  resetGame();
});

freeHandBox.addEventListener("change", function () {
  state.freeHand = freeHandBox.checked;
  state.selected = null;
  state.moves = [];
  render();
});

flipBox.addEventListener("change", function () {
  state.flip = flipBox.checked;
  render();
});

timeSelect.addEventListener("change", resetGame);

resetGame();

// Piece definitions: what each piece is called, looks like and how it moves.
// The theme: pieces are named after old professions.
//
// "name"   = the piece's name shown to the player
// "value"  = how many points the piece is worth
// "paths"  = fixed routes the piece walks step by step (vadász)
// "shape"  = the piece's picture, built from simple, rounded SVG shapes in a 100x100 box
// "steps"  = single jumps in the given directions (king, knight, the short side of a kovács)
// "slides" = keep going in a direction until something blocks (queen, tüzér, the long side of a kovács)
// "range"  = how many squares a sliding piece may travel at most (default: unlimited)
// "bounce" = a sliding piece bounces off the board edge like a ball
// Directions are [rowDelta, colDelta]. Row 0 is the top of the board.

const UP_DOWN = [[1, 0], [-1, 0]];
const LEFT_RIGHT = [[0, 1], [0, -1]];
const STRAIGHT = [...UP_DOWN, ...LEFT_RIGHT];
const DIAGONAL = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// Every piece stands on the same rounded base plate, so the set looks uniform
const BASE = '<ellipse cx="50" cy="87" rx="30" ry="7"/>';

// The two kovács variants share the same anvil, only the hammer differs
const ANVIL =
  '<rect x="16" y="46" width="68" height="14" rx="7"/>' +   // top
  '<path d="M34,58 H66 L62,76 H38 Z"/>' +                   // neck
  '<rect x="26" y="74" width="48" height="14" rx="7"/>';    // foot

// The vadász route: two diagonal steps like a bishop, then up to two steps
// back towards the starting column like a rook. It may stop on any step,
// capturing what stands there, and its own pieces block the rest of the route.
function vadaszPaths() {
  const paths = [];
  for (const [dr, dc] of DIAGONAL) {
    paths.push([
      { dr: dr, dc: dc, stop: true },   // first diagonal step
      { dr: dr, dc: dc, stop: true },   // second diagonal step
      { dr: 0, dc: -dc, stop: true },   // turning back towards the starting column
      { dr: 0, dc: -dc, stop: true }
    ]);
  }
  return paths;
}

const PIECES = {
  king: {
    name: "Földesúr",
    value: 0,
    shape: BASE +
      '<rect x="28" y="56" width="44" height="30" rx="16"/>' +   // body
      '<circle cx="50" cy="40" r="16"/>' +                        // head
      '<rect x="30" y="22" width="40" height="7" rx="3.5"/>' +    // top hat brim
      '<rect x="36" y="4" width="28" height="21" rx="5"/>',       // top hat
    steps: [...STRAIGHT, ...DIAGONAL]
  },
  queen: {
    name: "Földesúrnő",
    value: 7,
    shape: BASE +
      '<path d="M22,86 Q28,54 50,52 Q72,54 78,86 Z"/>' +          // dress
      '<circle cx="50" cy="38" r="15"/>' +                        // head
      '<ellipse cx="50" cy="24" rx="21" ry="6"/>' +               // hat brim
      '<circle cx="50" cy="16" r="9"/>',                          // hat top
    // Whole diagonals like a classic bishop (no bouncing), plus one square straight in any direction
    slides: DIAGONAL,
    steps: STRAIGHT
  },
  rookLeft: {
    name: "Bal kovács",
    value: 4,
    shape: BASE + ANVIL +
      '<rect x="46" y="14" width="8" height="36" rx="4"/>' +      // upright hammer handle
      '<rect x="35" y="4" width="30" height="14" rx="7"/>',       // hammer head
    // Full column up and down, but only one square sideways
    slides: UP_DOWN,
    steps: LEFT_RIGHT
  },
  rookRight: {
    name: "Jobb kovács",
    value: 4,
    shape: BASE + ANVIL +
      '<rect x="18" y="24" width="52" height="8" rx="4"/>' +      // lying hammer handle
      '<rect x="64" y="12" width="18" height="32" rx="8"/>',      // hammer head
    // Full row left and right, but only one square up or down
    slides: LEFT_RIGHT,
    steps: UP_DOWN
  },
  bishop: {
    name: "Tüzér",
    value: 3,
    shape: BASE +
      '<rect x="36" y="46" width="48" height="18" rx="9" transform="rotate(-35 40 55)"/>' + // cannon barrel
      '<circle cx="42" cy="70" r="15"/>' +                        // wheel
      '<circle cx="70" cy="76" r="7"/>',                          // cannonball
    // Moves diagonally at most 7 squares, and bounces off the board edge like a ball
    slides: DIAGONAL,
    range: 7,
    bounce: true
  },
  knight: {
    name: "Lovász",
    value: 3,
    shape: BASE +
      '<path d="M32,86 L70,86 L70,56 Q78,44 68,30 Q64,20 56,14 L54,24 L46,12 L42,26 Q30,34 22,48 Q18,58 28,60 L38,54 Q44,58 42,66 Q38,76 32,86 Z"/>', // horse head
    steps: [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]],
    // When capturing, the player may turn the captured piece into their own Jobbágy instead (see game.js)
    convertsCaptured: true
  },
  vadasz: {
    name: "Vadász",
    value: 6,
    shape: BASE +
      '<path d="M55,8 A45,45 0 0 1 55,80 L47,76 A37,37 0 0 0 47,12 Z"/>' +  // bow
      '<rect x="53" y="8" width="4" height="72" rx="2"/>' +                  // bowstring
      '<rect x="24" y="41" width="52" height="7" rx="3.5"/>' +               // arrow shaft
      '<polygon points="88,44.5 74,36 74,53"/>',                             // arrowhead
    paths: vadaszPaths()
  },
  pawn: {
    name: "Jobbágy",
    value: 1,
    shape: BASE +
      '<rect x="33" y="58" width="34" height="28" rx="13"/>' +    // body
      '<circle cx="50" cy="45" r="13"/>' +                        // head
      '<ellipse cx="50" cy="33" rx="22" ry="5"/>' +               // straw hat brim
      '<path d="M39,33 Q39,19 50,19 Q61,19 61,33 Z"/>'            // straw hat top
    // pawns have special movement rules, see moves.js
  }
};

// Builds the HTML picture of a piece. "currentColor" means the CSS text color.
function pieceSvg(type) {
  return '<svg viewBox="0 0 100 100"><g fill="currentColor">' + PIECES[type].shape + '</g></svg>';
}

import { getAllLegalMoves, isCheckmate, isInCheck } from '../src/game/checkRules';
import { recommendMove } from '../src/ai/simpleAi';
import { applyMove, newGame } from '../src/game/gameState';
import { clearBoard, clearSquare, editSquare, revealHotkeyType, revealSelectedByHotkey, setTurn } from '../src/game/boardEditing';
import { BOARD_COLS, BOARD_POINT_COUNT, BOARD_ROWS, hasLegalPosition, isBoardShape, visualRowForBoardRow } from '../src/game/boardLayout';
import { createInitialBoard } from '../src/game/initialBoard';
import { moveText } from '../src/game/moveNotation';
import { isBasicLegalMove, kingsFace } from '../src/game/moveRules';
import { fromSavedPosition, loadPosition, POSITION_STORAGE_KEY, savePosition, toSavedPosition } from '../src/game/positionStorage';
import type { Board, Piece, PieceType, Side } from '../src/types/chess';

function assertEqual(actual: unknown, expected: unknown) {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertOk<T>(value: T): asserts value is NonNullable<T> {
  if (value == null || value === false) {
    throw new Error(`expected truthy value, got ${String(value)}`);
  }
}

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null));
}

function piece(side: Side, originalType: PieceType, realType = originalType, revealed = true): Piece {
  return {
    id: `${side}-${originalType}-${realType}-${revealed}`,
    side,
    originalType,
    realType,
    revealed,
  };
}

function place(board: Board, row: number, col: number, p: Piece): Board {
  board[row][col] = p;
  return board;
}

function withKings(board = emptyBoard()): Board {
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  return board;
}

function hasMove(board: Board, side: Side, from: [number, number], to: [number, number]): boolean {
  return getAllLegalMoves(board, side).some(move =>
    move.from.row === from[0] &&
    move.from.col === from[1] &&
    move.to.row === to[0] &&
    move.to.col === to[1]
  );
}

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

function fakeStorage(initial?: Record<string, string>) {
  const data = new Map(Object.entries(initial ?? {}));
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

test('horse leg blocks horse movement', () => {
  const board = withKings();
  place(board, 7, 1, piece('red', 'horse'));
  assertEqual(isBasicLegalMove(board, { row: 7, col: 1 }, { row: 5, col: 2 }), true);
  place(board, 6, 1, piece('red', 'pawn'));
  assertEqual(isBasicLegalMove(board, { row: 7, col: 1 }, { row: 5, col: 2 }), false);
});

test('elephant eye blocks elephant movement', () => {
  const board = withKings();
  place(board, 9, 2, piece('red', 'elephant'));
  assertEqual(isBasicLegalMove(board, { row: 9, col: 2 }, { row: 7, col: 4 }), true);
  place(board, 8, 3, piece('red', 'pawn'));
  assertEqual(isBasicLegalMove(board, { row: 9, col: 2 }, { row: 7, col: 4 }), false);
});

test('cannon needs exactly one screen to capture', () => {
  const board = withKings();
  place(board, 7, 1, piece('red', 'cannon'));
  place(board, 7, 7, piece('black', 'rook'));
  assertEqual(isBasicLegalMove(board, { row: 7, col: 1 }, { row: 7, col: 7 }), false);
  place(board, 7, 4, piece('red', 'pawn'));
  assertEqual(isBasicLegalMove(board, { row: 7, col: 1 }, { row: 7, col: 7 }), true);
  place(board, 7, 5, piece('black', 'pawn'));
  assertEqual(isBasicLegalMove(board, { row: 7, col: 1 }, { row: 7, col: 7 }), false);
});

test('pawn moves sideways only after crossing river', () => {
  const board = withKings();
  place(board, 6, 2, piece('red', 'pawn'));
  assertEqual(isBasicLegalMove(board, { row: 6, col: 2 }, { row: 6, col: 3 }), false);
  assertEqual(isBasicLegalMove(board, { row: 6, col: 2 }, { row: 5, col: 2 }), true);
  place(board, 4, 2, piece('red', 'pawn'));
  assertEqual(isBasicLegalMove(board, { row: 4, col: 2 }, { row: 4, col: 3 }), true);
  assertEqual(isBasicLegalMove(board, { row: 4, col: 2 }, { row: 5, col: 2 }), false);
});

test('king and advisor stay inside palace', () => {
  const board = withKings();
  place(board, 9, 3, piece('red', 'advisor'));
  assertEqual(isBasicLegalMove(board, { row: 9, col: 4 }, { row: 8, col: 4 }), true);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 4 }, { row: 9, col: 5 }), true);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 4 }, { row: 9, col: 6 }), false);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 3 }, { row: 8, col: 2 }), false);
});

test('facing kings are detected and illegal moves are filtered', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'rook'));
  assertEqual(kingsFace(board), false);
  assertEqual(isInCheck(board, 'red'), false);
  assertEqual(hasMove(board, 'red', [5, 4], [5, 5]), false);
  board[5][4] = null;
  assertEqual(kingsFace(board), true);
  assertEqual(isInCheck(board, 'red'), true);
});

test('hidden piece uses original type before first move', () => {
  const board = withKings();
  place(board, 7, 1, piece('red', 'horse', 'rook', false));
  assertEqual(isBasicLegalMove(board, { row: 7, col: 1 }, { row: 5, col: 2 }), true);
  assertEqual(isBasicLegalMove(board, { row: 7, col: 1 }, { row: 7, col: 5 }), false);
});

test('initial board has one revealed real king per side', () => {
  for (let i = 0; i < 50; i++) {
    const board = createInitialBoard();
    for (const side of ['red', 'black'] as const) {
      const sidePieces = board.flat().filter(p => p?.side === side);
      const realKings = sidePieces.filter(p => p?.realType === 'king');
      const originalKings = sidePieces.filter(p => p?.originalType === 'king');
      assertEqual(realKings.length, 1);
      assertEqual(originalKings.length, 1);
      assertEqual(realKings[0]?.revealed, true);
      assertEqual(sidePieces.filter(p => p?.originalType !== 'king' && p?.revealed).length, 0);
    }
  }
});

test('engine can still find check against a hidden real king', () => {
  const board = emptyBoard();
  place(board, 0, 4, piece('black', 'king', 'king', false));
  place(board, 9, 4, piece('red', 'king', 'king', false));
  place(board, 1, 4, piece('red', 'rook'));
  assertEqual(isInCheck(board, 'black'), true);
});

test('hidden piece reveals after first legal move and then uses real type', () => {
  const board = withKings();
  place(board, 7, 1, piece('red', 'horse', 'rook', false));
  const move = getAllLegalMoves(board, 'red').find(m =>
    m.from.row === 7 && m.from.col === 1 && m.to.row === 5 && m.to.col === 2
  );
  assertOk(move);
  const next = board.map(row => row.map(p => p ? {...p} : null));
  next[5][2] = {...next[7][1]!, revealed: true};
  next[7][1] = null;
  assertEqual(move.flipped, true);
  assertEqual(isBasicLegalMove(next, { row: 5, col: 2 }, { row: 5, col: 3 }), true);
  assertEqual(isBasicLegalMove(next, { row: 5, col: 2 }, { row: 3, col: 3 }), false);
});

test('checkmate requires being in check with no legal escape', () => {
  const board = emptyBoard();
  place(board, 0, 4, piece('black', 'king'));
  place(board, 9, 4, piece('red', 'king'));
  place(board, 1, 4, piece('red', 'rook'));
  place(board, 0, 3, piece('red', 'rook'));
  place(board, 0, 5, piece('red', 'rook'));
  assertEqual(isInCheck(board, 'black'), true);
  assertEqual(isCheckmate(board, 'black'), true);
});

test('move notation uses Tiantian Xiangqi file order and hidden prefix', () => {
  const hiddenCannon = piece('red', 'cannon', 'rook', false);
  assertEqual(moveText({
    from: { row: 9, col: 7 },
    to: { row: 2, col: 7 },
    piece: hiddenCannon,
    flipped: true,
  }), '暗炮二進七');

  const revealedCannon = piece('red', 'cannon', 'cannon', true);
  assertEqual(moveText({
    from: { row: 9, col: 7 },
    to: { row: 2, col: 7 },
    piece: revealedCannon,
  }), '炮二進七');

  const blackPawn = piece('black', 'pawn');
  assertEqual(moveText({
    from: { row: 3, col: 0 },
    to: { row: 4, col: 0 },
    piece: blackPawn,
  }), '卒一進一');
});

test('AI scoring does not peek at hidden captured real type', () => {
  const boardA = withKings();
  const boardB = withKings();
  place(boardA, 5, 0, piece('red', 'rook'));
  place(boardB, 5, 0, piece('red', 'rook'));
  place(boardA, 5, 1, piece('black', 'pawn', 'rook', false));
  place(boardB, 5, 1, piece('black', 'pawn', 'pawn', false));
  const stateA = { board: boardA, turn: 'red' as const, history: [], status: 'playing' as const };
  const stateB = { board: boardB, turn: 'red' as const, history: [], status: 'playing' as const };
  assertEqual(recommendMove(stateA).score, recommendMove(stateB).score);
});

test('checkmate after a move updates status to red_win', () => {
  const board = emptyBoard();
  place(board, 0, 4, piece('black', 'king'));
  place(board, 9, 4, piece('red', 'king'));
  place(board, 1, 3, piece('red', 'rook'));
  place(board, 0, 3, piece('red', 'rook'));
  place(board, 0, 5, piece('red', 'rook'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = applyMove(state, { row: 1, col: 3 }, { row: 1, col: 4 });
  assertEqual(next.status, 'red_win');
  assertEqual(next.turn, 'black');
});

test('non-playing status prevents further moves', () => {
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'red_win' as const };
  const next = applyMove(state, { row: 6, col: 0 }, { row: 5, col: 0 });
  assertEqual(next, state);
});

test('new game starts with playing status', () => {
  assertEqual(newGame().status, 'playing');
});

test('editor can add a piece to an empty square', () => {
  const state = { board: emptyBoard(), turn: 'red' as const, history: [], status: 'playing' as const };
  const next = editSquare(state, { row: 4, col: 4 }, {}, {
    side: 'black',
    originalType: 'horse',
    realType: 'rook',
    revealed: false,
  });
  const added = next.board[4][4];
  assertOk(added);
  assertEqual(added.side, 'black');
  assertEqual(added.originalType, 'horse');
  assertEqual(added.realType, 'rook');
  assertEqual(added.revealed, false);
});

test('editor can clear a piece', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('red', 'rook'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = clearSquare(state, { row: 4, col: 4 });
  assertEqual(next.board[4][4], null);
});

test('editor can change piece side', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('red', 'rook'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = editSquare(state, { row: 4, col: 4 }, { side: 'black' });
  assertEqual(next.board[4][4]?.side, 'black');
});

test('editor can change original type, real type, and revealed state', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('red', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = editSquare(state, { row: 4, col: 4 }, {
    originalType: 'horse',
    realType: 'rook',
    revealed: true,
  });
  assertEqual(next.board[4][4]?.originalType, 'horse');
  assertEqual(next.board[4][4]?.realType, 'rook');
  assertEqual(next.board[4][4]?.revealed, true);
});

test('editing resets finished status back to playing', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('red', 'rook'));
  const wonState = { board, turn: 'red' as const, history: [], status: 'red_win' as const };
  assertEqual(editSquare(wonState, { row: 4, col: 4 }, { side: 'black' }).status, 'playing');
  assertEqual(clearSquare(wonState, { row: 4, col: 4 }).status, 'playing');
  assertEqual(clearBoard(wonState).status, 'playing');
});

test('position storage converts GameState to saved format', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('black', 'horse', 'rook', false));
  const state = { board, turn: 'black' as const, history: [{ from: { row: 1, col: 1 }, to: { row: 2, col: 1 }, piece: piece('red', 'pawn') }], status: 'black_win' as const };
  const saved = toSavedPosition(state);
  assertEqual(saved.board[4][4]?.side, 'black');
  assertEqual(saved.turn, 'black');
  assertEqual(saved.status, 'black_win');
  assertEqual('history' in saved, false);
});

test('position storage restores GameState with empty history', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('red', 'cannon', 'rook', true));
  const restored = fromSavedPosition({ board, turn: 'red', status: 'playing' });
  assertEqual(restored.board[4][4]?.realType, 'rook');
  assertEqual(restored.turn, 'red');
  assertEqual(restored.status, 'playing');
  assertEqual(restored.history.length, 0);
});

test('position storage saves and loads status, turn, and board', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('black', 'pawn', 'horse', false));
  const state = { board, turn: 'black' as const, history: [], status: 'red_win' as const };
  const storage = fakeStorage();
  assertEqual(savePosition(storage, state), true);
  const loaded = loadPosition(storage);
  assertOk(loaded);
  assertEqual(loaded.board[4][4]?.side, 'black');
  assertEqual(loaded.board[4][4]?.realType, 'horse');
  assertEqual(loaded.turn, 'black');
  assertEqual(loaded.status, 'red_win');
  assertEqual(loaded.history.length, 0);
});

test('position storage returns null when localStorage is missing or empty', () => {
  assertEqual(savePosition(undefined, newGame()), false);
  assertEqual(loadPosition(undefined), null);
  assertEqual(loadPosition(fakeStorage()), null);
});

test('position storage ignores broken JSON and invalid saved data', () => {
  assertEqual(loadPosition(fakeStorage({ [POSITION_STORAGE_KEY]: '{not json' })), null);
  assertEqual(loadPosition(fakeStorage({ [POSITION_STORAGE_KEY]: JSON.stringify({ board: [], turn: 'red', status: 'playing' }) })), null);
});

test('manual turn setting can switch to red', () => {
  const state = { board: emptyBoard(), turn: 'black' as const, history: [], status: 'playing' as const };
  const next = setTurn(state, 'red');
  assertEqual(next.turn, 'red');
});

test('manual turn setting can switch to black', () => {
  const state = { board: emptyBoard(), turn: 'red' as const, history: [], status: 'playing' as const };
  const next = setTurn(state, 'black');
  assertEqual(next.turn, 'black');
});

test('manual turn setting resets status to playing', () => {
  const state = { board: emptyBoard(), turn: 'red' as const, history: [], status: 'black_win' as const };
  const next = setTurn(state, 'black');
  assertEqual(next.status, 'playing');
});

test('manual turn setting keeps board unchanged', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('red', 'rook', 'horse', true));
  const state = { board, turn: 'red' as const, history: [], status: 'red_win' as const };
  const next = setTurn(state, 'black');
  assertEqual(next.board[4][4]?.side, 'red');
  assertEqual(next.board[4][4]?.realType, 'horse');
});

test('reveal hotkeys map 1-6 to piece types', () => {
  assertEqual(revealHotkeyType('1'), 'rook');
  assertEqual(revealHotkeyType('2'), 'horse');
  assertEqual(revealHotkeyType('3'), 'elephant');
  assertEqual(revealHotkeyType('4'), 'advisor');
  assertEqual(revealHotkeyType('5'), 'cannon');
  assertEqual(revealHotkeyType('6'), 'pawn');
});

test('reveal hotkey sets real type and revealed state', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('red', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'black_win' as const };
  const next = revealSelectedByHotkey(state, { row: 4, col: 4 }, '1');
  assertEqual(next.board[4][4]?.realType, 'rook');
  assertEqual(next.board[4][4]?.revealed, true);
  assertEqual(next.status, 'playing');
});

test('reveal hotkey keeps original type, side, and other squares', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('black', 'cannon', 'pawn', false));
  place(board, 4, 5, piece('red', 'horse', 'horse', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const next = revealSelectedByHotkey(state, { row: 4, col: 4 }, '2');
  assertEqual(next.board[4][4]?.originalType, 'cannon');
  assertEqual(next.board[4][4]?.side, 'black');
  assertEqual(next.board[4][5]?.realType, 'horse');
  assertEqual(next.board[4][5]?.revealed, false);
});

test('reveal hotkey does nothing without selected or on empty square', () => {
  const board = emptyBoard();
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  assertEqual(revealSelectedByHotkey(state, null, '1'), state);
  assertEqual(revealSelectedByHotkey(state, { row: 4, col: 4 }, '1'), state);
  assertEqual(revealSelectedByHotkey(state, { row: 4, col: 4 }, 'x'), state);
});

test('board data remains 10 by 9 with 90 playable intersections', () => {
  const board = createInitialBoard();
  assertEqual(isBoardShape(board), true);
  assertEqual(BOARD_ROWS, 10);
  assertEqual(BOARD_COLS, 9);
  assertEqual(BOARD_POINT_COUNT, 90);
});

test('river is a visual gap and does not add a board row', () => {
  assertEqual(visualRowForBoardRow(0), 0);
  assertEqual(visualRowForBoardRow(4), 4);
  assertEqual(visualRowForBoardRow(5), 6);
  assertEqual(visualRowForBoardRow(9), 10);
});

test('legal hint helper only marks coordinates returned by legal move generation', () => {
  const board = withKings();
  place(board, 7, 1, piece('red', 'horse'));
  const legalMoves = getAllLegalMoves(board, 'red').filter(move => move.from.row === 7 && move.from.col === 1).map(move => move.to);
  assertEqual(hasLegalPosition(legalMoves, { row: 5, col: 0 }), true);
  assertEqual(hasLegalPosition(legalMoves, { row: 5, col: 2 }), true);
  assertEqual(hasLegalPosition(legalMoves, { row: 6, col: 3 }), true);
  assertEqual(hasLegalPosition(legalMoves, { row: 7, col: 2 }), false);
});

test('elephant legal hints stay on diagonal field positions after UI layout change', () => {
  const board = withKings();
  place(board, 9, 2, piece('red', 'elephant'));
  const legalMoves = getAllLegalMoves(board, 'red').filter(move => move.from.row === 9 && move.from.col === 2).map(move => move.to);
  assertEqual(hasLegalPosition(legalMoves, { row: 7, col: 0 }), true);
  assertEqual(hasLegalPosition(legalMoves, { row: 7, col: 4 }), true);
  assertEqual(hasLegalPosition(legalMoves, { row: 8, col: 2 }), false);
  assertEqual(hasLegalPosition(legalMoves, { row: 9, col: 4 }), false);
});

test('AI avoids an immediate high-value recapture', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 4, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'rook'));
  place(board, 5, 1, piece('black', 'pawn', 'pawn', false));
  place(board, 5, 8, piece('black', 'rook', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const recommended = recommendMove(state).move;
  assertOk(recommended);
  assertEqual(recommended.from.row === 5 && recommended.from.col === 0 && recommended.to.row === 5 && recommended.to.col === 1, false);
});

test('AI threat scoring for hidden enemies uses original type, not real type', () => {
  const boardA = emptyBoard();
  const boardB = emptyBoard();
  place(boardA, 9, 4, piece('red', 'king'));
  place(boardA, 0, 4, piece('black', 'king'));
  place(boardA, 4, 4, piece('red', 'pawn'));
  place(boardB, 9, 4, piece('red', 'king'));
  place(boardB, 0, 4, piece('black', 'king'));
  place(boardB, 4, 4, piece('red', 'pawn'));
  place(boardA, 5, 0, piece('red', 'rook'));
  place(boardB, 5, 0, piece('red', 'rook'));
  place(boardA, 5, 1, piece('black', 'pawn', 'pawn', false));
  place(boardB, 5, 1, piece('black', 'pawn', 'pawn', false));
  place(boardA, 5, 8, piece('black', 'pawn', 'rook', false));
  place(boardB, 5, 8, piece('black', 'pawn', 'pawn', false));
  const stateA = { board: boardA, turn: 'red' as const, history: [], status: 'playing' as const };
  const stateB = { board: boardB, turn: 'red' as const, history: [], status: 'playing' as const };
  assertEqual(recommendMove(stateA).score, recommendMove(stateB).score);
});

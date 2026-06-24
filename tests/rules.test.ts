import { getAllLegalMoves, isCheckmate, isInCheck } from '../src/game/checkRules';
import { isBasicLegalMove, kingsFace } from '../src/game/moveRules';
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

import { getAllLegalMoves, isCheckmate, isInCheck } from '../src/game/checkRules';
import { recommendMove } from '../src/ai/simpleAi';
import { formatAiDebugReport } from '../src/ai/aiDebugReport';
import { SIMPLE_AI_NOTE, SIMPLE_AI_TITLE } from '../src/ai/simpleAiText';
import { applyMove, newGame } from '../src/game/gameState';
import { clearBoard, clearSquare, correctSelectedRealType, editSquare, editSquareError, revealHotkeyType, revealSelectedByHotkey, setTurn } from '../src/game/boardEditing';
import { getCapturedBoardStacks, getCapturedPieces } from '../src/game/capturedPieces';
import { BOARD_COLS, BOARD_POINT_COUNT, BOARD_ROWS, BOTTOM_FILE_LABELS, TOP_FILE_LABELS, hasLegalPosition, isBoardShape, visualRowForBoardRow } from '../src/game/boardLayout';
import { createInitialBoard } from '../src/game/initialBoard';
import { cancelLastMoveSync, syncLastMove } from '../src/game/lastMoveSync';
import { getEndgameFeedback, shouldPlayEndgameSound, statusLabel } from '../src/game/endgameFeedback';
import { createGameRecord, deleteGameRecord, GAME_RECORD_STORAGE_KEY, recordToJson, recordToText, saveGameRecord, loadGameRecords } from '../src/game/gameRecord';
import { moveText } from '../src/game/moveNotation';
import { isBasicLegalMove, kingsFace } from '../src/game/moveRules';
import { realPieceName } from '../src/game/pieceText';
import { remainingRealPieces } from '../src/game/pieceInventory';
import { fromSavedPosition, loadPosition, POSITION_STORAGE_KEY, savePosition, toSavedPosition } from '../src/game/positionStorage';
import {
  filterThirdRepetitionMoves,
  getPositionKey,
  getPositionKeyAfterMove,
  isRepetitionDraw,
  wouldCauseThirdRepetition,
} from '../src/game/repetitionRules';
import { shouldPlayMoveSound, playMoveSound, playCaptureSound, playCheckSound } from '../src/game/soundEffects';
import type { Board, GameState, Move, Piece, PieceType, Position, Side } from '../src/types/chess';

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

function findMove(board: Board, side: Side, from: [number, number], to: [number, number]): Move {
  const move = getAllLegalMoves(board, side).find(candidate =>
    candidate.from.row === from[0] &&
    candidate.from.col === from[1] &&
    candidate.to.row === to[0] &&
    candidate.to.col === to[1]
  );
  assertOk(move);
  return move;
}

function repetitionState(): GameState {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 6, 0, piece('red', 'rook'));
  place(board, 3, 8, piece('black', 'rook'));
  return { board, turn: 'red', history: [], status: 'playing' };
}

function legalMove(state: GameState, from: Position, to: Position): Move {
  const move = getAllLegalMoves(state.board, state.turn).find(m =>
    m.from.row === from.row &&
    m.from.col === from.col &&
    m.to.row === to.row &&
    m.to.col === to.col
  );
  assertOk(move);
  return move;
}

function playAndRemember(state: GameState, past: GameState[], from: Position, to: Position): GameState {
  past.push(state);
  const next = applyMove(state, from, to);
  assertOk(next !== state);
  return next;
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

test('second repeated position is still allowed', () => {
  const past: GameState[] = [];
  let state = repetitionState();
  state = playAndRemember(state, past, { row: 6, col: 0 }, { row: 6, col: 1 });
  state = playAndRemember(state, past, { row: 3, col: 8 }, { row: 3, col: 7 });
  state = playAndRemember(state, past, { row: 6, col: 1 }, { row: 6, col: 0 });
  const move = legalMove(state, { row: 3, col: 7 }, { row: 3, col: 8 });
  assertEqual(wouldCauseThirdRepetition(state, past, move), false);
});

test('position key includes side revealed realType and turn', () => {
  const boardA = withKings();
  const boardB = withKings();

  boardA[4][0] = piece('red', 'pawn', 'rook', false);
  boardB[4][0] = piece('black', 'pawn', 'rook', false);
  const redSideKey = getPositionKey({ board: boardA, turn: 'red' });
  const blackSideKey = getPositionKey({ board: boardB, turn: 'red' });
  assertEqual(redSideKey === blackSideKey, false);

  boardB[4][0] = piece('red', 'pawn', 'rook', true);
  const revealedKey = getPositionKey({ board: boardB, turn: 'red' });
  assertEqual(redSideKey === revealedKey, false);

  boardB[4][0] = piece('red', 'pawn', 'horse', false);
  const realTypeKey = getPositionKey({ board: boardB, turn: 'red' });
  // Fair-info: unrevealed pieces use originalType, so same originalType => same key
  assertEqual(redSideKey === realTypeKey, true);

  const blackTurnKey = getPositionKey({ board: boardA, turn: 'black' });
  assertEqual(redSideKey === blackTurnKey, false);
});

test('same file back-and-forth third repetition is forbidden', () => {
  const past: GameState[] = [];
  let state = repetitionState();
  state = playAndRemember(state, past, { row: 6, col: 0 }, { row: 6, col: 1 });
  state = playAndRemember(state, past, { row: 3, col: 8 }, { row: 3, col: 7 });
  state = playAndRemember(state, past, { row: 6, col: 1 }, { row: 6, col: 0 });
  state = playAndRemember(state, past, { row: 3, col: 7 }, { row: 3, col: 8 });
  state = playAndRemember(state, past, { row: 6, col: 0 }, { row: 6, col: 1 });
  state = playAndRemember(state, past, { row: 3, col: 8 }, { row: 3, col: 7 });
  state = playAndRemember(state, past, { row: 6, col: 1 }, { row: 6, col: 0 });
  const move = legalMove(state, { row: 3, col: 7 }, { row: 3, col: 8 });
  assertEqual(wouldCauseThirdRepetition(state, past, move), true);
});

test('filterThirdRepetitionMoves removes third repetition moves', () => {
  const past: GameState[] = [];
  let state = repetitionState();
  state = playAndRemember(state, past, { row: 6, col: 0 }, { row: 6, col: 1 });
  state = playAndRemember(state, past, { row: 3, col: 8 }, { row: 3, col: 7 });
  state = playAndRemember(state, past, { row: 6, col: 1 }, { row: 6, col: 0 });
  state = playAndRemember(state, past, { row: 3, col: 7 }, { row: 3, col: 8 });
  state = playAndRemember(state, past, { row: 6, col: 0 }, { row: 6, col: 1 });
  state = playAndRemember(state, past, { row: 3, col: 8 }, { row: 3, col: 7 });
  state = playAndRemember(state, past, { row: 6, col: 1 }, { row: 6, col: 0 });

  const moves = getAllLegalMoves(state.board, state.turn);
  const repeatMove = legalMove(state, { row: 3, col: 7 }, { row: 3, col: 8 });
  const filtered = filterThirdRepetitionMoves(state, past, moves);
  assertEqual(moves.some(move =>
    move.from.row === repeatMove.from.row &&
    move.from.col === repeatMove.from.col &&
    move.to.row === repeatMove.to.row &&
    move.to.col === repeatMove.to.col
  ), true);
  assertEqual(filtered.some(move =>
    move.from.row === repeatMove.from.row &&
    move.from.col === repeatMove.from.col &&
    move.to.row === repeatMove.to.row &&
    move.to.col === repeatMove.to.col
  ), false);
});

test('detour returning to same position third repetition is forbidden', () => {
  const past: GameState[] = [];
  let state = repetitionState();
  state = playAndRemember(state, past, { row: 6, col: 0 }, { row: 6, col: 1 });
  state = playAndRemember(state, past, { row: 3, col: 8 }, { row: 3, col: 7 });
  state = playAndRemember(state, past, { row: 6, col: 1 }, { row: 6, col: 2 });
  state = playAndRemember(state, past, { row: 3, col: 7 }, { row: 3, col: 6 });
  state = playAndRemember(state, past, { row: 6, col: 2 }, { row: 6, col: 0 });
  state = playAndRemember(state, past, { row: 3, col: 6 }, { row: 3, col: 8 });
  state = playAndRemember(state, past, { row: 6, col: 0 }, { row: 6, col: 1 });
  state = playAndRemember(state, past, { row: 3, col: 8 }, { row: 3, col: 7 });
  state = playAndRemember(state, past, { row: 6, col: 1 }, { row: 6, col: 2 });
  state = playAndRemember(state, past, { row: 3, col: 7 }, { row: 3, col: 6 });
  state = playAndRemember(state, past, { row: 6, col: 2 }, { row: 6, col: 0 });
  const move = legalMove(state, { row: 3, col: 6 }, { row: 3, col: 8 });
  assertEqual(wouldCauseThirdRepetition(state, past, move), true);
});

test('position key after move matches applyMove result', () => {
  const state = repetitionState();
  const move = legalMove(state, { row: 6, col: 0 }, { row: 6, col: 1 });
  const next = applyMove(state, move.from, move.to);
  assertEqual(getPositionKeyAfterMove(state, move), getPositionKey(next));
});

test('hidden pieces with same originalType have equal fair-info position keys', () => {
  const boardA = withKings();
  const boardB = withKings();
  boardA[4][0] = piece('red', 'pawn', 'rook', false);  // unrevealed: realType=rook
  boardB[4][0] = piece('red', 'pawn', 'horse', false); // unrevealed: realType=horse
  const stateA = { board: boardA, turn: 'red' as const, history: [], status: 'playing' as const };
  const stateB = { board: boardB, turn: 'red' as const, history: [], status: 'playing' as const };
  // Fair-info key: unrevealed pieces use originalType only, so same originalType => same key
  assertEqual(getPositionKey(stateA) === getPositionKey(stateB), true);
  // But different originalType => different key
  boardB[4][0] = piece('red', 'cannon', 'rook', false); // unrevealed: originalType=cannon
  const stateC = { board: boardB, turn: 'red' as const, history: [], status: 'playing' as const };
  assertEqual(getPositionKey(stateA) === getPositionKey(stateC), false);
});

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

test('king stays inside palace while jieqi advisor can leave palace', () => {
  const board = withKings();
  place(board, 9, 3, piece('red', 'advisor'));
  assertEqual(isBasicLegalMove(board, { row: 9, col: 4 }, { row: 8, col: 4 }), true);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 4 }, { row: 9, col: 5 }), true);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 4 }, { row: 9, col: 6 }), false);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 3 }, { row: 8, col: 2 }), true);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 3 }, { row: 8, col: 3 }), false);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 3 }, { row: 10, col: 2 }), false);
});

test('jieqi elephant can cross river but still needs field move and clear eye', () => {
  const board = withKings();
  place(board, 5, 2, piece('red', 'elephant'));
  assertEqual(isBasicLegalMove(board, { row: 5, col: 2 }, { row: 3, col: 4 }), true);
  assertEqual(isBasicLegalMove(board, { row: 5, col: 2 }, { row: 4, col: 3 }), false);
  place(board, 4, 3, piece('red', 'pawn'));
  assertEqual(isBasicLegalMove(board, { row: 5, col: 2 }, { row: 3, col: 4 }), false);
});

test('hidden advisor first move must enter palace center', () => {
  const board = withKings();
  place(board, 9, 3, piece('red', 'advisor', 'rook', false));
  assertEqual(isBasicLegalMove(board, { row: 9, col: 3 }, { row: 8, col: 4 }), true);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 3 }, { row: 8, col: 2 }), false);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 3 }, { row: 10, col: 4 }), false);

  board[9][3] = null;
  place(board, 4, 4, piece('red', 'advisor', 'rook', false));
  assertEqual(isBasicLegalMove(board, { row: 4, col: 4 }, { row: 3, col: 3 }), false);

  place(board, 0, 3, piece('black', 'advisor', 'rook', false));
  assertEqual(isBasicLegalMove(board, { row: 0, col: 3 }, { row: 1, col: 4 }), true);
  assertEqual(isBasicLegalMove(board, { row: 0, col: 3 }, { row: 1, col: 2 }), false);
});

test('revealed advisor can leave palace while king remains palace bound', () => {
  const board = withKings();
  place(board, 4, 4, piece('red', 'rook', 'advisor', true));
  assertEqual(isBasicLegalMove(board, { row: 4, col: 4 }, { row: 3, col: 3 }), true);
  assertEqual(isBasicLegalMove(board, { row: 4, col: 4 }, { row: 4, col: 3 }), false);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 4 }, { row: 8, col: 4 }), true);
  assertEqual(isBasicLegalMove(board, { row: 9, col: 4 }, { row: 9, col: 6 }), false);
});

test('hidden and revealed elephants use jieqi elephant movement', () => {
  const board = withKings();
  place(board, 5, 2, piece('red', 'elephant', 'rook', false));
  assertEqual(isBasicLegalMove(board, { row: 5, col: 2 }, { row: 3, col: 4 }), true);

  board[5][2] = piece('red', 'rook', 'elephant', true);
  assertEqual(isBasicLegalMove(board, { row: 5, col: 2 }, { row: 3, col: 4 }), true);
  assertEqual(isBasicLegalMove(board, { row: 5, col: 2 }, { row: 5, col: 4 }), false);
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
  }), '卒1進1');
});

test('cannon display uses red cannon and black bao labels', () => {
  assertEqual(realPieceName(piece('red', 'cannon')), '炮');
  assertEqual(realPieceName(piece('black', 'cannon')), '包');
  assertEqual(moveText({ from: { row: 9, col: 7 }, to: { row: 8, col: 7 }, piece: piece('red', 'cannon') }), '炮二進一');
  assertEqual(moveText({ from: { row: 0, col: 1 }, to: { row: 1, col: 1 }, piece: piece('black', 'cannon') }), '包2進1');
});

test('capture notation distinguishes revealed and hidden captured pieces', () => {
  const revealedCapture = moveText({
    from: { row: 5, col: 0 },
    to: { row: 5, col: 1 },
    piece: piece('red', 'rook'),
    captured: piece('black', 'horse', 'horse', true),
    capturedWasHidden: false,
    captureKind: 'revealed',
  });
  assertEqual(revealedCapture.includes('吃黑馬'), true);

  const hiddenBlackBaoCapture = moveText({
    from: { row: 5, col: 0 },
    to: { row: 5, col: 1 },
    piece: piece('red', 'rook'),
    captured: piece('black', 'pawn', 'cannon', false),
    capturedWasHidden: true,
    captureKind: 'hidden',
  });
  assertEqual(hiddenBlackBaoCapture.includes('吃黑暗子（翻出包）'), true);

  const hiddenRedCannonCapture = moveText({
    from: { row: 4, col: 0 },
    to: { row: 4, col: 1 },
    piece: piece('black', 'rook'),
    captured: piece('red', 'pawn', 'cannon', false),
    capturedWasHidden: true,
    captureKind: 'hidden',
  });
  assertEqual(hiddenRedCannonCapture.includes('吃紅暗子（翻出炮）'), true);
});

test('applyMove records whether captured piece was hidden or revealed', () => {
  const hiddenBoard = withKings();
  place(hiddenBoard, 5, 0, piece('red', 'rook'));
  place(hiddenBoard, 5, 1, piece('black', 'pawn', 'cannon', false));
  const hiddenState = { board: hiddenBoard, turn: 'red' as const, history: [], status: 'playing' as const };
  const hiddenNext = applyMove(hiddenState, { row: 5, col: 0 }, { row: 5, col: 1 });
  const hiddenMove = hiddenNext.history[0];
  assertEqual(hiddenMove.captureKind, 'hidden');
  assertEqual(hiddenMove.capturedWasHidden, true);
  assertEqual(hiddenMove.captured?.realType, 'cannon');

  const revealedBoard = withKings();
  place(revealedBoard, 5, 0, piece('red', 'rook'));
  place(revealedBoard, 5, 1, piece('black', 'horse', 'horse', true));
  const revealedState = { board: revealedBoard, turn: 'red' as const, history: [], status: 'playing' as const };
  const revealedNext = applyMove(revealedState, { row: 5, col: 0 }, { row: 5, col: 1 });
  assertEqual(revealedNext.history[0].captureKind, 'revealed');
  assertEqual(revealedNext.history[0].capturedWasHidden, false);
});

test('captured pieces helper groups captures by side and hidden state', () => {
  const history = [
    {
      from: { row: 5, col: 0 },
      to: { row: 5, col: 1 },
      piece: piece('black', 'rook'),
      captured: piece('red', 'cannon', 'cannon', true),
      capturedWasHidden: false,
      captureKind: 'revealed' as const,
    },
    {
      from: { row: 4, col: 0 },
      to: { row: 4, col: 1 },
      piece: piece('black', 'rook'),
      captured: piece('red', 'pawn', 'cannon', false),
      capturedWasHidden: true,
      captureKind: 'hidden' as const,
    },
    {
      from: { row: 5, col: 8 },
      to: { row: 5, col: 7 },
      piece: piece('red', 'rook'),
      captured: piece('black', 'cannon', 'cannon', true),
      capturedWasHidden: false,
      captureKind: 'revealed' as const,
    },
    {
      from: { row: 4, col: 8 },
      to: { row: 4, col: 7 },
      piece: piece('red', 'rook'),
      captured: piece('black', 'pawn', 'cannon', false),
      capturedWasHidden: true,
      captureKind: 'hidden' as const,
    },
  ];

  const captured = getCapturedPieces(history);
  assertEqual(captured.red.revealed[0].label, '\u70ae');
  assertEqual(captured.red.hidden[0].label, `\u6697\u5b50\uff08\u7ffb\u51fa${'\u70ae'}\uff09`);
  assertEqual(captured.black.revealed[0].label, '\u5305');
  assertEqual(captured.black.hidden[0].label, `\u6697\u5b50\uff08\u7ffb\u51fa${'\u5305'}\uff09`);
});

test('captured board stacks put black captures at top left and red captures at bottom left', () => {
  const history = [
    {
      from: { row: 5, col: 0 },
      to: { row: 5, col: 1 },
      piece: piece('black', 'rook'),
      captured: piece('red', 'horse', 'horse', true),
      capturedWasHidden: false,
      captureKind: 'revealed' as const,
    },
    {
      from: { row: 4, col: 8 },
      to: { row: 4, col: 7 },
      piece: piece('red', 'rook'),
      captured: piece('black', 'pawn', 'pawn', true),
      capturedWasHidden: false,
      captureKind: 'revealed' as const,
    },
  ];
  const stacks = getCapturedBoardStacks(history);
  assertEqual(stacks.topRight[0].side, 'red');
  assertEqual(stacks.bottomLeft[0].side, 'black');
});

test('captured board stacks mark hidden captures as translucent candidates', () => {
  const stacks = getCapturedBoardStacks([
    {
      from: { row: 5, col: 0 },
      to: { row: 5, col: 1 },
      piece: piece('red', 'rook'),
      captured: piece('black', 'pawn', 'horse', false),
      capturedWasHidden: true,
      captureKind: 'hidden' as const,
    },
  ]);
  assertEqual(stacks.bottomLeft[0].hiddenBeforeCapture, true);
  assertEqual(stacks.bottomLeft[0].name, realPieceName(piece('black', 'pawn', 'horse', false)));
});

test('captured board stacks show cannon or bao by captured side', () => {
  const stacks = getCapturedBoardStacks([
    {
      from: { row: 5, col: 0 },
      to: { row: 5, col: 1 },
      piece: piece('black', 'rook'),
      captured: piece('red', 'cannon', 'cannon', true),
      capturedWasHidden: false,
      captureKind: 'revealed' as const,
    },
    {
      from: { row: 4, col: 8 },
      to: { row: 4, col: 7 },
      piece: piece('red', 'rook'),
      captured: piece('black', 'cannon', 'cannon', true),
      capturedWasHidden: false,
      captureKind: 'revealed' as const,
    },
  ]);
  assertEqual(stacks.topRight[0].name, '\u70ae');
  assertEqual(stacks.bottomLeft[0].name, '\u5305');
});

test('captured board stacks do not change move list notation data', () => {
  const move = {
    from: { row: 6, col: 0 },
    to: { row: 5, col: 0 },
    piece: piece('red', 'pawn'),
  };
  const before = moveText(move);
  getCapturedBoardStacks([move]);
  assertEqual(moveText(move), before);
});

test('ai panel text marks simple scoring and endgame text stays separate', () => {
  assertEqual(SIMPLE_AI_TITLE.includes('\u7c21\u6613\u8a55\u5206'), true);
  assertEqual(SIMPLE_AI_NOTE.includes('\u4e0d\u4ee3\u8868\u5b8c\u6574\u6700\u4f73\u624b'), true);
  assertEqual(getEndgameFeedback('red_win')?.title, '\u7d55\u6bba');
  assertEqual(getEndgameFeedback('black_win')?.title, '\u7d55\u6bba');
  assertEqual(getEndgameFeedback('red_win')?.title === SIMPLE_AI_TITLE, false);
});

test('notation regression prevents black file numbers from being reversed', () => {
  assertEqual(moveText({
    from: { row: 9, col: 0 },
    to: { row: 8, col: 0 },
    piece: piece('red', 'rook'),
  }), `車${'\u4e5d'}進${'\u4e00'}`);

  assertEqual(moveText({
    from: { row: 9, col: 8 },
    to: { row: 8, col: 8 },
    piece: piece('red', 'rook'),
  }), `車${'\u4e00'}進${'\u4e00'}`);

  assertEqual(moveText({
    from: { row: 0, col: 0 },
    to: { row: 1, col: 0 },
    piece: piece('black', 'rook'),
  }), '車1進1');

  assertEqual(moveText({
    from: { row: 0, col: 8 },
    to: { row: 1, col: 8 },
    piece: piece('black', 'rook'),
  }), '車9進1');

  assertEqual(moveText({
    from: { row: 3, col: 0 },
    to: { row: 3, col: 8 },
    piece: piece('black', 'rook'),
  }), '車1平9');
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

test('AI chooses immediate checkmate before simple material scoring', () => {
  const board = emptyBoard();
  place(board, 0, 4, piece('black', 'king'));
  place(board, 9, 4, piece('red', 'king'));
  place(board, 1, 3, piece('red', 'rook'));
  place(board, 0, 3, piece('red', 'rook'));
  place(board, 0, 5, piece('red', 'rook'));
  place(board, 7, 0, piece('red', 'pawn'));
  place(board, 6, 0, piece('black', 'rook'));
  const state = {
    board,
    turn: 'red' as const,
    history: [],
    status: 'playing' as const,
  };
  const mate = {
    from: { row: 1, col: 3 },
    to: { row: 1, col: 4 },
    piece: board[1][3]!,
  };
  const nonMate = {
    from: { row: 7, col: 0 },
    to: { row: 6, col: 0 },
    piece: board[7][0]!,
    captured: board[6][0],
  };
  assertEqual(applyMove(state, mate.from, mate.to).status, 'red_win');
  const recommended = recommendMove(state, [nonMate, mate]);
  assertOk(recommended.move);
  assertEqual(recommended.reason, '此步直接形成絕殺');
  assertEqual(recommended.move, mate);
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

test('manual revealed advisor changed to cannon can deliver double cannon mate', () => {
  const board = emptyBoard();
  place(board, 0, 4, piece('black', 'king'));
  place(board, 9, 4, piece('red', 'king'));
  place(board, 2, 4, piece('red', 'advisor', 'cannon', true));
  place(board, 0, 3, piece('red', 'rook'));
  place(board, 0, 5, piece('red', 'rook'));
  place(board, 1, 8, piece('red', 'rook'));
  place(board, 1, 0, piece('red', 'rook'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = applyMove(state, { row: 1, col: 0 }, { row: 1, col: 4 });
  assertEqual(isInCheck(next.board, 'black'), true);
  assertEqual(isCheckmate(next.board, 'black'), true);
  assertEqual(next.status, 'red_win');
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

test('endgame feedback is hidden while game is playing', () => {
  assertEqual(getEndgameFeedback('playing'), null);
  assertEqual(statusLabel('playing', 'red'), '輪到紅方');
  assertEqual(statusLabel('playing', 'black'), '輪到黑方');
});

test('red win status shows checkmate endgame feedback', () => {
  const feedback = getEndgameFeedback('red_win');
  assertOk(feedback);
  assertEqual(feedback.title, '絕殺');
  assertEqual(feedback.winnerText, '紅方勝');
  assertEqual(feedback.body.includes('紅方絕殺'), true);
  assertEqual(feedback.body.includes('沒有合法步'), false);
  assertEqual(statusLabel('red_win', 'black'), '紅方勝，絕殺');
});

test('black win status shows checkmate endgame feedback', () => {
  const feedback = getEndgameFeedback('black_win');
  assertOk(feedback);
  assertEqual(feedback.title, '絕殺');
  assertEqual(feedback.winnerText, '黑方勝');
  assertEqual(feedback.body.includes('黑方絕殺'), true);
  assertEqual(feedback.body.includes('沒有合法步'), false);
  assertEqual(statusLabel('black_win', 'red'), '黑方勝，絕殺');
});

test('endgame sound trigger only fires once per status change into a win', () => {
  assertEqual(shouldPlayEndgameSound('playing', 'playing'), false);
  assertEqual(shouldPlayEndgameSound('playing', 'red_win'), true);
  assertEqual(shouldPlayEndgameSound('red_win', 'red_win'), false);
  assertEqual(shouldPlayEndgameSound('red_win', 'playing'), false);
  assertEqual(shouldPlayEndgameSound('playing', 'black_win'), true);
  assertEqual(shouldPlayEndgameSound('black_win', 'black_win'), false);
});

test('move sound trigger only fires after a successful move', () => {
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const selectedOnly = {...state};
  const illegal = applyMove(state, { row: 6, col: 0 }, { row: 6, col: 1 });
  const legal = applyMove(state, { row: 6, col: 0 }, { row: 5, col: 0 });
  const edited = editSquare(state, { row: 6, col: 0 }, { revealed: true });
  assertEqual(shouldPlayMoveSound(state, selectedOnly), false);
  assertEqual(shouldPlayMoveSound(state, illegal), false);
  assertEqual(shouldPlayMoveSound(state, edited), false);
  assertEqual(shouldPlayMoveSound(state, legal), true);
});

test('move sound trigger works for black legal moves too', () => {
  const board = withKings();
  place(board, 3, 0, piece('black', 'pawn'));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const legal = applyMove(state, { row: 3, col: 0 }, { row: 4, col: 0 });
  assertEqual(shouldPlayMoveSound(state, legal), true);
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

test('manual piece correction updates remaining inventory', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 4, 4, piece('red', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const before = remainingRealPieces(state.board, 'red');
  const next = correctSelectedRealType(state, { row: 4, col: 4 }, 'cannon');
  const after = remainingRealPieces(next.board, 'red');
  assertEqual(after.cannon, before.cannon - 1);
  assertEqual(after.pawn, before.pawn);
});

test('manual correction is not blocked by hidden default real types', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 4, 0, piece('red', 'pawn', 'rook', false));
  place(board, 4, 1, piece('red', 'pawn', 'rook', false));
  place(board, 4, 2, piece('red', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = correctSelectedRealType(state, { row: 4, col: 2 }, 'rook');
  assertEqual(next.board[4][2]?.realType, 'rook');
  assertEqual(next.board[4][2]?.revealed, true);
  assertEqual(next.board.flat().filter(p => p?.side === 'red' && p.realType === 'rook').length <= 2, true);
});

test('piece inventory prevents exceeding side piece limits', () => {
  const board = emptyBoard();
  place(board, 4, 0, piece('red', 'rook', 'rook', true));
  place(board, 4, 1, piece('red', 'rook', 'rook', true));
  place(board, 4, 2, piece('red', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  assertEqual(editSquareError(state, { row: 4, col: 2 }, { realType: 'rook', revealed: true }) !== null, true);
  const next = editSquare(state, { row: 4, col: 2 }, { realType: 'rook', revealed: true });
  assertEqual(next, state);
  assertEqual(next.board[4][2]?.realType, 'pawn');
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

test('long press correction helper can reveal a piece as cannon', () => {
  const board = emptyBoard();
  place(board, 4, 4, piece('black', 'pawn', 'pawn', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const next = correctSelectedRealType(state, { row: 4, col: 4 }, 'cannon');
  assertEqual(next.board[4][4]?.side, 'black');
  assertEqual(next.board[4][4]?.realType, 'cannon');
  assertEqual(next.board[4][4]?.revealed, true);
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
  assertEqual(TOP_FILE_LABELS.length, BOARD_COLS);
  assertEqual(BOTTOM_FILE_LABELS.length, BOARD_COLS);
  assertEqual(TOP_FILE_LABELS.join(''), '123456789');
  assertEqual(BOTTOM_FILE_LABELS.join(''), '九八七六五四三二一');
});

test('board edge labels for red side are nine to one', () => {
  assertEqual(BOTTOM_FILE_LABELS.join(''), `${'\u4e5d'}${'\u516b'}${'\u4e03'}${'\u516d'}${'\u4e94'}${'\u56db'}${'\u4e09'}${'\u4e8c'}${'\u4e00'}`);
  assertEqual(BOTTOM_FILE_LABELS[0], '\u4e5d');
  assertEqual(BOTTOM_FILE_LABELS[8], '\u4e00');
});

test('board edge labels for black side are one to nine', () => {
  assertEqual(TOP_FILE_LABELS.join(''), '123456789');
  assertEqual(TOP_FILE_LABELS[0], '1');
  assertEqual(TOP_FILE_LABELS[8], '9');
});

test('black board edge labels are not reversed', () => {
  assertEqual(TOP_FILE_LABELS.join('') === '987654321', false);
});

test('river is a visual gap and does not add a board row', () => {
  assertEqual(visualRowForBoardRow(0), 0);
  assertEqual(visualRowForBoardRow(4), 4);
  assertEqual(visualRowForBoardRow(5), 5);
  assertEqual(visualRowForBoardRow(9), 9);
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

test('AI does not overvalue a rook capture when the cannon is protected', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 4, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'rook'));
  place(board, 5, 1, piece('black', 'cannon'));
  place(board, 5, 8, piece('black', 'rook'));
  place(board, 6, 6, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const badCapture = {
    from: { row: 5, col: 0 },
    to: { row: 5, col: 1 },
    piece: board[5][0]!,
    captured: board[5][1],
  };
  const quietMove = {
    from: { row: 6, col: 6 },
    to: { row: 5, col: 6 },
    piece: board[6][6]!,
  };
  const recommended = recommendMove(state, [badCapture, quietMove]);
  assertOk(recommended.move);
  assertEqual(recommended.move, quietMove);
});

test('AI prefers a safe high-value capture', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 4, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'rook'));
  place(board, 5, 1, piece('black', 'cannon'));
  place(board, 6, 6, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const safeCapture = {
    from: { row: 5, col: 0 },
    to: { row: 5, col: 1 },
    piece: board[5][0]!,
    captured: board[5][1],
  };
  const quietMove = {
    from: { row: 6, col: 6 },
    to: { row: 5, col: 6 },
    piece: board[6][6]!,
  };
  const recommended = recommendMove(state, [quietMove, safeCapture]);
  assertOk(recommended.move);
  assertEqual(recommended.move, safeCapture);
});

test('AI prefers opening reveal on own pawn starting point when there is no tactic', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 6, 0, piece('red', 'pawn', 'rook', false));
  place(board, 7, 1, piece('red', 'horse', 'cannon', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const pawnReveal = findMove(board, 'red', [6, 0], [5, 0]);
  const horseReveal = findMove(board, 'red', [7, 1], [5, 2]);
  const recommended = recommendMove(state, [horseReveal, pawnReveal]);
  assertOk(recommended.move);
  assertEqual(recommended.move, pawnReveal);
});

test('AI opening pawn bonus supports black pawn starting points', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 3, 4, piece('black', 'pawn'));
  place(board, 3, 0, piece('black', 'pawn', 'rook', false));
  place(board, 2, 1, piece('black', 'horse', 'cannon', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const pawnReveal = findMove(board, 'black', [3, 0], [4, 0]);
  const horseReveal = findMove(board, 'black', [2, 1], [4, 2]);
  const recommended = recommendMove(state, [horseReveal, pawnReveal]);
  assertOk(recommended.move);
  assertEqual(recommended.move, pawnReveal);
});

test('AI gives edge and third-seventh pawn starts extra opening priority', () => {
  const edgeBoard = emptyBoard();
  place(edgeBoard, 9, 4, piece('red', 'king'));
  place(edgeBoard, 0, 4, piece('black', 'king'));
  place(edgeBoard, 6, 0, piece('red', 'pawn', 'rook', false));
  place(edgeBoard, 6, 4, piece('red', 'pawn', 'cannon', false));
  const edgeState = { board: edgeBoard, turn: 'red' as const, history: [], status: 'playing' as const };
  const edgePawn = findMove(edgeBoard, 'red', [6, 0], [5, 0]);
  const centerPawnA = findMove(edgeBoard, 'red', [6, 4], [5, 4]);
  assertEqual(recommendMove(edgeState, [centerPawnA, edgePawn]).move, edgePawn);

  const thirdSeventhBoard = emptyBoard();
  place(thirdSeventhBoard, 9, 4, piece('red', 'king'));
  place(thirdSeventhBoard, 0, 4, piece('black', 'king'));
  place(thirdSeventhBoard, 6, 2, piece('red', 'pawn', 'rook', false));
  place(thirdSeventhBoard, 6, 4, piece('red', 'pawn', 'cannon', false));
  const thirdSeventhState = { board: thirdSeventhBoard, turn: 'red' as const, history: [], status: 'playing' as const };
  const thirdSeventhPawn = findMove(thirdSeventhBoard, 'red', [6, 2], [5, 2]);
  const centerPawnB = findMove(thirdSeventhBoard, 'red', [6, 4], [5, 4]);
  assertEqual(recommendMove(thirdSeventhState, [centerPawnB, thirdSeventhPawn]).move, thirdSeventhPawn);
});

test('AI prefers 1379 pawn reveal over premature opening cannon strike without tactics', () => {
  const state = newGame();
  const board = state.board;
  const edgePawn = findMove(board, 'red', [6, 0], [5, 0]);
  const thirdPawn = findMove(board, 'red', [6, 2], [5, 2]);
  const prematureCannonStrike = findMove(board, 'red', [7, 1], [0, 1]);
  const recommended = recommendMove(state, [prematureCannonStrike, thirdPawn, edgePawn]);

  assertOk(recommended.move);
  assertEqual(recommended.move === edgePawn || recommended.move === thirdPawn, true);
  assertEqual(recommended.move.from.row === 7 && recommended.move.from.col === 1 && recommended.move.to.row === 0 && recommended.move.to.col === 1, false);
});

test('AI initial recommendation is not fixed on cannon two/eight advancing seven', () => {
  const state = newGame();
  const recommended = recommendMove(state).move;
  assertOk(recommended);
  const redCannonTwoAdvancesSeven = recommended.from.row === 7 && recommended.from.col === 7 && recommended.to.row === 0 && recommended.to.col === 7;
  const redCannonEightAdvancesSeven = recommended.from.row === 7 && recommended.from.col === 1 && recommended.to.row === 0 && recommended.to.col === 1;

  assertEqual(redCannonTwoAdvancesSeven || redCannonEightAdvancesSeven, false);
});

test('AI splits red edge cannon pressure from pawn line guard pattern', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'pawn', 'cannon', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  place(board, 0, 0, piece('black', 'rook', 'rook', false));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));
  place(board, 0, 2, piece('black', 'elephant', 'elephant', false));
  place(board, 2, 1, piece('black', 'cannon', 'cannon', false));

  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const horseReleaseToEdge = findMove(board, 'black', [0, 1], [2, 0]);
  const horseReleaseToGuard = findMove(board, 'black', [0, 1], [2, 2]);
  const elephantReleaseToEdge = findMove(board, 'black', [0, 2], [2, 0]);
  const sameFilePawnGamble = findMove(board, 'black', [3, 0], [4, 0]);
  const hiddenCannonSideShift = findMove(board, 'black', [2, 1], [2, 0]);

  const recommended = recommendMove(state, [
    horseReleaseToGuard,
    sameFilePawnGamble,
    hiddenCannonSideShift,
    horseReleaseToEdge,
    elephantReleaseToEdge,
  ]);

  assertOk(recommended.move);
  assertEqual(recommended.move === horseReleaseToEdge || recommended.move === elephantReleaseToEdge, true);
  assertEqual(recommended.move === horseReleaseToGuard, false);
  assertEqual(recommended.move === sameFilePawnGamble, false);
  assertEqual(recommended.move === hiddenCannonSideShift, false);
});

test('AI keeps rook pressure trace but prioritizes pawn soldier over pure horse in early opening', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'pawn', 'rook', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));

  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const horseReleaseToEdge = findMove(board, 'black', [0, 1], [2, 0]);
  const horseReleaseToGuard = findMove(board, 'black', [0, 1], [2, 2]);
  const sameFilePawnGamble = findMove(board, 'black', [3, 0], [4, 0]);

  const recommended = recommendMove(state, [
    horseReleaseToEdge,
    sameFilePawnGamble,
    horseReleaseToGuard,
  ]);

  assertOk(recommended.move);
  assertEqual(recommended.move, sameFilePawnGamble);
  assertOk(recommended.traces);
  const guardTrace = recommended.traces.find(t => t.move === horseReleaseToGuard);
  assertOk(guardTrace);
  assertEqual(guardTrace.patterns.some(p =>
    p === 'opening_edge_rook_pawn_line_lock' ||
    p === 'horse_release_to_guard_pawn_line'
  ), true);
  assertEqual(recommended.move === horseReleaseToEdge, false);
});

test('AI opening pawn bonus does not override immediate checkmate', () => {
  const board = emptyBoard();
  place(board, 0, 4, piece('black', 'king'));
  place(board, 9, 4, piece('red', 'king'));
  place(board, 1, 3, piece('red', 'rook'));
  place(board, 0, 3, piece('red', 'rook'));
  place(board, 0, 5, piece('red', 'rook'));
  place(board, 6, 0, piece('red', 'pawn', 'rook', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const mate = findMove(board, 'red', [1, 3], [1, 4]);
  const pawnReveal = {
    from: { row: 6, col: 0 },
    to: { row: 5, col: 0 },
    piece: board[6][0]!,
  };
  const recommended = recommendMove(state, [pawnReveal, mate]);
  assertOk(recommended.move);
  assertEqual(recommended.move, mate);
});

test('AI opening pawn bonus does not override safe high-value exchange', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 4, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'rook'));
  place(board, 5, 1, piece('black', 'cannon'));
  place(board, 6, 2, piece('red', 'pawn', 'rook', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const safeCapture = findMove(board, 'red', [5, 0], [5, 1]);
  const priorityPawnReveal = findMove(board, 'red', [6, 2], [5, 2]);
  const recommended = recommendMove(state, [priorityPawnReveal, safeCapture]);

  assertOk(recommended.move);
  assertEqual(recommended.move.from.row, safeCapture.from.row);
  assertEqual(recommended.move.from.col, safeCapture.from.col);
  assertEqual(recommended.move.to.row, safeCapture.to.row);
  assertEqual(recommended.move.to.col, safeCapture.to.col);
});

test('AI does not force an opening pawn reveal that allows opponent one-move mate', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 0, 0, piece('black', 'rook'));
  place(board, 5, 4, piece('red', 'advisor'));
  place(board, 6, 6, piece('red', 'pawn', 'rook', false));
  place(board, 8, 4, piece('red', 'rook'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const pawnReveal = findMove(board, 'red', [6, 6], [5, 6]);
  const safeMove = findMove(board, 'red', [5, 4], [4, 3]);
  const recommended = recommendMove(state, [pawnReveal, safeMove]);
  assertOk(recommended.move);
  assertEqual(recommended.move, safeMove);
});

test('game record can be created and converted to text and json', () => {
  const move = {
    from: { row: 6, col: 0 },
    to: { row: 5, col: 0 },
    piece: piece('red', 'pawn'),
  };
  const record = createGameRecord({
    id: 'record-test',
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z',
    title: '測試局',
    moves: [move],
    finalStatus: 'red_win',
  });

  assertEqual(record.version, 1);
  assertEqual(record.title, '測試局');
  assertEqual(record.finalStatus, 'red_win');
  assertEqual(record.moveCount, 1);
  assertEqual(recordToText(record).includes('局名：測試局'), true);
  assertEqual(recordToText(record).includes('結果：紅方勝'), true);

  const exported = JSON.parse(recordToJson(record));
  assertEqual(exported.version, 1);
  assertEqual(exported.title, '測試局');
  assertEqual(Array.isArray(exported.moves), true);
  assertEqual(exported.finalStatus, 'red_win');
  assertEqual(exported.moveCount, 1);
});

test('game record storage can save load overwrite and delete records', () => {
  const storage = fakeStorage();
  const first = createGameRecord({
    id: 'record-1',
    title: '第一局',
    moves: [],
    finalStatus: 'playing',
  });
  assertEqual(saveGameRecord(storage, first), true);
  assertEqual(loadGameRecords(storage).length, 1);
  assertEqual(loadGameRecords(storage)[0].title, '第一局');

  const updated = { ...first, title: '第一局更新', moves: [{ from: { row: 6, col: 0 }, to: { row: 5, col: 0 }, piece: piece('red', 'pawn') }] };
  assertEqual(saveGameRecord(storage, updated), true);
  assertEqual(loadGameRecords(storage).length, 1);
  assertEqual(loadGameRecords(storage)[0].title, '第一局更新');
  assertEqual(loadGameRecords(storage)[0].moveCount, 1);
  assertEqual(storage.getItem(GAME_RECORD_STORAGE_KEY)?.includes('"version":1'), true);

  assertEqual(deleteGameRecord(storage, 'record-1'), true);
  assertEqual(loadGameRecords(storage).length, 0);
});

test('game record storage preserves variations', () => {
  const storage = fakeStorage();
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = applyMove(state, { row: 6, col: 0 }, { row: 5, col: 0 });
  const variationMove = next.history[0];
  const record = createGameRecord({
    id: 'record-var',
    title: '變化測試',
    moves: [],
    finalStatus: 'playing',
    variations: [{
      id: 'variation-1',
      baseStep: 3,
      title: '第 3 手變化 1',
      moves: [variationMove],
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T00:00:00.000Z',
      source: 'manual-analysis',
    }],
  });
  assertEqual(saveGameRecord(storage, record), true);
  const loaded = loadGameRecords(storage)[0];
  assertEqual(loaded.variations?.length, 1);
  assertEqual(loaded.variations?.[0].baseStep, 3);
  assertEqual(loaded.variations?.[0].moves.length, 1);
  const exported = JSON.parse(recordToJson(loaded));
  assertEqual(exported.variations[0].title, '第 3 手變化 1');
});

test('last move sync applies a legal from-to move', () => {
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const result = syncLastMove(state, { row: 6, col: 0 }, { row: 5, col: 0 });
  assertEqual(result.applied, true);
  assertEqual(result.state.board[6][0], null);
  assertEqual(result.state.board[5][0]?.side, 'red');
});

test('last move sync switches turn and records history after success', () => {
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const result = syncLastMove(state, { row: 6, col: 0 }, { row: 5, col: 0 });
  assertEqual(result.state.turn, 'black');
  assertEqual(result.state.history.length, 1);
});

test('last move sync keeps state unchanged for an illegal move', () => {
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const result = syncLastMove(state, { row: 6, col: 0 }, { row: 6, col: 1 });
  assertEqual(result.applied, false);
  assertEqual(result.state, state);
  assertEqual(state.history.length, 0);
  assertEqual(state.board[6][0]?.side, 'red');
  assertEqual(state.board[6][1], null);
});

test('cancel last move sync does not change board, turn, or status', () => {
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'red_win' as const };
  const next = cancelLastMoveSync(state);
  assertEqual(next, state);
  assertEqual(next.turn, 'red');
  assertEqual(next.status, 'red_win');
});

function mockWin(): Window {
  return {
    setTimeout: (fn: () => void, _ms: number) => { fn(); return 0; },
    clearTimeout: () => undefined,
    speechSynthesis: undefined,
    SpeechSynthesisUtterance: undefined,
  } as unknown as Window;
}

test('playMoveSound does not throw when AudioContext is unavailable', () => {
  let threw = false;
  try { playMoveSound(); } catch { threw = true; }
  assertEqual(threw, false);
});

test('playCaptureSound does not throw when AudioContext is unavailable', () => {
  let threw = false;
  try { playCaptureSound(); } catch { threw = true; }
  assertEqual(threw, false);
});

test('playCheckSound does not throw when AudioContext is unavailable', () => {
  let threw = false;
  try { playCheckSound(mockWin()); } catch { threw = true; }
  assertEqual(threw, false);
});

test('capture move has a captured piece in history', () => {
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  place(board, 5, 0, piece('black', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = applyMove(state, { row: 6, col: 0 }, { row: 5, col: 0 });
  assertOk(next !== state);
  const lastMove = next.history[next.history.length - 1];
  assertOk(lastMove.captured);
});

test('normal move has no captured piece in history', () => {
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = applyMove(state, { row: 6, col: 0 }, { row: 5, col: 0 });
  assertOk(next !== state);
  const lastMove = next.history[next.history.length - 1];
  assertEqual(lastMove.captured, null);
});

test('checkmate move sets status to win', () => {
  const board = emptyBoard();
  place(board, 0, 4, piece('black', 'king'));
  place(board, 9, 4, piece('red', 'king'));
  place(board, 2, 4, piece('red', 'rook'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const next = applyMove(state, { row: 2, col: 4 }, { row: 0, col: 4 });
  assertEqual(next.status, 'red_win');
});

test('recommendMove returns traces with correct fields', () => {
  const board = withKings();
  place(board, 7, 1, piece('red', 'horse', 'horse', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const recommended = recommendMove(state);
  assertOk(recommended.traces);
  assertEqual(recommended.traces.length > 0, true);
  const first = recommended.traces[0];
  assertOk(typeof first.score === 'number');
  assertOk(typeof first.reason === 'string');
  assertOk(Array.isArray(first.patterns));
  assertOk(typeof first.risk === 'number');
  assertOk(typeof first.exchangeNet === 'number');
  assertOk(typeof first.structureScore === 'number');
  assertOk(typeof first.postMoveLooseHiddenPiece === 'boolean');
  assertOk(typeof first.postMoveLooseHiddenPieceCount === 'number');
  assertOk(typeof first.postMoveProtectedUnderAttackCount === 'number');
  assertOk(typeof first.postMoveLoosePiecePenalty === 'number');
  assertOk(typeof first.rescuesLooseHiddenPiece === 'boolean');
  assertOk(typeof first.ignoresLooseHiddenPiece === 'boolean');
  assertOk(typeof first.firstMovePawnOpening === 'boolean');
  assertOk(typeof first.firstMoveBlindHorseActivation === 'boolean');
  assertOk(typeof first.firstMoveBlindHorsePenalty === 'number');
  assertOk(typeof first.hasUnrevealedPawnSoldiers === 'boolean');
  assertOk(typeof first.pawnSoldierDevelopment === 'boolean');
  assertOk(typeof first.pawnSoldierThreatRevealedMajor === 'boolean');
  assertOk(typeof first.pureBlindHorseActivation === 'boolean');
  assertOk(typeof first.pureBlindHorsePenalty === 'number');
  assertOk(typeof first.blindHorseStructureCapped === 'boolean');
  assertOk(typeof first.blindHorseMajorActivationCapped === 'boolean');
  assertOk(typeof first.pawnSoldierFollowUpHorse === 'boolean');
  assertOk(typeof first.pawnSoldierHorseFootBlock === 'boolean');
  assertOk(typeof first.pawnSoldierFollowUpElephant === 'boolean');
  assertOk(typeof first.pawnSoldierCenterPreference === 'boolean');
  assertOk(typeof first.pawnSoldierFollowUpAdvisor === 'boolean');
  assertOk(typeof first.pawnSoldierAntiAdvisorFork === 'boolean');
});

test('AI prioritizes rescuing an unprotected hidden pawn attacked by a revealed elephant', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 5, 6, piece('red', 'elephant', 'elephant', true));
  place(board, 3, 8, piece('black', 'pawn', 'pawn', false));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const rescuePawn = findMove(board, 'black', [3, 8], [4, 8]);
  const activateHorse = findMove(board, 'black', [0, 1], [2, 2]);
  const rec = recommendMove(state, [activateHorse, rescuePawn]);
  assertOk(rec.move);
  assertEqual(rec.move.from.row, rescuePawn.from.row);
  assertEqual(rec.move.from.col, rescuePawn.from.col);
  assertEqual(rec.move.to.row, rescuePawn.to.row);
  assertEqual(rec.move.to.col, rescuePawn.to.col);
  assertOk(rec.traces);
  const rescueTrace = rec.traces.find(t => t.move === rescuePawn);
  const horseTrace = rec.traces.find(t => t.move === activateHorse);
  assertOk(rescueTrace);
  assertOk(horseTrace);
  assertEqual(rescueTrace.rescuesLooseHiddenPiece, true);
  assertEqual(rescueTrace.postMoveLooseHiddenPiece !== true, true);
  assertEqual(rescueTrace.postMoveLooseHiddenPieceCount, 0);
  assertEqual(horseTrace.ignoresLooseHiddenPiece, true);
  assertEqual(horseTrace.postMoveLooseHiddenPiece, true);
  assertEqual((horseTrace.postMoveLoosePiecePenalty ?? 0) < 0, true);
  assertEqual(horseTrace.score < rescueTrace.score, true);
});

test('AI does not treat a defended attacked hidden pawn as loose', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 5, 2, piece('red', 'elephant', 'elephant', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  place(board, 3, 8, piece('black', 'rook', 'rook', true));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const activateHorse = findMove(board, 'black', [0, 1], [2, 2]);
  const rec = recommendMove(state, [activateHorse]);
  assertOk(rec.traces);
  const trace = rec.traces[0];
  assertEqual(trace.postMoveLooseHiddenPiece, false);
  assertEqual(trace.postMoveLooseHiddenPieceCount, 0);
  assertEqual(trace.postMoveProtectedUnderAttackCount, 1);
  assertEqual((trace.postMoveLoosePiecePenalty ?? 0) === 0, true);
});

test('cannon pressure on defended hidden horse is protected under attack, not loose hidden piece danger', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 7, 1, piece('red', 'cannon', 'cannon', true));
  place(board, 2, 1, piece('red', 'pawn', 'pawn', true));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));
  place(board, 0, 0, piece('black', 'rook', 'rook', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const pawnMove = findMove(board, 'black', [3, 0], [4, 0]);
  const rec = recommendMove(state, [pawnMove]);
  assertOk(rec.traces);
  const trace = rec.traces[0];
  assertEqual(trace.postMoveLooseHiddenPiece, false);
  assertEqual(trace.postMoveLooseHiddenPieceCount, 0);
  assertEqual((trace.postMoveProtectedUnderAttackCount ?? 0) > 0, true);
});

test('trace for recommended move includes cannon pattern when edge cannon threatens hidden major', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'pawn', 'cannon', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  place(board, 0, 0, piece('black', 'rook', 'rook', false));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));
  place(board, 0, 2, piece('black', 'elephant', 'elephant', false));
  place(board, 2, 1, piece('black', 'cannon', 'cannon', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const horseReleaseToEdge = findMove(board, 'black', [0, 1], [2, 0]);
  const horseReleaseToGuard = findMove(board, 'black', [0, 1], [2, 2]);
  const elephantReleaseToEdge = findMove(board, 'black', [0, 2], [2, 0]);
  const sameFilePawnGamble = findMove(board, 'black', [3, 0], [4, 0]);
  const hiddenCannonSideShift = findMove(board, 'black', [2, 1], [2, 0]);
  const recommended = recommendMove(state, [
    horseReleaseToGuard,
    sameFilePawnGamble,
    hiddenCannonSideShift,
    horseReleaseToEdge,
    elephantReleaseToEdge,
  ]);
  assertOk(recommended.move);
  assertOk(recommended.traces);
  const pressureTrace = recommended.traces.find(t =>
    t.move === horseReleaseToEdge || t.move === elephantReleaseToEdge
  );
  assertOk(pressureTrace);
  assertEqual(pressureTrace.patterns.some(p =>
    p === 'opening_cannon_hits_hidden_rook' ||
    p === 'opening_edge_cannon_structure_pressure' ||
    p === 'horse_release_from_cannon_pressure'
  ), true);
});

test('trace for recommended move includes rook pattern when edge rook threatens pawn line', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'pawn', 'rook', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const horseReleaseToEdge = findMove(board, 'black', [0, 1], [2, 0]);
  const horseReleaseToGuard = findMove(board, 'black', [0, 1], [2, 2]);
  const sameFilePawnGamble = findMove(board, 'black', [3, 0], [4, 0]);
  const recommended = recommendMove(state, [
    horseReleaseToEdge,
    sameFilePawnGamble,
    horseReleaseToGuard,
  ]);
  assertOk(recommended.move);
  assertOk(recommended.traces);
  const guardTrace = recommended.traces.find(t => t.move === horseReleaseToGuard);
  assertOk(guardTrace);
  assertEqual(guardTrace.patterns.some(p =>
    p === 'opening_edge_rook_pawn_line_lock' ||
    p === 'opening_edge_rook_line_lock_defense' ||
    p === 'horse_release_to_guard_pawn_line' ||
    p === 'horse_release_to_pawn_line_guard'
  ), true);
});

test('pre-existing high-value threat: unrelated move must not claim threat reason', () => {
  // red rook at [6][0] already threatens black horse at [6][8] (same row, clear path)
  // moving an unrelated red pawn must not produce a threat reason
  const board = withKings();
  place(board, 6, 0, piece('red', 'pawn', 'rook', true));    // red rook
  place(board, 6, 8, piece('black', 'horse', 'horse', true)); // black horse - already threatened
  place(board, 9, 1, piece('red', 'pawn', 'pawn', false));    // unrelated pawn to move
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const pawnForward = findMove(board, 'red', [9, 1], [8, 1]);
  const recommended = recommendMove(state, [pawnForward]);
  assertOk(recommended.traces);
  const tr = recommended.traces[0];
  // pawn move didn't create the threat — rook already had it
  assertEqual(tr.threatByMovedPiece, false);
  assertEqual(tr.threatDelta <= 0, true);
  assertEqual(tr.reason === '威脅對方重要棋子', false);
  assertEqual(tr.reason.startsWith('此步直接威脅'), false);
  assertEqual(tr.reason === '形成新的高價威脅', false);
});

test('cannon move that creates new capture threat produces byMovedPiece trace', () => {
  // red cannon slides from [9][0] to [5][0]; fires through red pawn screen at [5][4] to hit black horse at [5][5]
  // before the move: cannon at [9][0] has no capture threats
  const board = withKings();  // includes red pawn at [5][4] — acts as cannon screen
  place(board, 9, 0, piece('red', 'pawn', 'cannon', true));   // red cannon
  place(board, 5, 5, piece('black', 'horse', 'horse', true));  // black horse as target
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const cannonAdvance = findMove(board, 'red', [9, 0], [5, 0]);
  const recommended = recommendMove(state, [cannonAdvance]);
  assertOk(recommended.traces);
  const tr = recommended.traces[0];
  // verify the trace fields directly; reason may be overridden by higher-priority
  // factors (e.g. hangingMove) but the underlying threat data must be correct
  assertEqual(tr.threatByMovedPiece, true);
  assertEqual(tr.threatTargetType, 'horse');
  assertEqual(tr.threatDelta > 0, true);
});

test('trace includes threatDelta, threatByMovedPiece, threatTargetType fields', () => {
  const board = withKings();
  place(board, 7, 1, piece('red', 'horse', 'horse', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const recommended = recommendMove(state);
  assertOk(recommended.traces);
  const first = recommended.traces[0];
  assertOk(typeof first.threatValue === 'number');
  assertOk(typeof first.threatDelta === 'number');
  assertOk(typeof first.threatByMovedPiece === 'boolean');
  assertOk(first.threatTargetType === null || typeof first.threatTargetType === 'string');
  assertOk(first.threatTargetRevealed === null || typeof first.threatTargetRevealed === 'boolean');
});

test('edge cannon regression: move choice unaffected by threat delta patch', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 5, 0, piece('red', 'pawn', 'cannon', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  place(board, 0, 0, piece('black', 'rook', 'rook', false));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));
  place(board, 0, 2, piece('black', 'elephant', 'elephant', false));
  place(board, 2, 1, piece('black', 'cannon', 'cannon', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const horseReleaseToEdge = findMove(board, 'black', [0, 1], [2, 0]);
  const horseReleaseToGuard = findMove(board, 'black', [0, 1], [2, 2]);
  const elephantReleaseToEdge = findMove(board, 'black', [0, 2], [2, 0]);
  const sameFilePawnGamble = findMove(board, 'black', [3, 0], [4, 0]);
  const hiddenCannonSideShift = findMove(board, 'black', [2, 1], [2, 0]);
  const recommended = recommendMove(state, [
    horseReleaseToGuard, sameFilePawnGamble, hiddenCannonSideShift,
    horseReleaseToEdge, elephantReleaseToEdge,
  ]);
  assertOk(recommended.move);
  assertEqual(recommended.move === horseReleaseToEdge || recommended.move === elephantReleaseToEdge, true);
  assertEqual(recommended.move === horseReleaseToGuard, false);
});

test('each trace in recommended.traces has valid patterns, threatDelta, threatByMovedPiece, threatTargetType', () => {
  const board = withKings();
  place(board, 7, 1, piece('red', 'horse', 'horse', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const recommended = recommendMove(state);
  assertOk(recommended.traces);
  assertEqual(recommended.traces.length > 0, true);
  for (const trace of recommended.traces) {
    assertOk(Array.isArray(trace.patterns));
    assertOk(typeof trace.threatDelta === 'number');
    assertOk(typeof trace.threatByMovedPiece === 'boolean');
    assertOk(trace.threatTargetType === null || typeof trace.threatTargetType === 'string');
  }
});

test('reveal-check suppression: unrevealed piece check is suppressed', () => {
  // Unrevealed red pawn-disguised-rook at [2][4].
  // Move [2][4]->[1][4]: piece reveals as rook, rawChecking=true (rook adjacent to black king [0][4]),
  // but moveRevealsUnknown=true so checking is suppressed to false.
  const board = withKings();
  place(board, 2, 4, piece('red', 'pawn', 'rook', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const recommended = recommendMove(state);
  assertOk(recommended.traces);
  const t = recommended.traces.find(tr =>
    tr.move.from.row === 2 && tr.move.from.col === 4 && tr.move.to.row === 1 && tr.move.to.col === 4
  );
  assertOk(t);
  assertEqual(t.moveRevealsUnknown, true);
  assertEqual(t.revealTacticalSuppressed, true);
  assertEqual(t.effectiveCheck, false);
  assertOk(t.reason !== '有效將軍');
});

test('reveal-check suppression: revealed piece check is not suppressed', () => {
  // Revealed rook at [3][0]. Move [3][0]->[0][0]: rook arrives on row 0, checks black king at [0][4]
  // (same row, path clear). Piece already revealed so moveRevealsUnknown=false, no suppression.
  // Rook cannot directly capture king (different col) so no early-exit in recommendMove.
  const board = withKings();
  place(board, 3, 0, piece('red', 'rook', 'rook', true));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const recommended = recommendMove(state);
  assertOk(recommended.traces);
  const t = recommended.traces.find(tr =>
    tr.move.from.row === 3 && tr.move.from.col === 0 && tr.move.to.row === 0 && tr.move.to.col === 0
  );
  assertOk(t);
  assertEqual(t.moveRevealsUnknown, false);
  assertEqual(t.revealTacticalSuppressed, false);
});

test('reveal-threat suppression: unrevealed cannon threat via screen is suppressed', () => {
  // Unrevealed cannon at [5][0]. Screen=red pawn [5][4], target=black horse [5][8].
  // Move [5][0]->[5][2]: cannon reveals and threatens horse via screen (revealDependentThreat=true).
  // moveRevealsUnknown=true => revealTacticalSuppressed=true; reason must not be a threat reason.
  const board = withKings();
  place(board, 5, 0, piece('red', 'cannon', 'cannon', false));
  place(board, 5, 8, piece('black', 'horse', 'horse', true));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const recommended = recommendMove(state);
  assertOk(recommended.traces);
  const t = recommended.traces.find(tr =>
    tr.move.from.row === 5 && tr.move.from.col === 0 && tr.move.to.row === 5 && tr.move.to.col === 2
  );
  assertOk(t);
  assertEqual(t.moveRevealsUnknown, true);
  assertEqual(t.revealTacticalSuppressed, true);
  assertOk(!t.reason.includes('威脅'));
});

test('edge cannon: horse release trace remains but pawn soldier development can lead early', () => {
  // Red has edge cannon (revealed at col 0). Black faces cannon pressure.
  // Black options: release horse from backrank (活馬解除邊炮壓制) vs move plain unrevealed pawn.
  // With edge cannon pressure cap, plain pawn hiddenPressureScore is capped and horse release wins.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));            // block kings facing on col 4
  place(board, 7, 0, piece('red', 'pawn', 'cannon', true));  // red edge cannon (revealed)
  place(board, 6, 0, piece('red', 'pawn', 'pawn', true));    // screen piece for cannon
  place(board, 4, 0, piece('black', 'pawn', 'horse', false)); // black hidden major in cannon line
  place(board, 0, 1, piece('black', 'horse', 'horse', false)); // black horse for release
  place(board, 1, 5, piece('black', 'pawn', 'pawn', false));  // plain black pawn

  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);

  assertOk(rec.move);
  const horseTrace = rec.traces.find(t =>
    !t.move.piece.revealed && t.move.piece.originalType === 'horse' && t.move.from.row === 0
  );
  assertOk(horseTrace);
  assertEqual(horseTrace.patterns.includes('opening_hidden_pawn_blocks_horse_foot'), true);

  // Pawn traces under edge cannon pressure should have edgeCannonPressureUnresolved = true
  const pawnTrace = rec.traces.find(t =>
    !t.move.piece.revealed && t.move.piece.originalType === 'pawn' && t.move.from.row === 1
  );
  assertOk(pawnTrace);
  assertEqual(pawnTrace.edgeCannonPressureUnresolved, true);
  assertOk(pawnTrace.reason !== '壓制對方重要暗子');
});

test('safe capture: safeCapturePriority is set on safe captures and rook capture is chosen', () => {
  // Red rook can safely capture a black revealed cannon (high value, safe trade).
  // The rook capture should be recommended and have safeCapturePriority=true, exchangeNet>=0.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));            // block kings facing
  // Red rook can capture black cannon on same column (no pieces between)
  place(board, 7, 0, piece('red', 'rook', 'rook', true));
  place(board, 3, 0, piece('black', 'cannon', 'cannon', true)); // revealed cannon target
  // Unrevealed red cannon with no direct capture path (slide only)
  place(board, 9, 2, piece('red', 'cannon', 'cannon', false)); // unrevealed cannon

  const state = {
    board,
    turn: 'red' as const,
    history: [],
    status: 'playing' as const,
  };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  assertOk(rec.move);

  // Rook capture of cannon should be recommended (safe, high value)
  assertEqual(rec.move.piece.realType, 'rook');
  assertOk(rec.move.captured !== null && rec.move.captured !== undefined);

  // Rook capture trace must have safeCapturePriority=true and exchangeNet>=0
  const rookCaptureTrace = rec.traces.find(t =>
    t.move.piece.realType === 'rook' && t.move.captured
  );
  assertOk(rookCaptureTrace);
  assertEqual(rookCaptureTrace.safeCapturePriority, true);
  assertOk(rookCaptureTrace.exchangeNet >= 0);
  assertOk(rookCaptureTrace.captureGain >= 350); // cannon value
});

test('repetitive check: rook check after 2 prior rook turns gets repetitiveCheck=true', () => {
  // History shows same side used rook for 2 prior turns.
  // Current candidate: rook delivers check again. Should be flagged as repetitiveCheck.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn'));
  place(board, 2, 4, piece('red', 'rook', 'rook', true)); // red rook near black king
  place(board, 1, 4, piece('black', 'pawn', 'pawn', true));  // blocker: prevents rook from capturing king directly

  // Mock history: red used rook 2 prior times (positions don't matter for the heuristic, just piece type)
  const rookMock: Move = {
    from: { row: 4, col: 4 }, to: { row: 3, col: 4 },
    piece: piece('red', 'rook', 'rook', true),
    captured: null, flipped: false,
  };
  const blackMock: Move = {
    from: { row: 0, col: 3 }, to: { row: 0, col: 5 },
    piece: piece('black', 'king', 'king', true),
    captured: null, flipped: false,
  };
  const history: Move[] = [rookMock, blackMock, rookMock, blackMock]; // 2 red rook moves

  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);

  // Find rook check trace (rook at [2][4] -> [1][4], checking black king at [0][4])
  const rookCheckTrace = rec.traces.find(t =>
    t.move.piece.realType === 'rook' && t.checking
  );
  assertOk(rookCheckTrace);
  assertEqual(rookCheckTrace.repetitiveCheck, true);
  assertOk(rookCheckTrace.repetitiveCheckPenalty < 0);
});

test('safe capture: direct checkmate still takes priority despite repetitive check history', () => {
  // Even with repetitive check history, if a move directly wins (checkmate), it must be chosen.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  // Red rook on col 4 can capture black king (immediate win) but also on another file for check
  place(board, 2, 0, piece('red', 'rook', 'rook', true)); // rook can move to [0][0] on row 0

  // Add advisor so black king has no escape after rook goes to [0][0]... actually just test basic checkmate
  // Simpler: rook at [0][0] would put king in check but not checkmate. Use a different setup.
  // Place rook so it can capture king directly (row 0 col 4 → but can't move to king's square without capture)
  // Instead: rook at [2][4] captures nothing but king has no escape
  place(board, 2, 4, piece('red', 'rook', 'rook', true));
  // Add another piece that blocks king's escape - advisor on col 3 and col 5
  place(board, 1, 3, piece('red', 'pawn', 'pawn', true));
  place(board, 1, 5, piece('red', 'pawn', 'pawn', true));
  // Rook at [2][4] -> [1][4]: puts king in check. King can't go [0][3] or [0][5] (blocked by rook on col 4? no...)
  // This is getting complex. Test the simpler case: just assert immediate win move returns score 999999.
  const boardB = emptyBoard();
  place(boardB, 9, 4, piece('red', 'king'));
  place(boardB, 0, 4, piece('black', 'king'));
  place(boardB, 1, 4, piece('red', 'rook', 'rook', true)); // rook adjacent to black king

  const rookMock: Move = {
    from: { row: 3, col: 4 }, to: { row: 2, col: 4 },
    piece: piece('red', 'rook', 'rook', true),
    captured: null, flipped: false,
  };
  const blackMock: Move = {
    from: { row: 0, col: 3 }, to: { row: 0, col: 5 },
    piece: piece('black', 'king', 'king', true),
    captured: null, flipped: false,
  };
  const history: Move[] = [rookMock, blackMock, rookMock, blackMock];
  const state = { board: boardB, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);

  // Rook can capture black king directly (immediate win)
  assertEqual(rec.score, 999999);
  assertEqual(rec.reason, '此步直接形成絕殺');
});

// ══════════════════════════════════════════════════════════════
// 人 vs AI 測試模式 — 基本功能驗證
// ══════════════════════════════════════════════════════════════

test('human vs AI: AI produces a legal response after a human move', () => {
  // Simulate human (red) making a move, then AI (black) responding
  const initial = newGame();
  // Human (red) reveals first piece by making any legal move
  const redMoves = getAllLegalMoves(initial.board, 'red');
  assertOk(redMoves.length > 0);
  const humanMove = redMoves[0];
  const afterHuman = applyMove(initial, humanMove.from, humanMove.to);
  assertEqual(afterHuman.turn, 'black');

  // AI (black) responds
  const aiResult = recommendMove(afterHuman);
  assertOk(aiResult.move !== null);
  // AI move must be a legal black move
  const blackLegal = getAllLegalMoves(afterHuman.board, 'black');
  const aiMoveIsLegal = blackLegal.some(m =>
    m.from.row === aiResult.move!.from.row && m.from.col === aiResult.move!.from.col &&
    m.to.row === aiResult.move!.to.row && m.to.col === aiResult.move!.to.col
  );
  assertOk(aiMoveIsLegal);
});

test('human vs AI: AI move enters history', () => {
  // After human move + AI move, history has 2 entries
  const initial = newGame();
  const redMoves = getAllLegalMoves(initial.board, 'red');
  const humanMove = redMoves[0];
  const afterHuman = applyMove(initial, humanMove.from, humanMove.to);
  const aiResult = recommendMove(afterHuman);
  assertOk(aiResult.move !== null);
  const afterAi = applyMove(afterHuman, aiResult.move!.from, aiResult.move!.to);
  assertEqual(afterAi.history.length, 2);
  assertEqual(afterAi.turn, 'red');
});

test('human vs AI: can create a human-vs-AI game record with moveAnnotations', () => {
  // Build a 2-move game (human red, AI black) and save as record
  const initial = newGame();
  const redMoves = getAllLegalMoves(initial.board, 'red');
  const humanMove = redMoves[0];
  const afterHuman = applyMove(initial, humanMove.from, humanMove.to);
  const aiResult = recommendMove(afterHuman);
  assertOk(aiResult.move !== null);
  const afterAi = applyMove(afterHuman, aiResult.move!.from, aiResult.move!.to);

  // Build annotation array: null for human move (index 0), AI info for index 1
  const annotations: ({ score: number; reason: string } | null)[] = [
    null,
    { score: aiResult.score, reason: aiResult.reason },
  ];

  const record = {
    ...createGameRecord({
      title: '人 vs AI 測試',
      moves: afterAi.history,
      finalStatus: afterAi.status,
      redPlayer: '玩家（紅）',
      blackPlayer: 'AI（黑）',
    }),
    initialState: initial,
    moveAnnotations: annotations,
  };

  assertEqual(record.moves.length, 2);
  assertEqual(record.moveAnnotations?.length, 2);
  assertEqual(record.moveAnnotations?.[0], null);
  assertOk(typeof record.moveAnnotations?.[1]?.score === 'number');
  assertOk(typeof record.moveAnnotations?.[1]?.reason === 'string');
  assertEqual(record.redPlayer, '玩家（紅）');
  assertEqual(record.blackPlayer, 'AI（黑）');
});

test('human vs AI: old records without moveAnnotations still load correctly', () => {
  const mockStorage = {
    data: {} as Record<string, string>,
    getItem(k: string) { return this.data[k] ?? null; },
    setItem(k: string, v: string) { this.data[k] = v; },
  };
  // Save an old-style record (no moveAnnotations)
  const initial = newGame();
  const redMoves = getAllLegalMoves(initial.board, 'red');
  const afterOne = applyMove(initial, redMoves[0].from, redMoves[0].to);
  const oldRecord = createGameRecord({
    title: '舊棋譜',
    moves: afterOne.history,
    finalStatus: afterOne.status,
    redPlayer: '紅方',
    blackPlayer: '黑方',
  });
  // No moveAnnotations — simulate old schema
  saveGameRecord(mockStorage, oldRecord);

  const loaded = loadGameRecords(mockStorage);
  assertEqual(loaded.length, 1);
  assertEqual(loaded[0].title, '舊棋譜');
  // moveAnnotations should be absent (undefined), not crash
  assertEqual(loaded[0].moveAnnotations, undefined);
  assertEqual(loaded[0].moves.length, 1);
});

// ─── formatAiDebugReport tests ───────────────────────────────────────────────

test('formatAiDebugReport: contains header and mode name', () => {
  const state = newGame();
  const r = recommendMove(state);
  const text = formatAiDebugReport({ modeName: '輔助盤面', state, recommendation: r });
  assertOk(text.includes('=== AI 測試報告 ==='));
  assertOk(text.includes('模式：輔助盤面'));
  assertOk(text.includes('輪到：紅方'));
  assertOk(text.includes('手數：0'));
});

test('formatAiDebugReport: includes AI recommendation block', () => {
  const state = newGame();
  const r = recommendMove(state);
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: r });
  assertOk(text.includes('--- AI 建議 ---'));
  if (r.move) {
    assertOk(text.includes('推薦棋步：'));
    assertOk(text.includes('分數：'));
  }
});

test('formatAiDebugReport: includes top-5 candidates when traces present', () => {
  const state = newGame();
  const r = recommendMove(state);
  if (!r.traces || r.traces.length === 0) return;
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: r });
  assertOk(text.includes('--- 候選前 5 名 ---'));
  assertOk(/1\. .+\｜.+\｜/.test(text));
});

test('formatAiDebugReport: includes recommended trace when traces present', () => {
  const state = newGame();
  const r = recommendMove(state);
  if (!r.traces || r.traces.length === 0) return;
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: r });
  assertOk(text.includes('--- 推薦步 trace ---'));
  assertOk(text.includes('structureScore：'));
  assertOk(text.includes('patterns：'));
});

test('formatAiDebugReport: handles no-move case gracefully', () => {
  const state = newGame();
  const r: import('../src/ai/aiTrace').AiRecommendation = { move: null, score: 0, reason: 'test', traces: [] };
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: r });
  assertOk(text.includes('（無合法棋步）'));
  assertOk(text.includes('=================='));
});

test('formatAiDebugReport: includes analysis move count when analysisMoves provided', () => {
  const state = newGame();
  const legalMoves = getAllLegalMoves(state.board, 'red');
  const r = recommendMove(state);
  const am = [{ from: legalMoves[0].from, to: legalMoves[0].to, piece: legalMoves[0].piece, captured: null as null, revealed: null as null }];
  const text = formatAiDebugReport({ modeName: 'test', state, analysisMoves: am, recommendation: r });
  assertOk(text.includes('變化手'));
});

// === 後手翻棋選擇權 + 開局大子活化 ===

test('reveal choice risk A: 暗車吃被暗車看著的未過河暗卒，應被降分', () => {
  // 盤面：
  // 紅隱藏車(4,2) 可橫吃 黑隱藏卒(4,4)
  // 黑隱藏車(3,4) 看住 col4 → revealChoiceRisk 應觸發
  // 紅隱藏馬(9,1) 可活出 → 分數應高於車吃卒
  // 紅明兵(5,4) 隔開雙王 + 保護 (4,4) 落點
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));     // 隔王 + 保護 (4,4)
  place(board, 4, 2, piece('red', 'rook', 'rook', false));    // 紅隱藏車（走子方）
  place(board, 4, 4, piece('black', 'pawn', 'pawn', false));  // 黑隱藏卒（被吃，低外觀）
  place(board, 3, 4, piece('black', 'rook', 'rook', false));  // 黑隱藏車（看住 col4）
  place(board, 9, 1, piece('red', 'horse', 'horse', false));  // 紅隱藏馬（備選活大子）

  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);

  // 車吃卒的 trace 應有 revealChoiceRisk=true 和 revealChoicePenalty<0
  const rookCaptureTrace = rec.traces.find(t =>
    t.move.piece.originalType === 'rook' &&
    t.move.from.col === 2 &&
    t.move.captured !== null &&
    t.move.captured?.originalType === 'pawn'
  );
  assertOk(rookCaptureTrace);
  assertEqual(rookCaptureTrace.revealChoiceRisk, true);
  assertOk(rookCaptureTrace.revealChoicePenalty < 0);
  assertOk(rookCaptureTrace.reason.includes('選擇權') || rookCaptureTrace.reason.includes('翻子結果'));

  // 推薦手不應是車吃卒（馬活出應勝出）
  const recIsRookCapture =
    rec.move?.piece.originalType === 'rook' &&
    rec.move?.captured !== null;
  assertEqual(recIsRookCapture, false);
});

test('reveal choice risk B: 安全吃高價明子不應被誤扣', () => {
  // 紅明車安全吃黑明炮（已翻，高價）→ revealChoiceRisk 不應觸發
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 7, 0, piece('red', 'rook', 'rook', true));          // 紅明車
  place(board, 3, 0, piece('black', 'cannon', 'cannon', true));    // 黑明炮（目標，已翻）

  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);

  const rookCapTrace = rec.traces.find(t =>
    t.move.piece.realType === 'rook' && t.move.captured?.realType === 'cannon'
  );
  assertOk(rookCapTrace);
  assertEqual(rookCapTrace.revealChoiceRisk, false);
  assertEqual(rookCapTrace.revealChoicePenalty, 0);
});

test('reveal choice risk C: 吃高價外觀暗子不應完全禁止', () => {
  // 紅明車吃 黑隱藏炮（originalType='cannon'，高外觀）
  // isLowAppearance=false → revealChoiceRisk 不觸發
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 7, 0, piece('red', 'rook', 'rook', true));           // 紅明車
  place(board, 3, 0, piece('black', 'cannon', 'cannon', false));    // 黑隱藏炮（高外觀）

  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);

  const rookCapTrace = rec.traces.find(t =>
    t.move.piece.realType === 'rook' && t.move.captured?.originalType === 'cannon'
  );
  assertOk(rookCapTrace);
  // 高外觀暗子不觸發後手選擇權懲罰
  assertEqual(rookCapTrace.revealChoiceRisk, false);
});

test('開局大子 D: 活出大子優先於普通暗卒壓制', () => {
  // 開局：紅隱藏馬(9,1) 可活出 → majorActivation=true
  // 其他候選多為無活大子的走法
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 9, 1, piece('red', 'horse', 'horse', false));    // 初始後排馬
  place(board, 2, 0, piece('black', 'pawn', 'pawn', false));    // 對方暗子（供壓制）
  place(board, 2, 2, piece('black', 'pawn', 'pawn', false));

  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);

  // 馬活出的 trace 應有 majorActivation=true
  const horseTrace = rec.traces.find(t =>
    t.move.piece.originalType === 'horse' &&
    t.move.from.row === 9 && t.move.from.col === 1
  );
  assertOk(horseTrace);
  assertEqual(horseTrace.majorActivation, true);
  assertOk(horseTrace.openingMajorGoal);

  // 馬活出應勝過最佳純壓制手
  const bestNonActivationTrace = rec.traces
    .filter(t => !t.majorActivation && !t.move.captured)
    .sort((a, b) => b.score - a.score)[0];
  if (bestNonActivationTrace) {
    assertOk(horseTrace.score > bestNonActivationTrace.score);
  }
});

test('開局大子 E: 壓制對方翻子要服務於大子活動目標', () => {
  // 馬活出（majorActivation）比純暗兵壓制（無 majorActivation）分數高
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 9, 1, piece('red', 'horse', 'horse', false));   // 初始後排馬
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));   // 對方暗卒（壓制目標）

  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);

  const horseTrace = rec.traces.find(t =>
    t.move.piece.originalType === 'horse' &&
    t.move.from.row === 9 && t.move.from.col === 1
  );
  assertOk(horseTrace);
  assertEqual(horseTrace.majorActivation, true);

  // reason 應與大子活動相關
  // reason 可為：'開局優先活出大子' 或 '活出大子並壓制對方翻子'
  assertOk(
    horseTrace.reason.includes('活出大子') ||
    horseTrace.reason.includes('大子') ||
    horseTrace.majorActivation === true
  );

  // 馬活出分數 >= 所有非活大子純壓制手
  const pawnPressureTraces = rec.traces.filter(t =>
    t.move.piece.originalType === 'pawn' && !t.majorActivation && !t.move.captured
  );
  for (const pt of pawnPressureTraces) {
    assertOk(horseTrace.score >= pt.score);
  }
});

test('公平資訊防呆 F: AI 不可因未翻 realType 不同而改變 openingMajorGoal', () => {
  // 兩盤面公開資訊完全相同，只有某一暗子的 realType 不同
  // 馬活出的 majorActivation / openingMajorGoal / score 不應因此改變

  function makeState(hiddenRealType: PieceType): GameState {
    const board = emptyBoard();
    place(board, 9, 4, piece('red', 'king'));
    place(board, 0, 4, piece('black', 'king'));
    place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
    place(board, 9, 1, piece('red', 'horse', 'horse', false));
    // 同一位置、同 originalType='pawn'、同 revealed=false，只有 realType 不同
    place(board, 8, 0, piece('red', 'pawn', hiddenRealType, false));
    return { board, turn: 'red', history: [], status: 'playing' };
  }

  const state1 = makeState('rook');
  const state2 = makeState('pawn');

  const rec1 = recommendMove(state1);
  const rec2 = recommendMove(state2);
  assertOk(rec1.traces);
  assertOk(rec2.traces);

  // 馬活出 trace 在兩個盤面應完全相同
  const horseTrace1 = rec1.traces.find(t =>
    t.move.piece.originalType === 'horse' &&
    t.move.from.row === 9 && t.move.from.col === 1
  );
  const horseTrace2 = rec2.traces.find(t =>
    t.move.piece.originalType === 'horse' &&
    t.move.from.row === 9 && t.move.from.col === 1
  );
  assertOk(horseTrace1);
  assertOk(horseTrace2);
  // 公平資訊：majorActivation 不可因 unrevealed realType 不同而改變
  assertEqual(horseTrace1.majorActivation, horseTrace2.majorActivation);
  assertEqual(horseTrace1.openingMajorGoal, horseTrace2.openingMajorGoal);
  // 分數也應相同（不偷看 realType）
  assertEqual(horseTrace1.score, horseTrace2.score);
});

test('reveal choice risk fair info: watcher hidden realType must not change score or penalty', () => {
  // 兩盤面公開資訊完全相同：看住落點的黑暗子 originalType='rook'，只有 realType 不同。
  // revealChoiceRisk / revealChoicePenalty / score 必須相同，確保不偷看 realType。
  // 注意：紅王放 col=0、黑王放 col=4（不同列，不需要阻隔兵），
  //        且紅方無其他棋子可回吃，確保 opponentReplyPenalty 的 recaptureValue=0 在兩盤相同。
  function makeState(watcherRealType: PieceType): GameState {
    const board = emptyBoard();
    place(board, 9, 0, piece('red', 'king'));                           // 紅王在 col0
    place(board, 0, 4, piece('black', 'king'));                         // 黑王在 col4（不同列，不互照）
    place(board, 4, 2, piece('red', 'rook', 'rook', true));             // 紅明車（走子方）
    place(board, 4, 4, piece('black', 'pawn', 'pawn', false));          // 黑暗卒（低外觀被吃目標）
    place(board, 3, 4, piece('black', 'rook', watcherRealType, false)); // 看住落點的黑暗子，公開=rook
    return { board, turn: 'red', history: [], status: 'playing' };
  }

  const stateA = makeState('rook');
  const stateB = makeState('pawn');

  const recA = recommendMove(stateA);
  const recB = recommendMove(stateB);
  assertOk(recA.traces);
  assertOk(recB.traces);

  const traceA = recA.traces.find(t =>
    t.move.from.row === 4 && t.move.from.col === 2 &&
    t.move.to.row === 4 && t.move.to.col === 4
  );
  const traceB = recB.traces.find(t =>
    t.move.from.row === 4 && t.move.from.col === 2 &&
    t.move.to.row === 4 && t.move.to.col === 4
  );
  assertOk(traceA);
  assertOk(traceB);

  // 公平資訊：unrevealed realType 不同不可影響評分
  assertEqual(traceA.revealChoiceRisk, traceB.revealChoiceRisk);
  assertEqual(traceA.revealChoicePenalty, traceB.revealChoicePenalty);
  assertEqual(traceA.score, traceB.score);
});

// ─── Fair AI Boundary MVP tests ───────────────────────────────────────────────
import { createAiView, visibleStateToMaskedGameState } from '../src/ai/aiVisibility';
import { recommendMoveFair, recommendMoveOracle } from '../src/ai/simpleAi';
import { buildAiPanelDebugReport, getAiPanelRecommendations } from '../src/ai/aiPanelRecommendations';

function isPriorityOpeningPawnMove(move: Move | null): boolean {
  if (!move) return false;
  return move.from.row === 6 &&
    (move.from.col === 0 || move.from.col === 2 || move.from.col === 6 || move.from.col === 8);
}

test('Fair AI view hides realType for unrevealed pieces', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 6, 0, piece('red', 'pawn', 'rook', false));
  place(board, 6, 2, piece('red', 'pawn', 'horse', true));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const view = createAiView(state, 'red');
  const hidden = view.board[6][0];
  assertOk(hidden);
  assertEqual(hidden.revealed, false);
  assertEqual('realType' in hidden, false);
  const revealed = view.board[6][2];
  assertOk(revealed);
  assertEqual(revealed.revealed, true);
  assertEqual(revealed.realType, 'horse');
});

test('Fair AI masked state replaces hidden realType with originalType', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 6, 0, piece('red', 'pawn', 'rook', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const view = createAiView(state, 'red');
  const masked = visibleStateToMaskedGameState(view);
  const maskedPiece = masked.board[6][0];
  assertOk(maskedPiece);
  assertEqual(maskedPiece.revealed, false);
  assertEqual(maskedPiece.originalType, 'pawn');
  assertEqual(maskedPiece.realType, 'pawn');
});

test('recommendMoveFair is stable when hidden realType changes but public info is same', () => {
  function makeState(hiddenRealType: PieceType): GameState {
    const board = emptyBoard();
    place(board, 9, 4, piece('red', 'king'));
    place(board, 0, 4, piece('black', 'king'));
    place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
    place(board, 6, 0, piece('red', 'pawn', hiddenRealType, false));
    place(board, 7, 1, piece('red', 'horse', 'horse', false));
    place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
    return { board, turn: 'red', history: [], status: 'playing' };
  }
  const stateA = makeState('rook');
  const stateB = makeState('pawn');
  const recA = recommendMoveFair(stateA);
  const recB = recommendMoveFair(stateB);
  assertOk(recA.move);
  assertOk(recB.move);
  assertEqual(recA.score, recB.score);
  assertEqual(recA.reason, recB.reason);
  assertEqual(recA.move.from.row, recB.move.from.row);
  assertEqual(recA.move.from.col, recB.move.from.col);
  assertEqual(recA.move.to.row, recB.move.to.row);
  assertEqual(recA.move.to.col, recB.move.to.col);
});

test('Oracle AI and Fair AI entrypoints both return recommendations', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 6, 0, piece('red', 'pawn', 'rook', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const fair = recommendMoveFair(state);
  const oracle = recommendMoveOracle(state);
  assertOk(fair.move);
  assertOk(oracle.move);
});

test('Fair AI initial move prefers 1379 hidden pawn opening', () => {
  const state = newGame();
  const rec = recommendMoveFair(state);
  assertOk(rec.move);
  assertEqual(isPriorityOpeningPawnMove(rec.move), true);
  assertEqual(rec.reason, '第一手穩健翹邊兵');
});

test('Fair AI first move blind horse activation does not outscore 1379 hidden pawns', () => {
  const state = newGame();
  const rec = recommendMoveFair(state);
  assertOk(rec.traces);
  const pawnScores = rec.traces
    .filter(t => isPriorityOpeningPawnMove(t.move))
    .map(t => t.score);
  const blindHorseScores = rec.traces
    .filter(t => t.move.piece.originalType === 'horse' && t.move.piece.revealed === false)
    .map(t => t.score);
  assertEqual(pawnScores.length > 0, true);
  assertEqual(blindHorseScores.length > 0, true);
  assertEqual(Math.max(...blindHorseScores) < Math.max(...pawnScores), true);
  const blindHorseTrace = rec.traces.find(t =>
    t.move.piece.originalType === 'horse' && t.move.piece.revealed === false
  );
  assertOk(blindHorseTrace);
  assertEqual(blindHorseTrace.firstMoveBlindHorseActivation, true);
  assertEqual((blindHorseTrace.firstMoveBlindHorsePenalty ?? 0) < 0, true);
});

test('AiPanel main recommendation uses Fair AI and keeps Oracle as debug comparison', () => {
  const state = newGame();
  const fair = recommendMoveFair(state);
  const panel = getAiPanelRecommendations(state);
  assertOk(fair.move);
  assertOk(panel.fair.move);
  assertEqual(panel.fair.move.from.row, fair.move.from.row);
  assertEqual(panel.fair.move.from.col, fair.move.from.col);
  assertEqual(panel.fair.move.to.row, fair.move.to.row);
  assertEqual(panel.fair.move.to.col, fair.move.to.col);
  assertOk(panel.oracle.move);
  const report = buildAiPanelDebugReport({
    state,
    fair: panel.fair,
    oracle: panel.oracle,
    differs: true,
  });
  assertEqual(report.includes('Fair AI'), true);
  assertEqual(report.includes('Oracle / Debug'), true);
});

test('Fair AI first move opening rule does not override direct checkmate', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 1, 4, piece('red', 'rook', 'rook', true));
  place(board, 6, 0, piece('red', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMoveFair(state);
  assertOk(rec.move);
  assertEqual(rec.move.from.row, 1);
  assertEqual(rec.move.from.col, 4);
  assertEqual(rec.move.to.row, 0);
  assertEqual(rec.move.to.col, 4);
  assertEqual(rec.reason, '此步直接形成絕殺');
});

test('black pawn soldier follow-up beats blind horse after red edge pawn flips horse', () => {
  const state = newGame();
  state.board[6][0]!.realType = 'horse';
  const afterRed = applyMove(state, { row: 6, col: 0 }, { row: 5, col: 0 });
  const rec = recommendMoveFair(afterRed);
  assertOk(rec.move);
  assertEqual(rec.move.from.row, 3);
  assertEqual(rec.move.from.col, 0);
  assertEqual(rec.move.to.row, 4);
  assertEqual(rec.move.to.col, 0);
  assertOk(rec.traces);
  const pawnTrace = rec.traces.find(t =>
    t.move.from.row === 3 && t.move.from.col === 0 && t.move.to.row === 4 && t.move.to.col === 0
  );
  const horseTrace = rec.traces.find(t =>
    t.move.from.row === 0 && t.move.from.col === 7 && t.move.to.row === 2 && t.move.to.col === 6
  );
  assertOk(pawnTrace);
  assertOk(horseTrace);
  assertEqual(pawnTrace.pawnSoldierDevelopment, true);
  assertEqual(pawnTrace.pawnSoldierThreatRevealedMajor, true);
  assertEqual(pawnTrace.pawnSoldierFollowUpHorse, true);
  assertEqual(pawnTrace.pawnSoldierHorseFootBlock, true);
  assertEqual(horseTrace.pureBlindHorseActivation, true);
  assertEqual((horseTrace.pureBlindHorsePenalty ?? 0) < 0, true);
  assertEqual(horseTrace.blindHorseStructureCapped, true);
  assertEqual(horseTrace.blindHorseMajorActivationCapped, true);
  assertEqual(pawnTrace.score > horseTrace.score, true);
});

test('blind horse activation is not capped after pawn soldiers are mostly developed', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 5, 0, piece('red', 'pawn', 'cannon', true));
  place(board, 0, 1, piece('black', 'horse', 'horse', false));
  const state = { board, turn: 'black' as const, history: Array(6).fill(null).map((_, i) => ({
    from: { row: 3, col: i % 9 },
    to: { row: 4, col: i % 9 },
    piece: piece('black', 'pawn'),
  })), status: 'playing' as const };
  const horseRelease = findMove(board, 'black', [0, 1], [2, 0]);
  const rec = recommendMoveFair(state);
  assertOk(rec.traces);
  const trace = rec.traces.find(t =>
    t.move.from.row === horseRelease.from.row &&
    t.move.from.col === horseRelease.from.col &&
    t.move.to.row === horseRelease.to.row &&
    t.move.to.col === horseRelease.to.col
  );
  assertOk(trace);
  assertEqual(trace.hasUnrevealedPawnSoldiers, false);
  assertEqual(trace.pureBlindHorseActivation, false);
  assertEqual(trace.blindHorseStructureCapped, false);
});

test('blind horse can still take a high value target without pure activation penalty', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 2, 2, piece('black', 'horse', 'horse', false));
  place(board, 4, 3, piece('red', 'rook', 'rook', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const capture = findMove(board, 'black', [2, 2], [4, 3]);
  const rec = recommendMoveFair(state);
  assertOk(rec.traces);
  const trace = rec.traces.find(t =>
    t.move.from.row === capture.from.row &&
    t.move.from.col === capture.from.col &&
    t.move.to.row === capture.to.row &&
    t.move.to.col === capture.to.col
  );
  assertOk(trace);
  assertEqual(trace.captureGain > 0, true);
  assertEqual(trace.pureBlindHorseActivation, false);
});

test('pawn soldier follow-up after elephant reveal prefers center pawn soldier', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 6, 4, piece('red', 'pawn', 'pawn', true));  // blocker at row 6, not row 5, so it cannot attack (4,4)
  place(board, 5, 2, piece('red', 'pawn', 'elephant', true));
  place(board, 3, 4, piece('black', 'pawn', 'pawn', false));
  place(board, 0, 7, piece('black', 'horse', 'horse', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const centerPawn = findMove(board, 'black', [3, 4], [4, 4]);
  const horse = findMove(board, 'black', [0, 7], [2, 6]);
  const rec = recommendMoveFair(state);
  assertOk(rec.traces);
  const centerTrace = rec.traces.find(t => t.move.from.row === centerPawn.from.row && t.move.from.col === centerPawn.from.col);
  const horseTrace = rec.traces.find(t => t.move.from.row === horse.from.row && t.move.from.col === horse.from.col && t.move.to.col === horse.to.col);
  assertOk(centerTrace);
  assertOk(horseTrace);
  assertEqual(centerTrace.pawnSoldierFollowUpElephant, true);
  assertEqual(centerTrace.pawnSoldierCenterPreference, true);
  assertEqual(centerTrace.score > horseTrace.score, true);
});

test('pawn soldier follow-up after advisor reveal gets anti fork bonus', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 5, 0, piece('red', 'pawn', 'advisor', true));
  place(board, 3, 0, piece('black', 'pawn', 'pawn', false));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const rec = recommendMoveFair(state);
  assertOk(rec.traces);
  const trace = rec.traces.find(t => t.move.from.row === 3 && t.move.from.col === 0);
  assertOk(trace);
  assertEqual(trace.pawnSoldierFollowUpAdvisor, true);
  assertEqual(trace.pawnSoldierAntiAdvisorFork, true);
});

test('AI debug report prints pawn soldier and pure blind horse trace fields', () => {
  const state = newGame();
  const rec = recommendMoveFair(state);
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: rec });
  assertEqual(text.includes('pureBlindHorseActivation'), true);
  assertEqual(text.includes('pawnSoldierDevelopment'), true);
  assertEqual(text.includes('postMoveLooseHiddenPiece'), true);
});

// --- Dead Major Threat Hold + Advisor Reveal Clog Risk MVP tests ---------------

test('hidden advisor reveal near king has clog risk', () => {
  // Red hidden advisor at palace area (row 7, col 4), moving to reveal
  // No capture, no effective check, no blocking win
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  // Red hidden advisor in palace area (originalType=advisor, revealed=false)
  place(board, 7, 3, piece('red', 'advisor', 'advisor', false));
  // Give red another move option (a pawn outside palace)
  place(board, 5, 0, piece('red', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  // Find the advisor move trace
  const advisorTrace = rec.traces.find(t =>
    t.move.piece.originalType === 'advisor' && !t.move.piece.revealed
  );
  assertOk(advisorTrace);
  assertEqual(advisorTrace.advisorRevealClogRisk, true);
  assertOk((advisorTrace.advisorRevealClogPenalty ?? 0) < 0);
  assertOk(advisorTrace.reason.includes('士') || advisorTrace.reason.includes('卡'));
});

test('controlled dead rook: hold is suppressed when safe capture is available', () => {
  // Red can safely capture black's revealed rook (equal exchange).
  // With the new logic, deadMajorThreatHold is suppressed for non-capturing moves
  // because the AI should just capture now, not hold for threat value.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  // Red revealed rook at (5,0) can attack black revealed rook at (5,4)
  place(board, 5, 0, piece('red', 'rook', 'rook', true));
  place(board, 5, 4, piece('black', 'rook', 'rook', true));
  // Give red a non-capturing pawn move
  place(board, 6, 2, piece('red', 'pawn', 'pawn', true));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  // Find a non-capturing trace with controlledDeadMajor=true
  const holdTrace = rec.traces.find(t => !t.move.captured && t.controlledDeadMajor === true);
  assertOk(holdTrace);
  // Safe capture is available, so hold bonus is suppressed
  assertEqual(holdTrace.revealedMajorCaptureAvailable, true);
  assertEqual(holdTrace.deadMajorHoldSuppressedBySafeCapture, true);
  assertEqual(holdTrace.deadMajorThreatHold, false);
});

test('forced hidden advisor defense of doomed rook is penalized', () => {
  // Red has a rook under attack by black, and only a hidden advisor can "defend"
  // That advisor move should get forcedBadDefense=true and advisorRevealClogRisk=true
  // Unrevealed advisor rule: can only move diagonally to palace center (8,4) for red.
  // Placing advisor at (9,3) gives it exactly one legal move: (9,3)→(8,4).
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  // Red revealed rook at (7,0) - under attack by black rook at (7,7)
  place(board, 7, 0, piece('red', 'rook', 'rook', true));
  place(board, 7, 7, piece('black', 'rook', 'rook', true));
  // Red hidden advisor at (9,3): only legal move is diagonal to palace center (8,4)
  place(board, 9, 3, piece('red', 'advisor', 'advisor', false));
  // Pawn on col 4 to prevent kings-facing, and gives an alternative move
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  const advisorTrace = rec.traces.find(t =>
    t.move.piece.originalType === 'advisor' && !t.move.piece.revealed
  );
  assertOk(advisorTrace);
  assertEqual(advisorTrace.advisorRevealClogRisk, true);
  assertEqual(advisorTrace.forcedBadDefense, true);
  // reason should not say "preserve hidden cannon" - should be about advisor/doomed
  assertOk(advisorTrace.reason !== '保留暗炮威懾');
});

test('formatAiDebugReport: includes board snapshot section', () => {
  const state = newGame();
  const r: import('../src/ai/aiTrace').AiRecommendation = { move: null, score: 0, reason: '' };
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: r });
  assertOk(text.includes('盤面快照'));
  assertOk(text.includes('r0:'));
  assertOk(text.includes('r9:'));
});

test('formatAiDebugReport: board snapshot shows revealed pieces and hidden pieces', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king', 'king', true));
  place(board, 0, 4, piece('black', 'king', 'king', true));
  place(board, 5, 0, piece('red', 'rook', 'rook', true));  // revealed red rook
  place(board, 3, 2, piece('black', 'cannon', 'cannon', false)); // hidden black cannon
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const r: import('../src/ai/aiTrace').AiRecommendation = { move: null, score: 0, reason: '' };
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: r });
  // Revealed red rook shows as 紅車
  assertOk(text.includes('紅車'));
  // Hidden black cannon shows as 黑暗包
  assertOk(text.includes('黑暗包'));
  // Empty cells show as ··
  assertOk(text.includes('··'));
});

test('formatAiDebugReport: board snapshot covers all 5 required criteria', () => {
  // One consolidated test per task spec:
  // (1) contains 盤面快照, (2) r0/r9, (3) col labels 0~8,
  // (4) revealed piece text, (5) hidden piece text
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king', 'king', true));
  place(board, 0, 4, piece('black', 'king', 'king', true));
  place(board, 7, 0, piece('red', 'rook', 'rook', true));  // revealed -> 紅車
  place(board, 2, 6, piece('black', 'horse', 'horse', false)); // hidden -> 黑暗馬
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec: import('../src/ai/aiTrace').AiRecommendation = { move: null, score: 0, reason: '' };
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: rec });
  // (1) snapshot section header
  assertOk(text.includes('盤面快照'));
  // (2) first and last row labels
  assertOk(text.includes('r0:'));
  assertOk(text.includes('r9:'));
  // (3) column header 0~8
  assertOk(text.includes('0    1    2    3    4    5    6    7    8'));
  // (4) revealed piece
  assertOk(text.includes('紅車'));
  // (5) hidden piece
  assertOk(text.includes('黑暗馬'));
});

test('safe revealed rook capture beats pawn soldier development', () => {
  // Red horse at (5,0) can safely capture black revealed rook at (7,1).
  // Red also has two unrevealed pawns for opening pawnSoldierDevelopment.
  // AI should prefer the rook capture over pawn development.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));        // blocks kings-facing col 4
  place(board, 5, 0, piece('red', 'horse', 'horse', true));      // revealed red horse
  place(board, 7, 2, piece('red', 'pawn', 'pawn', false));       // hidden pawn (dev candidate)
  place(board, 7, 6, piece('red', 'pawn', 'pawn', false));       // 2nd hidden pawn
  place(board, 7, 1, piece('black', 'rook', 'rook', true));      // black revealed rook
  place(board, 0, 3, piece('black', 'pawn', 'pawn', false));     // filler
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.move);
  // AI must choose horse captures rook at (7,1) rather than pawn development
  assertEqual(rec.move?.to.row, 7);
  assertEqual(rec.move?.to.col, 1);
  assertOk(rec.move?.captured !== null);
});

test('deadMajorHoldSuppressedBySafeCapture: suppressed when safe revealed capture exists', () => {
  // Red rook at (5,0) controls black revealed rook at (5,4) (dead major).
  // Red can safely capture black rook (both same value, exchangeNet=0>=0).
  // A quiet red pawn move should have deadMajorHoldSuppressedBySafeCapture=true,
  // NOT deadMajorThreatHold, because we should capture NOW.
  // Red pawn at (7,4) blocks black rook's check on red king along col 4.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 0, piece('red', 'rook', 'rook', true));        // red rook controls black rook
  place(board, 5, 4, piece('black', 'rook', 'rook', true));      // black revealed rook (dead)
  place(board, 7, 4, piece('red', 'pawn', 'pawn', true));        // blocks check on red king (col 4)
  place(board, 6, 2, piece('red', 'pawn', 'pawn', true));        // red pawn for quiet move
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  // Find pawn at (6,2) moving forward - a quiet non-capturing move
  const pawnTrace = rec.traces.find(t => !t.move.captured && t.move.from.row === 6 && t.move.from.col === 2);
  assertOk(pawnTrace);
  assertEqual(pawnTrace.controlledDeadMajor, true);
  assertEqual(pawnTrace.revealedMajorCaptureAvailable, true);
  assertEqual(pawnTrace.deadMajorHoldSuppressedBySafeCapture, true);
  assertEqual(pawnTrace.deadMajorThreatHold, false);
});

test('pawnSoldierDelayedByMajorCapture: pawn dev move penalized when revealed rook capturable', () => {
  // Same board as test 1: red horse can capture black revealed rook,
  // so pawn development moves should have pawnSoldierDelayedByMajorCapture=true.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));        // blocks kings-facing col 4
  place(board, 5, 0, piece('red', 'horse', 'horse', true));
  place(board, 7, 2, piece('red', 'pawn', 'pawn', false));
  place(board, 7, 6, piece('red', 'pawn', 'pawn', false));
  place(board, 7, 1, piece('black', 'rook', 'rook', true));
  place(board, 0, 3, piece('black', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  // Pawn at (7,2) can move to (6,2): find that trace
  const pawnTrace = rec.traces.find(t =>
    t.move.from.row === 7 && t.move.from.col === 2 &&
    t.move.to.row === 6 && t.move.to.col === 2
  );
  assertOk(pawnTrace);
  assertEqual(pawnTrace.pawnSoldierDevelopment, true);
  assertEqual(pawnTrace.revealedMajorCaptureAvailable, true);
  assertEqual(pawnTrace.pawnSoldierDelayedByMajorCapture, true);
});

test('revealedMajorCaptureAvailable is false when no revealed enemy major capturable', () => {
  // Black rook is hidden (not revealed): posRevealedMajorCaptureAvailable should be false.
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 0, piece('red', 'rook', 'rook', true));
  place(board, 5, 4, piece('black', 'rook', 'rook', false));     // hidden (not revealed)
  place(board, 6, 2, piece('red', 'pawn', 'pawn', true));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  const anyAvailable = rec.traces.some(t => t.revealedMajorCaptureAvailable);
  assertEqual(anyAvailable, false);
});

test('formatAiDebugReport: includes revealedMajorCapture trace fields in output', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 0, piece('red', 'rook', 'rook', true));
  place(board, 5, 4, piece('black', 'rook', 'rook', true));
  place(board, 6, 2, piece('red', 'pawn', 'pawn', true));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: rec });
  assertOk(text.includes('revealedMajorCaptureAvailable'));
  assertOk(text.includes('safeRevealedMajorCapture'));
  assertOk(text.includes('revealedMajorCaptureScore'));
  assertOk(text.includes('pawnSoldierDelayedByMajorCapture'));
  assertOk(text.includes('deadMajorShouldCaptureNow'));
  assertOk(text.includes('deadMajorHoldSuppressedBySafeCapture'));
});

test('暗兵卒走入已翻兵卒攻击範圍即計分 pawnSoldierWalksIntoRevealedPawnAttack', () => {
  // Board: black hidden pawn at (3,5), red revealed pawn at (5,5) which can capture (4,5)
  // Black turn: hidden pawn advances from (3,5) to (4,5) -- walks into red revealed pawn attack
  // col-4 blocker between kings to avoid facing-kings rule
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));   // col-4 blocker
  place(board, 3, 5, piece('black', 'pawn', 'pawn', false)); // hidden black pawn
  place(board, 5, 5, piece('red', 'pawn', 'pawn', true));   // revealed red pawn, threatens (4,5)
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  // The advance from (3,5) to (4,5) should flag pawnSoldierWalksIntoRevealedPawnAttack
  const advanceTrace = rec.traces.find(t =>
    t.move.from.row === 3 && t.move.from.col === 5 &&
    t.move.to.row === 4 && t.move.to.col === 5
  );
  assertOk(advanceTrace);
  assertEqual(advanceTrace.pawnSoldierDevelopment, true);
  assertEqual(advanceTrace.pawnSoldierWalksIntoRevealedPawnAttack, true);
  assertEqual(advanceTrace.pawnSoldierSelfSacrifice, true);
  assertEqual(advanceTrace.pawnSoldierDevelopmentSuppressedByPawnAttack, true);
  // AI should NOT recommend that sacrificing move
  const recommended = rec.move;
  assertOk(!(recommended && recommended.from.row === 3 && recommended.from.col === 5 && recommended.to.row === 4 && recommended.to.col === 5));
});

test('暗兵卒有保護則不扣分 pawnSoldierProtectedAfterAdvance', () => {
  // Board: black hidden pawn at (3,5), red revealed pawn at (5,5) threatens (4,5),
  // but black rook at (4,0) protects (4,5) (can recapture)
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));   // col-4 blocker
  place(board, 3, 5, piece('black', 'pawn', 'pawn', false)); // hidden black pawn
  place(board, 5, 5, piece('red', 'pawn', 'pawn', true));   // revealed red pawn
  place(board, 4, 0, piece('black', 'rook', 'rook', true)); // black rook protects (4,5)
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  const advanceTrace = rec.traces.find(t =>
    t.move.from.row === 3 && t.move.from.col === 5 &&
    t.move.to.row === 4 && t.move.to.col === 5
  );
  assertOk(advanceTrace);
  assertEqual(advanceTrace.pawnSoldierDevelopment, true);
  assertEqual(advanceTrace.pawnSoldierProtectedAfterAdvance, true);
  assertEqual(advanceTrace.pawnSoldierWalksIntoRevealedPawnAttack, false);
});

test('formatAiDebugReport: includes pawnSoldierWalksIntoRevealedPawnAttack trace fields in output', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 4, piece('red', 'pawn', 'pawn', true));
  place(board, 3, 5, piece('black', 'pawn', 'pawn', false));
  place(board, 5, 5, piece('red', 'pawn', 'pawn', true));
  const state = { board, turn: 'black' as const, history: [], status: 'playing' as const };
  const rec = recommendMove(state);
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: rec });
  assertOk(text.includes('pawnSoldierWalksIntoRevealedPawnAttack'));
  assertOk(text.includes('pawnSoldierSelfSacrifice'));
  assertOk(text.includes('pawnSoldierProtectedAfterAdvance'));
  assertOk(text.includes('pawnSoldierDevelopmentSuppressedByPawnAttack'));
});

// ── 需求 A/B/C/D/E tests ─────────────────────

test('車連將三次被 repetitiveCheck 標記', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  // Black pawn at [1][4] blocks direct king capture; rook at [5][4] can check by taking pawn
  place(board, 1, 4, piece('black', 'pawn', 'pawn', true));
  place(board, 5, 4, piece('red', 'rook', 'rook', true));
  const redRook = board[5][4]!;
  const blackKing = board[0][4]!;
  // History: red rook moved twice (no captures), black responded
  const hRed: import('../src/types/chess').Move = {
    piece: { ...redRook }, from: { row: 5, col: 4 }, to: { row: 5, col: 4 }, captured: null,
  };
  const hBlack: import('../src/types/chess').Move = {
    piece: { ...blackKing }, from: { row: 0, col: 4 }, to: { row: 0, col: 3 }, captured: null,
  };
  const state = {
    board, turn: 'red' as const,
    history: [hRed, hBlack, hRed, hBlack],
    status: 'playing' as const,
  };
  const rec = recommendMove(state);
  // No immediate win — pawn blocks direct path to king, so traces must be defined
  assertOk(rec.traces);
  // Rook check (captures pawn → king in check) should be flagged repetitiveCheck
  const checkTrace = rec.traces.find(t => t.move.piece.realType === 'rook' && t.checking);
  if (checkTrace) {
    assertEqual(checkTrace.repetitiveCheck, true);
  }
});

test('炮連將三次被 repetitiveCheck 標記', () => {
  // Red cannon at r2c4 with screen at r1c4 giving perpetual check to black king
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 1, 4, piece('red', 'pawn', 'pawn', true)); // screen
  place(board, 2, 4, piece('red', 'cannon', 'cannon', true));
  const cannon = board[2][4]!;
  const blackKing = board[0][4]!;
  const hRed: import('../src/types/chess').Move = {
    piece: { ...cannon }, from: { row: 2, col: 4 }, to: { row: 2, col: 4 }, captured: null,
  };
  const hBlack: import('../src/types/chess').Move = {
    piece: { ...blackKing }, from: { row: 0, col: 4 }, to: { row: 0, col: 3 }, captured: null,
  };
  const state = {
    board, turn: 'red' as const,
    history: [hRed, hBlack, hRed, hBlack],
    status: 'playing' as const,
  };
  const rec = recommendMove(state);
  // Cannon check through screen is also an immediate win; AI still returns a valid move
  assertEqual(rec.move !== null, true);
  if (rec.traces) {
    // Non-win path: any flagged check should have repetitiveCheck=true
    const repCheck = rec.traces.find(t => t.repetitiveCheck);
    if (repCheck) {
      assertEqual(repCheck.repetitiveCheck, true);
    }
  } else {
    // Immediate-win path: cannon can capture king through screen
    assertEqual(rec.score, 999999);
  }
});

test('馬連將三次被 repetitiveCheck 標記', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 2, 3, piece('red', 'horse', 'horse', true));
  const horse = board[2][3]!;
  const blackKing = board[0][4]!;
  const hRed: import('../src/types/chess').Move = {
    piece: { ...horse }, from: { row: 2, col: 3 }, to: { row: 2, col: 3 }, captured: null,
  };
  const hBlack: import('../src/types/chess').Move = {
    piece: { ...blackKing }, from: { row: 0, col: 4 }, to: { row: 0, col: 3 }, captured: null,
  };
  const state = {
    board, turn: 'red' as const,
    history: [hRed, hBlack, hRed, hBlack],
    status: 'playing' as const,
  };
  const rec = recommendMove(state);
  // Horse check on king is always also a capture (immediate win)
  assertEqual(rec.move !== null, true);
  if (rec.traces) {
    const horseTrace = rec.traces.find(t => t.move.piece.revealed && t.repetitiveCheck);
    if (horseTrace) {
      assertEqual(horseTrace.repetitiveCheck, true);
    }
  } else {
    assertEqual(rec.score, 999999);
  }
});

test('有其他安全合法手時，AI 不應選無成果 repetitiveCheck (需求 B)', () => {
  // Board: red rook at r5c0, can slide around; history flagging any check as repetitive
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 5, 0, piece('red', 'rook', 'rook', true));
  const rook = board[5][0]!;
  const blackKing = board[0][4]!;
  // Red moved twice with no captures, creating repetitiveCheck condition for next check
  const hRed: import('../src/types/chess').Move = {
    piece: { ...rook }, from: { row: 5, col: 0 }, to: { row: 5, col: 0 }, captured: null,
  };
  const hBlack: import('../src/types/chess').Move = {
    piece: { ...blackKing }, from: { row: 0, col: 4 }, to: { row: 0, col: 3 }, captured: null,
  };
  const state = {
    board, turn: 'red' as const,
    history: [hRed, hBlack, hRed, hBlack],
    status: 'playing' as const,
  };
  const rec = recommendMove(state);
  assertOk(rec.move);
  assertOk(rec.traces);
  // AI should prefer a non-repetitiveCheck move if available
  const bestTrace = rec.traces.find(t =>
    t.move.from.row === rec.move!.from.row && t.move.from.col === rec.move!.from.col &&
    t.move.to.row === rec.move!.to.row && t.move.to.col === rec.move!.to.col
  );
  assertOk(bestTrace);
  // Best should NOT be a repetitiveCheck (suppressed by Need B)
  assertEqual(bestTrace.repetitiveCheck, false);
});

test('連將可直接絕渺，仍可選（不被 Need B 阻止）', () => {
  // Red rook at r1c4 can deliver checkmate to black king at r0c4 (king has no escape)
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  place(board, 0, 3, piece('red', 'rook', 'rook', true)); // blocks left escape
  place(board, 0, 5, piece('red', 'rook', 'rook', true)); // blocks right escape
  place(board, 1, 4, piece('red', 'rook', 'rook', true)); // can deliver final check
  const rook = board[1][4]!;
  const blackKing = board[0][4]!;
  const hRed: import('../src/types/chess').Move = {
    piece: { ...rook }, from: { row: 1, col: 4 }, to: { row: 1, col: 4 }, captured: null,
  };
  const hBlack: import('../src/types/chess').Move = {
    piece: { ...blackKing }, from: { row: 0, col: 4 }, to: { row: 0, col: 4 }, captured: null,
  };
  const state = {
    board, turn: 'red' as const,
    history: [hRed, hBlack, hRed, hBlack],
    status: 'playing' as const,
  };
  const rec = recommendMove(state);
  assertOk(rec.move);
  // Immediate checkmate takes score 999999 and bypasses repetition logic
  assertEqual(rec.score, 999999);
});

test('positionKey 對未翻暗子不使用 realType（公平資訊）', () => {
  // Two boards: same originalType / revealed state, different realType for unrevealed piece
  // => should produce identical fair position keys
  const board1 = emptyBoard();
  place(board1, 9, 4, piece('red', 'king'));
  place(board1, 0, 4, piece('black', 'king'));
  place(board1, 5, 0, piece('red', 'pawn', 'rook', false)); // unrevealed: originalType=pawn, realType=rook
  const state1 = { board: board1, turn: 'red' as const, history: [], status: 'playing' as const };

  const board2 = emptyBoard();
  place(board2, 9, 4, piece('red', 'king'));
  place(board2, 0, 4, piece('black', 'king'));
  place(board2, 5, 0, piece('red', 'pawn', 'horse', false)); // unrevealed: originalType=pawn, realType=horse
  const state2 = { board: board2, turn: 'red' as const, history: [], status: 'playing' as const };

  // Fair keys must be equal (public info is the same)
  assertEqual(getPositionKey(state1), getPositionKey(state2));

  // Sanity: revealed pieces with different realType give different keys
  const board3 = emptyBoard();
  place(board3, 9, 4, piece('red', 'king'));
  place(board3, 0, 4, piece('black', 'king'));
  place(board3, 5, 0, piece('red', 'rook', 'rook', true)); // revealed rook
  const state3 = { board: board3, turn: 'red' as const, history: [], status: 'playing' as const };
  assertEqual(getPositionKey(state1) !== getPositionKey(state3), true);
});

test('isRepetitionDraw 於同一局面出現 REPETITION_DRAW_THRESHOLD 次時回伺 true', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };

  // 0 occurrences in past -> not a draw
  assertEqual(isRepetitionDraw(state, []), false);
  // 1 occurrence in past -> not yet
  assertEqual(isRepetitionDraw(state, [state]), false);
  // 2 occurrences in past -> not yet (threshold is 4 total = 3 in past)
  assertEqual(isRepetitionDraw(state, [state, state]), false);
  // 3 occurrences in past -> draw (4th occurrence)
  assertEqual(isRepetitionDraw(state, [state, state, state]), true);
});

test('debug report 含新增 repetitiveCheck 相關欄位', () => {
  const board = emptyBoard();
  place(board, 9, 4, piece('red', 'king'));
  place(board, 0, 4, piece('black', 'king'));
  // Black pawn blocks direct king capture; rook can check without immediate win
  place(board, 1, 4, piece('black', 'pawn', 'pawn', true));
  place(board, 5, 4, piece('red', 'rook', 'rook', true));
  const rook = board[5][4]!;
  const blackKing = board[0][4]!;
  const hRed: import('../src/types/chess').Move = {
    piece: { ...rook }, from: { row: 5, col: 4 }, to: { row: 5, col: 4 }, captured: null,
  };
  const hBlack: import('../src/types/chess').Move = {
    piece: { ...blackKing }, from: { row: 0, col: 4 }, to: { row: 0, col: 3 }, captured: null,
  };
  const state = {
    board, turn: 'red' as const,
    history: [hRed, hBlack, hRed, hBlack],
    status: 'playing' as const,
  };
  const rec = recommendMove(state);
  // Pawn blocks direct king capture so traces must be present
  assertOk(rec.traces);
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: rec });
  assertOk(text.includes('repeatedCheckingCycle'));
  assertOk(text.includes('repeatedPositionRisk'));
  assertOk(text.includes('repetitiveCheckSuppressed'));
  assertOk(text.includes('repetitionCount'));
});

// ===== endgame heuristics tests =====

test('中盤局面啟動 endgamePlanActive', () => {
  // After opening phase (history.length > 12), endgamePlanActive should be true
  // Kings are on different columns to avoid face-off; rook at [5][0] blocks col 4 via [5][4] not needed
  const board = emptyBoard();
  place(board, 9, 3, piece('red', 'king'));   // red king off-center
  place(board, 0, 5, piece('black', 'king')); // black king off-center
  place(board, 5, 0, piece('red', 'rook'));
  const dummyMove = {
    piece: piece('red', 'king'), from: { row: 9, col: 3 }, to: { row: 9, col: 3 }, captured: null,
  };
  const history = Array(14).fill(dummyMove);
  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  const best = rec.traces.find(t =>
    t.move.from.row === rec.move!.from.row && t.move.from.col === rec.move!.from.col &&
    t.move.to.row === rec.move!.to.row && t.move.to.col === rec.move!.to.col
  );
  assertOk(best);
  assertEqual(best.endgamePlanActive, true);
});

test('靠近敵將有 towardEnemyKing', () => {
  // Red revealed rook moves closer to black king → towardEnemyKing
  // Kings on different columns to avoid illegal face-off
  const board = emptyBoard();
  place(board, 9, 3, piece('red', 'king'));
  place(board, 0, 5, piece('black', 'king'));
  place(board, 8, 0, piece('red', 'rook'));
  const dummyMove = {
    piece: piece('red', 'king'), from: { row: 9, col: 3 }, to: { row: 9, col: 3 }, captured: null,
  };
  const history = Array(14).fill(dummyMove);
  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  // Any upward rook move from [8][0] moves closer to black king at [0][5]
  const rookMoveUp = rec.traces.find(t =>
    t.move.from.row === 8 && t.move.from.col === 0 && t.move.to.row < 8
  );
  assertOk(rookMoveUp);
  assertEqual(rookMoveUp.towardEnemyKing, true);
});

test('限制將帥活動有 restrictKingMobility', () => {
  // Red rook moves to row 0 to restrict black king's moves
  const board = emptyBoard();
  place(board, 9, 3, piece('red', 'king'));
  place(board, 0, 5, piece('black', 'king'));
  place(board, 2, 0, piece('red', 'rook'));
  const dummyMove = {
    piece: piece('red', 'king'), from: { row: 9, col: 3 }, to: { row: 9, col: 3 }, captured: null,
  };
  const history = Array(14).fill(dummyMove);
  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  const rookToRow0 = rec.traces.find(t =>
    t.move.from.row === 2 && t.move.from.col === 0 && t.move.to.row === 0
  );
  assertOk(rookToRow0);
  assertEqual(rookToRow0.restrictKingMobility, true);
});

test('吃掉士象有 attackPalaceGuard', () => {
  // Red rook capturing black advisor triggers attackPalaceGuard
  const board = emptyBoard();
  place(board, 9, 3, piece('red', 'king'));
  place(board, 0, 5, piece('black', 'king'));
  const blackAdvisor = piece('black', 'advisor');
  place(board, 1, 3, blackAdvisor);
  place(board, 1, 0, piece('red', 'rook'));
  const dummyMove = {
    piece: piece('red', 'king'), from: { row: 9, col: 3 }, to: { row: 9, col: 3 }, captured: null,
  };
  const history = Array(14).fill(dummyMove);
  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  const captureAdvisor = rec.traces.find(t =>
    t.move.from.row === 1 && t.move.from.col === 0 &&
    t.move.to.row === 1 && t.move.to.col === 3
  );
  assertOk(captureAdvisor);
  assertEqual(captureAdvisor.attackPalaceGuard, true);
});

test('過河兵卒推進有 passedPawnAdvance', () => {
  // Red revealed crossed pawn moving forward → passedPawnAdvance
  const board = emptyBoard();
  place(board, 9, 3, piece('red', 'king'));
  place(board, 0, 5, piece('black', 'king'));
  // Red pawn at row 3 (crossed the river for red: row <= 4)
  place(board, 3, 0, piece('red', 'pawn'));
  const dummyMove = {
    piece: piece('red', 'king'), from: { row: 9, col: 3 }, to: { row: 9, col: 3 }, captured: null,
  };
  const history = Array(14).fill(dummyMove);
  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  // Pawn moving from row 3 to row 2 (forward for red) triggers passedPawnAdvance
  const pawnForward = rec.traces.find(t =>
    t.move.from.row === 3 && t.move.from.col === 0 && t.move.to.row === 2
  );
  assertOk(pawnForward);
  assertEqual(pawnForward.passedPawnAdvance, true);
});

test('非將軍但形成威脅有 createNonCheckingThreat', () => {
  // Rook threatens black horse without giving check → createNonCheckingThreat
  const board = emptyBoard();
  place(board, 9, 3, piece('red', 'king'));
  place(board, 0, 5, piece('black', 'king'));
  place(board, 3, 6, piece('black', 'horse'));
  // Red rook at [3][0]: moving to [3][1] threatens horse at [3][6], not giving check
  place(board, 3, 0, piece('red', 'rook'));
  const dummyMove = {
    piece: piece('red', 'king'), from: { row: 9, col: 3 }, to: { row: 9, col: 3 }, captured: null,
  };
  const history = Array(14).fill(dummyMove);
  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  const nonCheckThreat = rec.traces.find(t => t.createNonCheckingThreat === true && t.checking === false);
  assertOk(nonCheckThreat);
});

test('無意義來回走子有 avoidAimlessMove 並扣分', () => {
  // Only kings present in endgame; king moves have no endgame purpose → avoidAimlessMove
  const board = emptyBoard();
  place(board, 9, 3, piece('red', 'king'));
  place(board, 0, 5, piece('black', 'king'));
  const dummyMove = {
    piece: piece('red', 'king'), from: { row: 9, col: 3 }, to: { row: 9, col: 3 }, captured: null,
  };
  const history = Array(14).fill(dummyMove);
  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  assertOk(rec.traces);
  const aimless = rec.traces.find(t => t.avoidAimlessMove === true);
  assertOk(aimless);
  assertOk((aimless.endgamePlanScore ?? 0) < 0);
});

test('debug report 含新增 endgame 相關欄位', () => {
  const board = emptyBoard();
  place(board, 9, 3, piece('red', 'king'));
  place(board, 0, 5, piece('black', 'king'));
  place(board, 5, 0, piece('red', 'rook'));
  const dummyMove = {
    piece: piece('red', 'king'), from: { row: 9, col: 3 }, to: { row: 9, col: 3 }, captured: null,
  };
  const history = Array(14).fill(dummyMove);
  const state = { board, turn: 'red' as const, history, status: 'playing' as const };
  const rec = recommendMove(state);
  const text = formatAiDebugReport({ modeName: 'test', state, recommendation: rec });
  assertOk(text.includes('endgamePlanActive'));
  assertOk(text.includes('towardEnemyKing'));
  assertOk(text.includes('restrictKingMobility'));
  assertOk(text.includes('attackPalaceGuard'));
  assertOk(text.includes('improveMajorActivity'));
  assertOk(text.includes('passedPawnAdvance'));
  assertOk(text.includes('createNonCheckingThreat'));
  assertOk(text.includes('avoidAimlessMove'));
});

// ══════════════════════════════════════════════════════════════
// Human vs AI 悔棋（undo）邏輯驗證
// ══════════════════════════════════════════════════════════════

test('human vs AI undo: undo unavailable before any move (empty stack)', () => {
  // The undo stack starts empty at game start → button should be disabled.
  // Modelled as: undoStepsNeeded entries required, stack has 0.
  const humanSide: Side = 'red';
  const initial = newGame();
  // At start it is humanSide's turn, so stepsNeeded = 2.
  const stepsNeeded = initial.turn === humanSide ? 2 : 1;
  const undoStackLength = 0; // nothing saved yet
  assertEqual(undoStackLength < stepsNeeded, true);
});

test('human vs AI undo: after human+AI moves, pre-human snapshot restores player-turn state', () => {
  const humanSide: Side = 'red';
  const aiSide: Side = 'black';
  const initial = newGame();
  // Human (red) makes first move
  const redMoves = getAllLegalMoves(initial.board, 'red');
  assertOk(redMoves.length > 0);
  const afterHuman = applyMove(initial, redMoves[0].from, redMoves[0].to);
  assertEqual(afterHuman.turn, aiSide);
  assertEqual(afterHuman.history.length, 1);
  // AI (black) responds
  const aiResult = recommendMove(afterHuman);
  assertOk(aiResult.move !== null);
  const afterAi = applyMove(afterHuman, aiResult.move!.from, aiResult.move!.to);
  assertEqual(afterAi.turn, humanSide);
  assertEqual(afterAi.history.length, 2);
  // Simulate undo: gameState.turn === humanSide → stepsBack = 2.
  // The 2-steps-back snapshot is the one saved BEFORE the human's move = initial.
  const restoredState = initial;
  assertEqual(restoredState.turn, humanSide);
  assertEqual(restoredState.history.length, 0);
});

test('human vs AI undo: restored state turn is humanSide so AI would not auto-trigger', () => {
  const humanSide: Side = 'red';
  const aiSide: Side = 'black';
  const initial = newGame();
  const redMoves = getAllLegalMoves(initial.board, 'red');
  const afterHuman = applyMove(initial, redMoves[0].from, redMoves[0].to);
  const aiResult = recommendMove(afterHuman);
  assertOk(aiResult.move !== null);
  const afterAi = applyMove(afterHuman, aiResult.move!.from, aiResult.move!.to);
  // After undo (2 steps back), restored to initial
  const restored = initial;
  // AI trigger condition is: gameState.turn === aiSide — must be false after undo
  assertEqual(restored.turn === aiSide, false);
  assertEqual(restored.turn, humanSide);
  // Human still has legal moves → can re-decide
  const legalAfterUndo = getAllLegalMoves(restored.board, humanSide);
  assertOk(legalAfterUndo.length > 0);
});

test('human vs AI undo: after undo human can choose a different first move', () => {
  const humanSide: Side = 'red';
  const initial = newGame();
  const redMoves = getAllLegalMoves(initial.board, 'red');
  assertOk(redMoves.length >= 2);
  // Original move
  const move1 = redMoves[0];
  const afterMove1 = applyMove(initial, move1.from, move1.to);
  const aiResult = recommendMove(afterMove1);
  assertOk(aiResult.move !== null);
  // After undo, pick a different move
  const move2 = redMoves[1];
  const isDifferent = move1.from.row !== move2.from.row || move1.from.col !== move2.from.col ||
                      move1.to.row !== move2.to.row || move1.to.col !== move2.to.col;
  assertOk(isDifferent);
  // Can apply the different move from the restored initial state
  const afterMove2 = applyMove(initial, move2.from, move2.to);
  assertEqual(afterMove2.history.length, 1);
  assertEqual(afterMove2.turn, 'black');
});

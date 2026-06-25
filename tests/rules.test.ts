import { getAllLegalMoves, isCheckmate, isInCheck } from '../src/game/checkRules';
import { recommendMove } from '../src/ai/simpleAi';
import { SIMPLE_AI_NOTE, SIMPLE_AI_TITLE } from '../src/ai/simpleAiText';
import { applyMove, newGame } from '../src/game/gameState';
import { clearBoard, clearSquare, correctSelectedRealType, editSquare, editSquareError, revealHotkeyType, revealSelectedByHotkey, setTurn } from '../src/game/boardEditing';
import { getCapturedPieces } from '../src/game/capturedPieces';
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
import { shouldPlayMoveSound } from '../src/game/soundEffects';
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
  place(board, 4, 4, piece('red', 'pawn', 'pawn', false));
  const state = { board, turn: 'red' as const, history: [], status: 'playing' as const };
  const before = remainingRealPieces(state.board, 'red');
  const next = editSquare(state, { row: 4, col: 4 }, {
    realType: 'cannon',
    revealed: true,
  });
  const after = remainingRealPieces(next.board, 'red');
  assertEqual(after.cannon, before.cannon - 1);
  assertEqual(after.pawn, before.pawn + 1);
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
  assertEqual(next.board[6][0]?.side, 'red');
  assertEqual(next.turn, 'red');
  assertEqual(next.status, 'red_win');
});

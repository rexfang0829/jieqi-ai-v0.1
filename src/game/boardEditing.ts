import type { Board, GameState, Piece, PieceType, Position, Side } from '../types/chess';

export type PieceDraft = {
  side: Side;
  originalType: PieceType;
  realType: PieceType;
  revealed: boolean;
};

export function createEmptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null));
}

export function createEditablePiece(draft: PieceDraft): Piece {
  return {
    id: `edit-${draft.side}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    side: draft.side,
    originalType: draft.originalType,
    realType: draft.realType,
    revealed: draft.revealed,
  };
}

export function editSquare(state: GameState, pos: Position, patch: Partial<Piece>, fallback?: PieceDraft): GameState {
  const current = state.board[pos.row][pos.col];
  if (!current && !fallback) return state;

  const board = state.board.map(row => row.map(piece => piece ? {...piece} : null));
  board[pos.row][pos.col] = current
    ? {...current, ...patch}
    : createEditablePiece({...fallback!, ...patch});

  return {
    ...state,
    board,
    status: 'playing',
  };
}

export function clearSquare(state: GameState, pos: Position): GameState {
  if (!state.board[pos.row][pos.col]) return state;

  const board = state.board.map(row => row.map(piece => piece ? {...piece} : null));
  board[pos.row][pos.col] = null;

  return {
    ...state,
    board,
    status: 'playing',
  };
}

export function clearBoard(state: GameState): GameState {
  return {
    ...state,
    board: createEmptyBoard(),
    history: [],
    status: 'playing',
  };
}

export function setTurn(state: GameState, turn: Side): GameState {
  return {
    ...state,
    turn,
    status: 'playing',
  };
}

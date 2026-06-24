import type { Board, GameState, GameStatus, Side } from '../types/chess';

export const POSITION_STORAGE_KEY = 'jieqi-ai.savedPosition.v1';

export type SavedPosition = {
  board: Board;
  turn: Side;
  status: GameStatus;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function isSide(value: unknown): value is Side {
  return value === 'red' || value === 'black';
}

function isStatus(value: unknown): value is GameStatus {
  return value === 'playing' || value === 'red_win' || value === 'black_win' || value === 'draw';
}

function isBoard(value: unknown): value is Board {
  return Array.isArray(value) &&
    value.length === 10 &&
    value.every(row => Array.isArray(row) && row.length === 9);
}

function isSavedPosition(value: unknown): value is SavedPosition {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SavedPosition>;
  return isBoard(data.board) && isSide(data.turn) && isStatus(data.status);
}

export function toSavedPosition(state: GameState): SavedPosition {
  return {
    board: state.board,
    turn: state.turn,
    status: state.status,
  };
}

export function fromSavedPosition(saved: SavedPosition): GameState {
  return {
    board: saved.board.map(row => row.map(piece => piece ? {...piece} : null)),
    turn: saved.turn,
    status: saved.status,
    history: [],
  };
}

export function savePosition(storage: StorageLike | undefined, state: GameState): boolean {
  if (!storage) return false;
  storage.setItem(POSITION_STORAGE_KEY, JSON.stringify(toSavedPosition(state)));
  return true;
}

export function loadPosition(storage: StorageLike | undefined): GameState | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSavedPosition(parsed)) return null;
    return fromSavedPosition(parsed);
  } catch {
    return null;
  }
}

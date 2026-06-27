import type { GameState, Move } from '../types/chess';
import { applyMove } from './gameEngine';

export const THIRD_REPETITION_MESSAGE = '此手會造成第三次重複局面';
export const AI_REPEAT_END_MESSAGE = '無可避免重複，對局結束';
export const REPETITION_DRAW_MESSAGE = '重複局面，和棋';
/** 同一局面出現此次數時判定和棋（4 次 = 重複 3 次後第 4 次出現） */
export const REPETITION_DRAW_THRESHOLD = 4;

/**
 * Fair-info position key: uses originalType for unrevealed pieces
 * so the key reflects public information only.
 */
export function getPositionKey(state: Pick<GameState, 'board' | 'turn'>): string {
  const rows = state.board.map(row =>
    row.map(piece => {
      if (!piece) return 'empty';
      const type = piece.revealed ? piece.realType : piece.originalType;
      return `${piece.side}:${piece.revealed ? '1' : '0'}:${type}`;
    }).join(',')
  ).join('/');
  return `turn=${state.turn}|board=${rows}`;
}

export function getPositionKeyAfterMove(state: GameState, move: Move): string {
  return getPositionKey(applyMove(state, move.from, move.to));
}

export function countPositionKey(states: Pick<GameState, 'board' | 'turn'>[], key: string): number {
  return states.reduce((count, state) => count + (getPositionKey(state) === key ? 1 : 0), 0);
}

export function wouldCauseThirdRepetition(state: GameState, pastStates: GameState[], move: Move): boolean {
  const key = getPositionKeyAfterMove(state, move);
  return countPositionKey([...pastStates, state], key) >= 2;
}

export function filterThirdRepetitionMoves(state: GameState, pastStates: GameState[], moves: Move[]): Move[] {
  return moves.filter(move => !wouldCauseThirdRepetition(state, pastStates, move));
}

/**
 * Returns true if the current position has already appeared
 * >= (REPETITION_DRAW_THRESHOLD - 1) times in pastStates,
 * meaning it is now appearing for the Nth time => draw.
 */
export function isRepetitionDraw(
  current: Pick<GameState, 'board' | 'turn'>,
  pastStates: Pick<GameState, 'board' | 'turn'>[]
): boolean {
  const key = getPositionKey(current);
  return countPositionKey(pastStates, key) >= REPETITION_DRAW_THRESHOLD - 1;
}

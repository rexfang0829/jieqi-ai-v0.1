import type { GameState, Position } from '../types/chess';
import { applyMove } from './gameState';

export type LastMoveSyncResult = {
  state: GameState;
  applied: boolean;
};

export function syncLastMove(state: GameState, from: Position, to: Position): LastMoveSyncResult {
  const next = applyMove(state, from, to);
  return {
    state: next,
    applied: next !== state,
  };
}

export function cancelLastMoveSync(state: GameState): GameState {
  return state;
}

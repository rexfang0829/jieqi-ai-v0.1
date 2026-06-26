import type { Move, PieceType } from '../types/chess';
import type { AiLearningPatternId } from './learningPatterns';

/**
 * Per-candidate-move debug trace produced by recommendMove().
 * Does not affect scoring — purely for observation, statistics, and tuning.
 */
export type AiMoveTrace = {
  move: Move;
  score: number;
  reason: string;
  patterns: AiLearningPatternId[];
  structureScore: number;
  exchangeNet: number;
  risk: number;
  captureGain: number;
  openingBonus: number;
  keySquareScore: number;
  hiddenPressureScore: number;
  leaveKeySquareScore: number;
  checking: boolean;
  effectiveCheck: boolean;
  lowQualityCheck: boolean;
  meaningless: boolean;
  threatValue: number;
  threatDelta: number;
  threatByMovedPiece: boolean;
  threatTargetType: PieceType | null;
  threatTargetRevealed: boolean | null;
};

/**
 * Return type of recommendMove().
 * Extends the previous { move, score, reason } shape with an optional traces array.
 * Existing callers that only read .move / .score / .reason are unaffected.
 */
export type AiRecommendation = {
  move: Move | null;
  score: number;
  reason: string;
  /** All evaluated candidate moves with their internal scores. Undefined for early-exit checkmate. */
  traces?: AiMoveTrace[];
};

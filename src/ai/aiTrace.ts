import type { Move, PieceType } from '../types/chess';
import type { AiLearningPatternId } from './learningPatterns';

/**
 * Per-candidate-move debug trace produced by recommendMove().
 * Does not affect scoring -- purely for observation, statistics, and tuning.
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
  moveRevealsUnknown: boolean;
  revealTacticalSuppressed: boolean;
  threatValue: number;
  threatDelta: number;
  threatByMovedPiece: boolean;
  threatTargetType: PieceType | null;
  threatTargetRevealed: boolean | null;
  edgeCannonPressureUnresolved: boolean;
  speculativeAttack: boolean;
  safeCapturePriority: boolean;
  repetitiveCheck: boolean;
  repetitiveCheckPenalty: number;
  revealChoiceRisk: boolean;
  revealChoicePenalty: number;
  openingMajorGoal: boolean;
  majorActivation: boolean;
  opponentRevealSuppression: boolean;
  advisorRevealClogRisk?: boolean;
  advisorRevealClogPenalty?: number;
  controlledDeadMajor?: boolean;
  deadMajorThreatHold?: boolean;
  deadMajorPressureScore?: number;
  defendsDoomedMajor?: boolean;
  forcedBadDefense?: boolean;
  postMoveLooseHiddenPiece?: boolean;
  postMoveLooseHiddenPieceCount?: number;
  postMoveProtectedUnderAttackCount?: number;
  postMoveLoosePiecePenalty?: number;
  rescuesLooseHiddenPiece?: boolean;
  ignoresLooseHiddenPiece?: boolean;
  firstMovePawnOpening?: boolean;
  firstMoveBlindHorseActivation?: boolean;
  firstMoveBlindHorsePenalty?: number;
  hasUnrevealedPawnSoldiers?: boolean;
  pawnSoldierDevelopment?: boolean;
  pawnSoldierThreatRevealedMajor?: boolean;
  pureBlindHorseActivation?: boolean;
  pureBlindHorsePenalty?: number;
  blindHorseStructureCapped?: boolean;
  blindHorseMajorActivationCapped?: boolean;
  pawnSoldierFollowUpHorse?: boolean;
  pawnSoldierHorseFootBlock?: boolean;
  pawnSoldierFollowUpElephant?: boolean;
  pawnSoldierCenterPreference?: boolean;
  pawnSoldierFollowUpAdvisor?: boolean;
  pawnSoldierAntiAdvisorFork?: boolean;
  revealedMajorCaptureAvailable?: boolean;
  safeRevealedMajorCapture?: boolean;
  revealedMajorCaptureScore?: number;
  pawnSoldierDelayedByMajorCapture?: boolean;
  deadMajorShouldCaptureNow?: boolean;
  deadMajorHoldSuppressedBySafeCapture?: boolean;
  pawnSoldierWalksIntoRevealedPawnAttack?: boolean;
  pawnSoldierSelfSacrifice?: boolean;
  pawnSoldierProtectedAfterAdvance?: boolean;
  pawnSoldierDevelopmentSuppressedByPawnAttack?: boolean;
  repeatedCheckingCycle?: boolean;
  repeatedPositionRisk?: boolean;
  repetitiveCheckSuppressed?: boolean;
  repetitionCount?: number;
  endgamePlanActive?: boolean;
  towardEnemyKing?: boolean;
  restrictKingMobility?: boolean;
  attackPalaceGuard?: boolean;
  improveMajorActivity?: boolean;
  passedPawnAdvance?: boolean;
  createNonCheckingThreat?: boolean;
  avoidAimlessMove?: boolean;
  endgamePlanScore?: number;
  hiddenMajorRecaptureRisk?: boolean;
  unsafeEndgameCapture?: boolean;
  unsafeCaptureExchangeNet?: number;
  edgeRookPawnLineLockRisk?: boolean;
  horsePawnLineGuard?: boolean;
  pawnSoldierDelayedByEdgeRookPressure?: boolean;
  decisionLayer?: number;
  decisionLayerLabel?: string;
  safetyGateTriggered?: boolean;
  highValuePieceInDanger?: boolean;
  unresolvedHighValueThreat?: boolean;
  resolvedHighValueThreat?: boolean;
  ignoredHigherPriorityThreat?: boolean;
};

/**
 * Return type of recommendMove().
 * Extends the previous { move, score, reason } shape with an optional traces array.
lers that only read .move / .score / .reason are unaffected.
 */
export type AiRecommendation = {
  move: Move | null;
  score: number;
  reason: string;
  /** All evaluated candidate moves with their internal scores. Undefined for early-exit checkmate. */
  traces?: AiMoveTrace[];
};

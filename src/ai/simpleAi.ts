import type { Board, GameState, Move, Piece, PieceType, Position, Side } from '../types/chess';
import { createAiView, visibleStateToMaskedGameState, type AiVisibleState } from './aiVisibility';
import { getAllLegalMoves, isInCheck } from '../game/checkRules';
import { applyMove } from '../game/gameEngine';
import { createInitialBoard } from '../game/initialBoard';
import { defaultAiWeights, type AiWeights } from './aiWeights';
import type { AiLearningPatternId } from './learningPatterns';
import type { AiMoveTrace, AiRecommendation } from './aiTrace';

const openingPawnStarts = createInitialBoard().flatMap((row, rowIndex) =>
  row.flatMap((piece, colIndex) =>
    piece?.originalType === 'pawn'
      ? [{ side: piece.side, row: rowIndex, col: colIndex }]
      : []
  )
);

type MoveEvaluation = {
  score: number;
  risk: number;
  immediateCapture: boolean;
  exchangeNet: number;
  captureGain: number;
  openingBonus: number;
  threatValue: number;
  escapeBonus: number;
  pressureBonus: number;
  targetGain: number;
  protectedMove: boolean;
  hangingMove: boolean;
  capturedConnectedAdvisor: boolean;
  capturedCrossedPawn: boolean;
  keySquareScore: number;
  leaveKeySquareScore: number;
  hiddenPressureScore: number;
  controlsImportantHidden: boolean;
  structureScore: number;
  structurePatterns: AiLearningPatternId[];
  releasedHorseFromPressure: boolean;
  releasedElephantFromPressure: boolean;
  weakScreen: boolean;
  preservesHiddenCannon: boolean;
  pawnLineDefense: boolean;
  preventsPawnLineLock: boolean;
  badHorseRelease: boolean;
  openingTempoPenalty: number;
  forcingReply: boolean;
  blocksImmediateWin: boolean;
  checking: boolean;
  effectiveCheck: boolean;
  lowQualityCheck: boolean;
  meaningless: boolean;
  moveRevealsUnknown: boolean;
  revealTacticalSuppressed: boolean;
  threatDelta: number;
  threatByMovedPiece: boolean;
  threatTargetType: PieceType | null;
  threatTargetRevealed: boolean | null;
  edgeCannonPressureUnresolved: boolean;
  speculativeAttack: boolean;
  safeCapturePriority: boolean;
  repetitiveCheck: boolean;
  repetitiveCheckPenaltyScore: number;
  revealChoiceRisk: boolean;
  revealChoicePenalty: number;
  openingMajorGoal: boolean;
  majorActivation: boolean;
  opponentRevealSuppression: boolean;
  advisorRevealClogRisk: boolean;
  advisorRevealClogPenalty: number;
  controlledDeadMajor: boolean;
  deadMajorThreatHold: boolean;
  deadMajorPressureScore: number;
  defendsDoomedMajor: boolean;
  forcedBadDefense: boolean;
  postMoveLooseHiddenPiece: boolean;
  postMoveLooseHiddenPieceCount: number;
  postMoveProtectedUnderAttackCount: number;
  postMoveLoosePiecePenalty: number;
  rescuesLooseHiddenPiece: boolean;
  ignoresLooseHiddenPiece: boolean;
  firstMovePawnOpening: boolean;
  firstMoveBlindHorseActivation: boolean;
  firstMoveBlindHorsePenalty: number;
  hasUnrevealedPawnSoldiers: boolean;
  pawnSoldierDevelopment: boolean;
  pawnSoldierThreatRevealedMajor: boolean;
  pureBlindHorseActivation: boolean;
  pureBlindHorsePenalty: number;
  blindHorseStructureCapped: boolean;
  blindHorseMajorActivationCapped: boolean;
  pawnSoldierFollowUpHorse: boolean;
  pawnSoldierHorseFootBlock: boolean;
  pawnSoldierFollowUpElephant: boolean;
  pawnSoldierCenterPreference: boolean;
  pawnSoldierFollowUpAdvisor: boolean;
  pawnSoldierAntiAdvisorFork: boolean;
  revealedMajorCaptureAvailable: boolean;
  safeRevealedMajorCapture: boolean;
  revealedMajorCaptureScore: number;
  pawnSoldierDelayedByMajorCapture: boolean;
  deadMajorShouldCaptureNow: boolean;
  deadMajorHoldSuppressedBySafeCapture: boolean;
  pawnSoldierWalksIntoRevealedPawnAttack: boolean;
  pawnSoldierSelfSacrifice: boolean;
  pawnSoldierProtectedAfterAdvance: boolean;
  pawnSoldierDevelopmentSuppressedByPawnAttack: boolean;
  repeatedCheckingCycle: boolean;
  repeatedCheckingCyclePenaltyScore: number;
  repeatedPositionRisk: boolean;
  repetitiveCheckSuppressed: boolean;
  repetitionCount: number;
  endgamePlanActive: boolean;
  towardEnemyKing: boolean;
  restrictKingMobility: boolean;
  attackPalaceGuard: boolean;
  improveMajorActivity: boolean;
  passedPawnAdvance: boolean;
  createNonCheckingThreat: boolean;
  avoidAimlessMove: boolean;
  endgamePlanScore: number;
  hiddenMajorRecaptureRisk: boolean;
  unsafeEndgameCapture: boolean;
  unsafeCaptureExchangeNet: number;
  edgeRookPawnLineLockRisk: boolean;
  horsePawnLineGuard: boolean;
  pawnSoldierDelayedByEdgeRookPressure: boolean;
};

type AiThreatInfo = {
  value: number;
  from: Position;
  to: Position;
  targetType: PieceType;
  targetRevealed: boolean;
  byMovedPiece: boolean;
};

type LooseHiddenPieceReport = {
  loosePositions: Position[];
  protectedUnderAttackPositions: Position[];
};

type PawnSoldierFollowUp = {
  pawnSoldierFollowUpHorse: boolean;
  pawnSoldierHorseFootBlock: boolean;
  pawnSoldierFollowUpElephant: boolean;
  pawnSoldierCenterPreference: boolean;
  pawnSoldierFollowUpAdvisor: boolean;
  pawnSoldierAntiAdvisorFork: boolean;
  score: number;
};

function detectRepetitiveCheck(state: GameState, move: Move, isCheck: boolean): boolean {
  if (!isCheck) return false;
  const h = state.history;
  if (h.length < 4) return false;
  const prev1 = h[h.length - 2]; // same side 1 turn ago
  const prev2 = h[h.length - 4]; // same side 2 turns ago
  if (!prev1 || !prev2) return false;
  if (prev1.piece.side !== state.turn || prev2.piece.side !== state.turn) return false;
  // If prior same-side moves captured material, those were genuine attacks, not fruitless checks
  // (current move may capture a low-value piece en route to delivering check — still counts as repetitive)
  if (prev1.captured || prev2.captured) return false;
  return true; // 3 consecutive non-capturing moves from same side, current is check
}

function detectRepeatedCheckingCycle(state: GameState, move: Move, isCheck: boolean): boolean {
  if (!isCheck) return false;
  const h = state.history;
  if (h.length < 6) return false;
  const prev2 = h[h.length - 2]; // same side, last move
  const prev4 = h[h.length - 4]; // same side, 2 moves ago
  if (!prev2 || !prev4) return false;
  if (prev2.piece.side !== state.turn || prev4.piece.side !== state.turn) return false;
  // Any capture in the cycle = genuine attack, not a repetitive back-and-forth
  if (move.captured || prev2.captured || prev4.captured) return false;
  // Detect A→B, B→A, A→B pattern: current from==prev2.to, current to==prev2.from
  return (
    samePosition(move.from, prev2.to) &&
    samePosition(move.to, prev2.from) &&
    samePosition(prev2.from, prev4.to) &&
    samePosition(prev2.to, prev4.from)
  );
}

function publicType(piece: { originalType: PieceType; realType: PieceType; revealed: boolean }): PieceType {
  return piece.revealed ? piece.realType : piece.originalType;
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(piece => piece ? { ...piece } : null));
}

function applyMoveToBoard(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const moving = next[move.from.row][move.from.col];
  if (!moving) return next;
  next[move.to.row][move.to.col] = { ...moving, revealed: true };
  next[move.from.row][move.from.col] = null;
  return next;
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function includesPosition(positions: Position[], target: Position): boolean {
  return positions.some(position => samePosition(position, target));
}

function pieceValue(piece: Piece, weights: AiWeights): number {
  return weights.pieceValues[publicType(piece)];
}

function movedPieceValue(piece: Piece, weights: AiWeights): number {
  return weights.pieceValues[piece.realType];
}

function countRevealedSameType(board: Board, side: Side, type: PieceType): number {
  return board.reduce((count, row) => count + row.filter(piece =>
    piece?.side === side &&
    piece.revealed &&
    piece.realType === type
  ).length, 0);
}

function hiddenPieceValue(piece: Piece, board: Board, weights: AiWeights): number {
  if (piece.revealed) return movedPieceValue(piece, weights);

  const revealedCount = Math.min(2, countRevealedSameType(board, piece.side, piece.realType));
  if (piece.realType === 'rook') {
    if (revealedCount === 0) return weights.hiddenRookValueNoRevealed;
    if (revealedCount === 1) return weights.hiddenRookValueOneRevealed;
    return weights.hiddenRookValueTwoRevealed;
  }
  if (piece.realType === 'cannon') {
    if (revealedCount === 0) return weights.hiddenCannonValueNoRevealed;
    if (revealedCount === 1) return weights.hiddenCannonValueOneRevealed;
    return weights.hiddenCannonValueTwoRevealed;
  }
  if (piece.realType === 'horse') {
    if (revealedCount === 0) return weights.hiddenHorseValueNoRevealed;
    if (revealedCount === 1) return weights.hiddenHorseValueOneRevealed;
    return weights.hiddenHorseValueTwoRevealed;
  }
  return Math.round(movedPieceValue(piece, weights) * 0.65);
}

function defensiveTargetValue(piece: Piece, board: Board, position: Position, weights: AiWeights): number {
  return piece.revealed ? targetValue(piece, board, position, weights) : hiddenPieceValue(piece, board, weights);
}

function opponent(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}

function winningStatus(side: Side): GameState['status'] {
  return side === 'red' ? 'red_win' : 'black_win';
}

function isConnectedAdvisor(piece: Piece, board: Board, position: Position, weights: AiWeights): boolean {
  if (publicType(piece) !== 'advisor') return false;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (row === position.row && col === position.col) continue;
      const other = board[row][col];
      if (!other || other.side !== piece.side || publicType(other) !== 'advisor') continue;
      const distance = Math.abs(row - position.row) + Math.abs(col - position.col);
      if (distance <= weights.connectedAdvisorDistance) return true;
    }
  }
  return false;
}

function isCrossedPawn(piece: Piece, position: Position): boolean {
  if (publicType(piece) !== 'pawn') return false;
  return piece.side === 'red' ? position.row <= 4 : position.row >= 5;
}

function isNearEnemyPalace(piece: Piece, position: Position): boolean {
  if (piece.side === 'red') return position.row <= 2 && position.col >= 3 && position.col <= 5;
  return position.row >= 7 && position.col >= 3 && position.col <= 5;
}

function targetValue(piece: Piece, board: Board, position: Position, weights: AiWeights): number {
  const type = publicType(piece);
  if (type === 'king') return weights.pieceValues.king;
  if (type === 'rook') return weights.pieceValues.rook;
  if (type === 'cannon') return weights.targetCannonValue;
  if (type === 'horse') return weights.pieceValues.horse;
  if (type === 'advisor') return isConnectedAdvisor(piece, board, position, weights) ? weights.connectedAdvisorValue : weights.advisorTargetValue;
  if (type === 'elephant') return weights.elephantTargetValue;
  if (type === 'pawn') {
    if (!isCrossedPawn(piece, position)) return weights.uncrossedPawnTargetValue;
    return isNearEnemyPalace(piece, position) ? weights.crossedPawnNearPalaceValue : weights.crossedPawnTargetValue;
  }
  return pieceValue(piece, weights);
}

function captureScore(board: Board, move: Move, weights: AiWeights): number {
  return move.captured ? targetValue(move.captured, board, move.to, weights) : 0;
}

function revealScore(move: Move, weights: AiWeights): number {
  return move.flipped ? weights.revealBonus : 0;
}

function positionScore(move: Move): number {
  let score = 4 - Math.abs(4 - move.to.col);
  if (move.to.row >= 3 && move.to.row <= 6) score += 3;
  return score;
}

function isOpeningPawnStart(side: Side, position: Position): boolean {
  return openingPawnStarts.some(start =>
    start.side === side &&
    start.row === position.row &&
    start.col === position.col
  );
}

function isPriorityOpeningPawnFile(col: number): boolean {
  return col === 0 || col === 2 || col === 6 || col === 8;
}

function isUnrevealedPawnSoldier(piece: Piece | null | undefined): piece is Piece {
  return !!piece && !piece.revealed && piece.originalType === 'pawn';
}

function hasUnrevealedPawnSoldiersForSide(board: Board, side: Side): boolean {
  return board.some(row => row.some(piece =>
    piece?.side === side && isUnrevealedPawnSoldier(piece)
  ));
}

function countUnrevealedPawnSoldiersForSide(board: Board, side: Side): number {
  return board.reduce((total, row) =>
    total + row.filter(piece => piece?.side === side && isUnrevealedPawnSoldier(piece)).length,
    0
  );
}

function isPawnSoldierDevelopmentMove(move: Move): boolean {
  return isUnrevealedPawnSoldier(move.piece);
}

function isRevealedMajorType(type: PieceType | null | undefined): boolean {
  return type === 'rook' || type === 'cannon' || type === 'horse';
}

function moveFromPositionThreatensRevealedMajor(board: Board, side: Side, from: Position): boolean {
  return getAllLegalMoves(board, side).some(move =>
    samePosition(move.from, from) &&
    !!move.captured &&
    move.captured.revealed &&
    isRevealedMajorType(move.captured.realType)
  );
}

function isPawnOriginRevealedPiece(piece: Piece | null | undefined, type: PieceType): piece is Piece {
  return !!piece && piece.revealed && piece.originalType === 'pawn' && piece.realType === type;
}

function isHorseFootBlockSquare(horse: Position, block: Position): boolean {
  return Math.abs(horse.row - block.row) + Math.abs(horse.col - block.col) === 1;
}

function pawnSoldierFollowUpEvaluation(board: Board, side: Side, move: Move, weights: AiWeights): PawnSoldierFollowUp {
  const empty = {
    pawnSoldierFollowUpHorse: false,
    pawnSoldierHorseFootBlock: false,
    pawnSoldierFollowUpElephant: false,
    pawnSoldierCenterPreference: false,
    pawnSoldierFollowUpAdvisor: false,
    pawnSoldierAntiAdvisorFork: false,
    score: 0,
  };
  if (!isPawnSoldierDevelopmentMove(move)) return empty;

  const enemy = opponent(side);
  const result = { ...empty };
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece?.side !== enemy || piece.originalType !== 'pawn' || !piece.revealed) continue;

      const sameFile = move.from.col === col || move.to.col === col;
      if (piece.realType === 'horse' && sameFile) {
        result.pawnSoldierFollowUpHorse = true;
        result.score += weights.pawnSoldierFollowUpHorseBonus;
        if (isHorseFootBlockSquare({ row, col }, move.to)) {
          result.pawnSoldierHorseFootBlock = true;
          result.score += weights.pawnSoldierHorseFootBlockBonus;
        }
      }

      if (piece.realType === 'elephant') {
        const centerFile = move.from.col === 4 || move.to.col === 4;
        const nearbyThirdOrFifth = col === 2 || col === 4 || col === 6;
        if (centerFile || nearbyThirdOrFifth && Math.abs(move.to.col - col) <= 2) {
          result.pawnSoldierFollowUpElephant = true;
          result.score += weights.pawnSoldierFollowUpElephantBonus;
          if (centerFile) {
            result.pawnSoldierCenterPreference = true;
            result.score += weights.pawnSoldierCenterPreferenceBonus;
          }
        }
      }

      if (piece.realType === 'advisor' && sameFile) {
        result.pawnSoldierFollowUpAdvisor = true;
        result.pawnSoldierAntiAdvisorFork = true;
        result.score += weights.pawnSoldierFollowUpAdvisorBonus + weights.pawnSoldierAntiAdvisorForkBonus;
      }
    }
  }

  return result;
}

function openingPawnRevealBonus(state: GameState, move: Move, weights: AiWeights): number {
  if (state.history.length > 8) return 0;
  if (move.piece.side !== state.turn) return 0;
  if (move.piece.originalType !== 'pawn') return 0;
  if (move.piece.revealed) return 0;
  if (!isOpeningPawnStart(state.turn, move.from)) return 0;
  if (!isPriorityOpeningPawnFile(move.from.col)) return 0;
  if (enemyOpeningEdgeCannonCols(state.board, state.turn).includes(move.from.col)) return 0;
  if (enemyOpeningEdgeRookCols(state.board, state.turn).includes(move.from.col)) return 0;

  let bonus = weights.openingPawnBonus;
  if (move.from.col === 0 || move.from.col === 8) bonus += weights.edgePawnBonus;
  else if (move.from.col === 2 || move.from.col === 6) bonus += weights.thirdSeventhPawnBonus;
  if (state.history.length === 0) bonus += weights.firstMovePawnOpeningBonus;
  return bonus;
}

function hasFirstMovePriorityPawnOption(state: GameState, weights: AiWeights): boolean {
  if (state.history.length !== 0) return false;
  return getAllLegalMoves(state.board, state.turn).some(move =>
    openingPawnRevealBonus(state, move, weights) > 0
  );
}

function bestRecaptureValue(board: Board, side: Side, target: Position, weights: AiWeights): number {
  const replies = getAllLegalMoves(board, side);
  let best = 0;
  for (const reply of replies) {
    if (!reply.captured || !samePosition(reply.to, target)) continue;
    best = Math.max(best, targetValue(reply.captured, board, reply.to, weights));
  }
  return best;
}

function maxCaptureValue(board: Board, side: Side, weights: AiWeights): number {
  let best = 0;
  for (const move of getAllLegalMoves(board, side)) {
    if (move.captured) best = Math.max(best, targetValue(move.captured, board, move.to, weights));
  }
  return best;
}

function bestCaptureThreat(
  board: Board,
  side: Side,
  movedTo: Position | undefined,
  weights: AiWeights
): AiThreatInfo | null {
  let best: AiThreatInfo | null = null;
  for (const move of getAllLegalMoves(board, side)) {
    if (!move.captured) continue;
    const value = targetValue(move.captured, board, move.to, weights);
    if (!best || value > best.value) {
      best = {
        value,
        from: move.from,
        to: move.to,
        targetType: publicType(move.captured),
        targetRevealed: move.captured.revealed,
        byMovedPiece: !!movedTo && samePosition(move.from, movedTo),
      };
    }
  }
  return best;
}

function isSquareProtectedBySide(board: Board, side: Side, position: Position): boolean {
  const probe = cloneBoard(board);
  probe[position.row][position.col] = {
    id: 'protection-probe',
    side: opponent(side),
    originalType: 'pawn',
    realType: 'pawn',
    revealed: true,
  };
  return getAllLegalMoves(probe, side).some(move => samePosition(move.to, position));
}

function isSquareAttacked(board: Board, bySide: Side, target: Position): boolean {
  return getAllLegalMoves(board, bySide).some(move =>
    move.captured && samePosition(move.to, target)
  );
}

function isPositionAttackedByRevealedEnemy(board: Board, side: Side, target: Position): boolean {
  const enemy = opponent(side);
  return getAllLegalMoves(board, enemy).some(move =>
    move.piece.revealed &&
    move.captured &&
    move.captured.side === side &&
    samePosition(move.to, target)
  );
}

function isHiddenPieceAttackedByRevealedEnemy(board: Board, side: Side, target: Position): boolean {
  const piece = board[target.row][target.col];
  return !!piece && !piece.revealed && isPositionAttackedByRevealedEnemy(board, side, target);
}

function isSquareAttackedByRevealedPawn(board: Board, bySide: Side, target: Position): boolean {
  return getAllLegalMoves(board, bySide).some(m =>
    m.piece.revealed &&
    publicType(m.piece) === 'pawn' &&
    m.captured &&
    samePosition(m.to, target)
  );
}

function hiddenMajorCanRecaptureAt(board: Board, enemySide: Side, target: Position): boolean {
  return getAllLegalMoves(board, enemySide).some(m =>
    !m.piece.revealed &&
    (m.piece.originalType === 'rook' || m.piece.originalType === 'cannon' || m.piece.originalType === 'horse') &&
    samePosition(m.to, target) &&
    m.captured != null
  );
}

function analyzeLooseHiddenPieces(board: Board, side: Side): LooseHiddenPieceReport {
  const loosePositions: Position[] = [];
  const protectedUnderAttackPositions: Position[] = [];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (!piece || piece.side !== side || piece.revealed) continue;

      const position = { row, col };
      if (!isHiddenPieceAttackedByRevealedEnemy(board, side, position)) continue;

      if (isSquareProtectedBySide(board, side, position)) {
        protectedUnderAttackPositions.push(position);
      } else {
        loosePositions.push(position);
      }
    }
  }

  return { loosePositions, protectedUnderAttackPositions };
}

function isPrematureOpeningCannonStrike(state: GameState, move: Move): boolean {
  if (state.history.length > 8) return false;
  if (move.piece.revealed) return false;
  if (move.piece.originalType !== 'cannon') return false;
  if (!move.captured || move.captured.revealed) return false;
  if (move.captured.originalType !== 'horse' && move.captured.originalType !== 'rook') return false;
  const distance = Math.abs(move.from.row - move.to.row) + Math.abs(move.from.col - move.to.col);
  return distance >= 4;
}

function opponentHasImmediateWin(board: Board, side: Side): boolean {
  const enemy = opponent(side);
  const fakeState: GameState = { board, turn: enemy, history: [], status: 'playing' };
  return getAllLegalMoves(board, enemy).some(move =>
    applyMove(fakeState, move.from, move.to).status === winningStatus(enemy)
  );
}

function opponentKingPosition(board: Board, side: Side): Position | null {
  const enemy = opponent(side);
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece?.side === enemy && piece.realType === 'king') return { row, col };
    }
  }
  return null;
}

function kingZonePressureBonus(board: Board, side: Side, movedTo: Position, weights: AiWeights): number {
  const king = opponentKingPosition(board, side);
  if (!king) return 0;

  const distance = Math.abs(king.row - movedTo.row) + Math.abs(king.col - movedTo.col);
  if (distance <= 2) return weights.kingZoneNearBonus;
  if (distance <= 4 && (king.row === movedTo.row || king.col === movedTo.col)) return weights.kingZoneLineBonus;
  return 0;
}

function isNearEnemyCamp(side: Side, position: Position): boolean {
  return side === 'red' ? position.row <= 3 : position.row >= 6;
}

function keySquareBonus(board: Board, side: Side, position: Position, weights: AiWeights): number {
  let score = 0;

  if (position.col === 4) score += weights.keySquareCenterFileBonus;
  else if (position.col === 3 || position.col === 5) score += weights.keySquareNearCenterFileBonus;

  if (position.row === 4 || position.row === 5) score += weights.keySquareRiverBonus;
  if (isNearEnemyPalace({ id: 'key-square', side, originalType: 'pawn', realType: 'pawn', revealed: true }, position)) score += weights.keySquareEnemyPalaceBonus;
  if ((position.col === 1 || position.col === 7) && isNearEnemyCamp(side, position)) score += weights.keySquareSecondEighthFileBonus;

  const enemy = opponent(side);
  const adjacentHidden = [
    { row: position.row - 1, col: position.col },
    { row: position.row + 1, col: position.col },
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 },
  ].some(pos => {
    const piece = board[pos.row]?.[pos.col];
    return piece?.side === enemy && !piece.revealed;
  });
  if (adjacentHidden) score += weights.keySquareAdjacentHiddenBonus;

  return Math.min(score, weights.keySquareMaxBonus);
}

function leaveKeySquarePenalty(board: Board, side: Side, from: Position, to: Position, hasClearGain: boolean, weights: AiWeights): number {
  if (hasClearGain) return 0;

  const fromScore = keySquareBonus(board, side, from, weights);
  const toScore = keySquareBonus(board, side, to, weights);
  if (fromScore < weights.leaveKeySquareThreshold || fromScore - toScore < weights.leaveKeySquareDropThreshold) return 0;
  return fromScore >= weights.leaveKeySquareStrongThreshold ? weights.leaveKeySquareStrongPenalty : weights.leaveKeySquareWeakPenalty;
}

function hiddenPiecePressureBonus(board: Board, side: Side, weights: AiWeights): number {
  const controlled = new Set<string>();
  for (const move of getAllLegalMoves(board, side)) {
    const target = board[move.to.row][move.to.col];
    if (target?.side === opponent(side) && !target.revealed) {
      controlled.add(`${move.to.row},${move.to.col}`);
    }
  }

  let score = 0;
  for (const key of controlled) {
    const [row, col] = key.split(',').map(Number);
    score += weights.hiddenPiecePressureBonus;
    if (col === 4 || row === 4 || row === 5 || isNearEnemyCamp(side, { row, col })) score += weights.importantHiddenPiecePressureBonus;
  }
  return Math.min(score, weights.hiddenPiecePressureMaxBonus);
}

function isOpeningPhase(state: GameState, weights: AiWeights): boolean {
  return state.history.length <= weights.openingPhaseMoveLimit;
}

function forwardDirection(side: Side): number {
  return side === 'red' ? -1 : 1;
}

function ownPawnLineRow(side: Side): number {
  return side === 'red' ? 6 : 3;
}

function isInitialBackRankPiece(piece: Piece, position: Position, type: PieceType): boolean {
  if (piece.originalType !== type) return false;
  const backRank = piece.side === 'red' ? 9 : 0;
  if (position.row !== backRank) return false;
  if (type === 'horse') return position.col === 1 || position.col === 7;
  if (type === 'elephant') return position.col === 2 || position.col === 6;
  if (type === 'rook') return position.col === 0 || position.col === 8;
  return false;
}

function isHiddenMajor(piece: Piece | null): piece is Piece {
  return !!piece && !piece.revealed && (piece.realType === 'rook' || piece.realType === 'cannon' || piece.realType === 'horse');
}

function isHiddenCannon(piece: Piece | null): piece is Piece {
  return !!piece && !piece.revealed && piece.realType === 'cannon';
}

function isReleasedHorseMove(move: Move): boolean {
  return publicType(move.piece) === 'horse' && isInitialBackRankPiece(move.piece, move.from, 'horse');
}

function isReleasedElephantMove(move: Move): boolean {
  return publicType(move.piece) === 'elephant' && isInitialBackRankPiece(move.piece, move.from, 'elephant');
}

function isGoodHorseGuardSquare(side: Side, position: Position): boolean {
  const advanceRow = side === 'red' ? 7 : 2;
  return position.row === advanceRow && (position.col === 2 || position.col === 6);
}

function isBadHorseReleaseSquare(side: Side, position: Position): boolean {
  const advanceRow = side === 'red' ? 7 : 2;
  return position.row === advanceRow && (position.col === 0 || position.col === 8);
}

function hasOpeningEdgeCannonPressure(board: Board, side: Side): boolean {
  return enemyOpeningEdgeCannonCols(board, side).length > 0;
}

function enemyOpeningEdgeCannonCols(board: Board, side: Side): number[] {
  const enemy = opponent(side);
  const cols = new Set<number>();
  for (const row of board) {
    for (let col = 0; col < row.length; col++) {
      const piece = row[col];
      if (
        piece?.side === enemy &&
        piece.revealed &&
        piece.originalType === 'pawn' &&
        piece.realType === 'cannon' &&
        (col === 0 || col === 8)
      ) {
        cols.add(col);
      }
    }
  }
  return [...cols];
}

function hasOpeningEdgeRookPawnLineLockRisk(board: Board, side: Side): boolean {
  if (enemyOpeningEdgeRookCols(board, side).length > 0) return true;
  const enemy = opponent(side);
  return board.some((row, rowIndex) => row.some((piece, col) =>
    piece?.side === enemy &&
    piece.revealed &&
    piece.originalType === 'pawn' &&
    piece.realType === 'rook' &&
    (col === 0 || col === 8 || Math.abs(rowIndex - ownPawnLineRow(side)) <= 2)
  ));
}

function enemyOpeningEdgeRookCols(board: Board, side: Side): number[] {
  const enemy = opponent(side);
  const cols = new Set<number>();
  for (const row of board) {
    for (let col = 0; col < row.length; col++) {
      const piece = row[col];
      if (
        piece?.side === enemy &&
        piece.revealed &&
        piece.originalType === 'pawn' &&
        piece.realType === 'rook' &&
        (col === 0 || col === 8)
      ) {
        cols.add(col);
      }
    }
  }
  return [...cols];
}

function isHorseReleaseForCannonPressure(side: Side, to: Position): boolean {
  return isBadHorseReleaseSquare(side, to);
}

function isHorseReleaseForPawnLineGuard(side: Side, to: Position): boolean {
  return isGoodHorseGuardSquare(side, to);
}

function isElephantReleaseForCannonPressure(side: Side, to: Position): boolean {
  const advanceRow = side === 'red' ? 7 : 2;
  return to.row === advanceRow && (to.col === 0 || to.col === 8);
}

function guardsPawnLineKeyPoint(side: Side, position: Position): boolean {
  const guardRow = ownPawnLineRow(side) + forwardDirection(side);
  return position.row === guardRow && (position.col === 2 || position.col === 4 || position.col === 6);
}

function hasHiddenRookGuardPoint(board: Board, side: Side, position: Position): boolean {
  const guardRow = ownPawnLineRow(side) + forwardDirection(side);
  if (position.row !== guardRow) return false;
  return board.some(row => row.some(piece => piece?.side === side && !piece.revealed && piece.realType === 'rook'));
}

function enemyRookOnPawnLineRisk(board: Board, side: Side): number {
  const enemy = opponent(side);
  const lineRow = ownPawnLineRow(side);
  let risk = 0;

  for (let col = 0; col < 9; col++) {
    const piece = board[lineRow][col];
    if (piece?.side === enemy && publicType(piece) === 'rook') risk += 1;
  }

  for (const edgeCol of [0, 8]) {
    for (let row = 0; row < board.length; row++) {
      const piece = board[row][edgeCol];
      if (piece?.side === enemy && publicType(piece) === 'rook' && Math.abs(row - lineRow) <= 2) risk += 1;
    }
  }

  return risk;
}

function cannonLineThreatAgainstSide(board: Board, side: Side, weights: AiWeights): number {
  const dirs = [
    { row: 1, col: 0 },
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: -1 },
  ];
  let threat = 0;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const cannon = board[row][col];
      if (!cannon || cannon.side === side || publicType(cannon) !== 'cannon') continue;

      for (const dir of dirs) {
        let screens = 0;
        for (let r = row + dir.row, c = col + dir.col; r >= 0 && r < 10 && c >= 0 && c < 9; r += dir.row, c += dir.col) {
          const target = board[r][c];
          if (!target) continue;
          if (screens === 0) {
            screens += 1;
            continue;
          }
          if (target.side === side && isHiddenMajor(target)) {
            threat += Math.round(defensiveTargetValue(target, board, { row: r, col: c }, weights) * 0.08);
          }
          break;
        }
      }
    }
  }

  return threat;
}

function structurePatternEvaluation(state: GameState, move: Move, nextBoard: Board, hasClearGain: boolean, weights: AiWeights): {
  score: number;
  patterns: AiLearningPatternId[];
  releasedHorseFromPressure: boolean;
  releasedElephantFromPressure: boolean;
  weakScreen: boolean;
  preservesHiddenCannon: boolean;
  pawnLineDefense: boolean;
  preventsPawnLineLock: boolean;
  badHorseRelease: boolean;
  horsePawnLineGuard: boolean;
} {
  if (!isOpeningPhase(state, weights)) {
    return {
      score: 0,
      patterns: [],
      releasedHorseFromPressure: false,
      releasedElephantFromPressure: false,
      weakScreen: false,
      preservesHiddenCannon: false,
      pawnLineDefense: false,
      preventsPawnLineLock: false,
      badHorseRelease: false,
      horsePawnLineGuard: false,
    };
  }

  if (!move.piece.revealed && move.piece.originalType === 'pawn' && isOpeningPawnStart(state.turn, move.from)) {
    return {
      score: 0,
      patterns: [],
      releasedHorseFromPressure: false,
      releasedElephantFromPressure: false,
      weakScreen: false,
      preservesHiddenCannon: false,
      pawnLineDefense: false,
      preventsPawnLineLock: false,
      badHorseRelease: false,
      horsePawnLineGuard: false,
    };
  }

  const beforeCannonThreat = cannonLineThreatAgainstSide(state.board, state.turn, weights);
  const afterCannonThreat = cannonLineThreatAgainstSide(nextBoard, state.turn, weights);
  const beforePawnLineRisk = enemyRookOnPawnLineRisk(state.board, state.turn);
  const afterPawnLineRisk = enemyRookOnPawnLineRisk(nextBoard, state.turn);
  const releasedHorse = isReleasedHorseMove(move);
  const releasedElephant = isReleasedElephantMove(move);
  const pawnLineDefense = guardsPawnLineKeyPoint(state.turn, move.to);
  const edgeCannonPressure = hasOpeningEdgeCannonPressure(state.board, state.turn) && beforeCannonThreat > 0;
  const edgeRookPawnLineLockRisk = hasOpeningEdgeRookPawnLineLockRisk(state.board, state.turn) || beforePawnLineRisk > 0;
  const horseCannonRelease = releasedHorse && edgeCannonPressure && isHorseReleaseForCannonPressure(state.turn, move.to);
  const elephantCannonRelease = releasedElephant && edgeCannonPressure && isElephantReleaseForCannonPressure(state.turn, move.to);
  const horsePawnLineGuard = releasedHorse && edgeRookPawnLineLockRisk && isHorseReleaseForPawnLineGuard(state.turn, move.to);
  const threatMismatch =
    releasedHorse &&
    (
      edgeCannonPressure && isHorseReleaseForPawnLineGuard(state.turn, move.to) ||
      edgeRookPawnLineLockRisk && !edgeCannonPressure && isHorseReleaseForCannonPressure(state.turn, move.to)
    );
  const preventsPawnLineLock = horsePawnLineGuard && afterPawnLineRisk <= beforePawnLineRisk;
  const badHorseRelease = threatMismatch || releasedHorse && isBadHorseReleaseSquare(state.turn, move.to) && !pawnLineDefense && !edgeCannonPressure;
  const preservesHiddenCannon = !isHiddenCannon(move.piece) && state.board.some(row => row.some(piece => piece?.side === state.turn && isHiddenCannon(piece)));
  const weakScreen = isHiddenCannon(move.piece) && beforeCannonThreat > 0 && afterCannonThreat >= beforeCannonThreat && !hasClearGain;
  const patterns = new Set<AiLearningPatternId>();
  let score = 0;

  if (beforeCannonThreat > 0) patterns.add('opening_cannon_hits_hidden_rook');
  if (edgeRookPawnLineLockRisk) patterns.add('opening_edge_rook_pawn_line_lock');

  if (releasedHorse) {
    patterns.add('opening_hidden_pawn_blocks_horse_foot');
    score += weights.openingHiddenPawnAssumptionBonus + weights.pawnFootBlockThreatBonus;
    if (horseCannonRelease) score += weights.structureReleaseHorseBonus;
    if (!edgeCannonPressure && beforeCannonThreat > 0) score += weights.structureReleaseHorseBonus;
    if (horsePawnLineGuard || !edgeCannonPressure && isGoodHorseGuardSquare(state.turn, move.to)) {
      patterns.add('horse_release_to_guard_pawn_line');
      score += weights.pawnLineDefenseBonus;
    }
    if (hasHiddenRookGuardPoint(state.board, state.turn, move.to)) {
      patterns.add('hidden_rook_guard_point');
      score += weights.hiddenRookGuardPointBonus + weights.pawnNearHiddenRookThreatBonus;
    }
  }

  if (releasedElephant) {
    patterns.add('opening_hidden_pawn_blocks_elephant_eye');
    score += weights.openingHiddenPawnAssumptionBonus + weights.pawnElephantEyeBlockThreatBonus;
    if (elephantCannonRelease || !edgeCannonPressure && beforeCannonThreat > 0) {
      patterns.add('elephant_release_from_cannon_pressure');
      score += weights.structureReleaseElephantBonus;
    }
  }

  if (pawnLineDefense && (!edgeCannonPressure || horsePawnLineGuard)) score += weights.pawnLineDefenseBonus;
  if (preventsPawnLineLock) score += weights.preventEnemyRookPawnLineLockBonus + weights.pawnLineLockThreatBonus;
  if (afterPawnLineRisk > beforePawnLineRisk) score += weights.enemyRookOnPawnLinePenalty;
  if (badHorseRelease) score += weights.badHorseReleaseSquarePenalty;
  if (beforeCannonThreat > 0) score += Math.max(weights.cannonLineThreatPenalty, -beforeCannonThreat);
  if (afterCannonThreat < beforeCannonThreat) score += Math.min(beforeCannonThreat - afterCannonThreat, weights.structureReleaseHorseBonus);
  if (weakScreen) {
    patterns.add('preserve_hidden_cannon_threat');
    score += weights.weakScreenAllowsPawnBlockPenalty;
  }
  if (preservesHiddenCannon && !hasClearGain) {
    patterns.add('preserve_hidden_cannon_threat');
    score += weights.preserveHiddenCannonBonus;
  }
  if (state.board.some(row => row.some(piece => piece?.side === opponent(state.turn) && !piece.revealed))) {
    patterns.add('opening_hidden_pawn_as_cannon_screen');
    if (releasedHorse || releasedElephant || pawnLineDefense) score += weights.pawnCannonScreenThreatBonus;
  }

  return {
    score,
    patterns: [...patterns],
    releasedHorseFromPressure: horseCannonRelease || horsePawnLineGuard || releasedHorse && !edgeCannonPressure && beforeCannonThreat > 0,
    releasedElephantFromPressure: elephantCannonRelease || releasedElephant && !edgeCannonPressure && beforeCannonThreat > 0,
    weakScreen,
    preservesHiddenCannon: preservesHiddenCannon && !hasClearGain,
    pawnLineDefense,
    preventsPawnLineLock,
    badHorseRelease,
    horsePawnLineGuard,
  };
}

/**
 * 公平資訊：估計對方回擊棋子的威脅值。
 * 只使用 piece.originalType（公開資訊），不讀 unrevealed piece.realType。
 * revealed=true 時可讀 realType，因為那是已公開資訊。
 */
function publicHiddenReplyThreatValue(piece: Piece, weights: AiWeights): number {
  if (piece.revealed) return weights.pieceValues[piece.realType];
  const type = piece.originalType;
  if (type === 'rook') return weights.pieceValues.rook;
  if (type === 'cannon') return weights.targetCannonValue;
  if (type === 'horse') return weights.pieceValues.horse;
  if (type === 'advisor') return weights.advisorTargetValue;
  if (type === 'elephant') return weights.elephantTargetValue;
  if (type === 'pawn') return weights.uncrossedPawnTargetValue;
  return weights.pieceValues[type];
}

/**
 * 後手翻棋選擇權風險評估。
 * 觸發條件：我方高價子吃對方低外觀暗子，且落點被對方高價暗子看住。
 * 對方可依我方翻出結果決定是否交換 → 我方承擔翻子風險。
 * 不使用 unrevealed piece.realType：對方看住暗子以 originalType 估值（公平資訊）。
 */
function computeRevealChoiceRisk(
  board: Board,
  side: Side,
  move: Move,
  weights: AiWeights
): { isRisk: boolean; penalty: number } {
  // 只在有吃子且吃的是暗子時觸發
  if (!move.captured || move.captured.revealed) return { isRisk: false, penalty: 0 };

  // 被吃的暗子必須是低外觀（pawn / advisor / elephant）
  const capturedOrig = move.captured.originalType;
  const isLowAppearance =
    capturedOrig === 'pawn' || capturedOrig === 'advisor' || capturedOrig === 'elephant';
  if (!isLowAppearance) return { isRisk: false, penalty: 0 };

  // 我方走子必須是高價子（使用 publicType = 公開資訊）
  const moverPubType = publicType(move.piece);
  const isHighValueMover =
    moverPubType === 'rook' || moverPubType === 'cannon' || moverPubType === 'horse';
  if (!isHighValueMover) return { isRisk: false, penalty: 0 };

  // 吃完後盤面，檢查落點是否被對方暗子看住
  const nextBoard = applyMoveToBoard(board, move);
  const opp = opponent(side);
  const oppMoves = getAllLegalMoves(nextBoard, opp);

  let maxHiddenThreat = 0;
  for (const reply of oppMoves) {
    if (!samePosition(reply.to, move.to)) continue;
    // 公平資訊估值：只用 originalType，不讀 unrevealed realType
    const replyEst = publicHiddenReplyThreatValue(reply.piece, weights);
    maxHiddenThreat = Math.max(maxHiddenThreat, replyEst);
  }

  // 只有對方有高價值棋子看住落點才觸發
  if (maxHiddenThreat < weights.pieceValues.horse) return { isRisk: false, penalty: 0 };

  // 扣分：車吃重扣，炮/馬吃中扣
  const isRookMover = moverPubType === 'rook';
  const penalty = -(weights.revealChoiceRiskPenaltyBase + (isRookMover ? weights.revealChoiceRiskHighValueExtra : 0));
  return { isRisk: true, penalty };
}

/**
 * 開局大子活動目標（公平資訊）。
 * 判斷一手是否具有「活出大子」或「壓制對方翻子」的開局價值。
 * 嚴禁使用 unrevealed piece.realType 做加分判斷。
 * 只使用：piece.revealed、piece.originalType、初始位置、已翻出棋子、合法走法。
 */
function computeOpeningMajorActivation(
  state: GameState,
  move: Move,
  hiddenPressureScore: number,
  weights: AiWeights
): { majorActivation: boolean; openingMajorGoal: boolean; opponentRevealSuppression: boolean } {
  if (!isOpeningPhase(state, weights)) {
    return { majorActivation: false, openingMajorGoal: false, opponentRevealSuppression: false };
  }

  // 大子活動：已翻出的大子（rook/horse/cannon）在移動
  // 已翻出的棋子 realType 是公開資訊，可以使用
  const moverRevealed = move.piece.revealed;
  const moverRealMajor =
    moverRevealed &&
    (move.piece.realType === 'rook' ||
      move.piece.realType === 'horse' ||
      move.piece.realType === 'cannon');

  // 活馬：從初始後排位置活出馬（originalType='horse'，初始後排，公開資訊）
  const releasingHorse = isReleasedHorseMove(move);

  // 活象：從初始後排位置活出象（公開資訊）
  const releasingElephant = isReleasedElephantMove(move);

  const majorActivation = moverRealMajor || releasingHorse || releasingElephant;

  // 開局大子目標：majorActivation，或未翻開兵從初始位置移動釋放後排大子空間
  const openingMajorGoal = majorActivation;

  // 壓制對方翻子：同時達成大子活動且有暗子壓制
  const opponentRevealSuppression =
    majorActivation && hiddenPressureScore >= weights.hiddenPiecePressureBonus;

  return { majorActivation, openingMajorGoal, opponentRevealSuppression };
}

function opponentReplyPenalty(board: Board, side: Side, movedTo: Position, movedPiece: Piece, weights: AiWeights): {
  risk: number;
  immediateCapture: boolean;
  maxReplyGain: number;
  possibleLoss: number;
} {
  const replies = getAllLegalMoves(board, opponent(side));
  let immediateCapture = false;
  let maxReplyGain = 0;
  let possibleLoss = 0;

  for (const reply of replies) {
    if (reply.captured) {
      const gain = targetValue(reply.captured, board, reply.to, weights);
      if (gain > maxReplyGain) maxReplyGain = gain;
    }

    if (!samePosition(reply.to, movedTo)) continue;

    immediateCapture = true;
    const replyBoard = applyMoveToBoard(board, reply);
    const recaptureValue = bestRecaptureValue(replyBoard, side, movedTo, weights);
    const tradeNet = defensiveTargetValue(movedPiece, board, movedTo, weights) - recaptureValue;
    possibleLoss = Math.max(possibleLoss, Math.max(0, tradeNet));
  }

  return {
    immediateCapture,
    maxReplyGain,
    possibleLoss,
    risk: Math.round(possibleLoss * weights.possibleLossMultiplier + maxReplyGain * weights.maxReplyGainPenaltyRatio),
  };
}

// ─── 暗士翻子卡陣風險 ────────────────────────────────────────────────────────

function isInOwnPalaceArea(side: Side, pos: Position): boolean {
  if (side === 'red') return pos.row >= 7 && pos.col >= 3 && pos.col <= 5;
  return pos.row <= 2 && pos.col >= 3 && pos.col <= 5;
}

function detectAdvisorRevealClogRisk(
  move: Move,
  captureGain: number,
  effectiveCheck: boolean,
  blocksImmediateWin: boolean,
  weights: AiWeights
): { isRisk: boolean; penalty: number } {
  if (move.piece.revealed) return { isRisk: false, penalty: 0 };
  if (move.piece.originalType !== 'advisor') return { isRisk: false, penalty: 0 };
  // Only fire if this move will reveal the advisor (any move of unrevealed piece reveals it)
  if (captureGain > 0 || effectiveCheck || blocksImmediateWin) return { isRisk: false, penalty: 0 };
  const nearKing = isInOwnPalaceArea(move.piece.side, move.from) ||
    isInOwnPalaceArea(move.piece.side, move.to);
  const penalty = nearKing
    ? weights.advisorRevealClogNearKingPenalty
    : weights.advisorRevealClogPenalty;
  return { isRisk: true, penalty };
}

// ─── 死車威脅保留 ──────────────────────────────────────────────────────────────

function findControlledDeadMajors(board: Board, side: Side): Position[] {
  const opp = side === 'red' ? 'black' : 'red';
  const result: Position[] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (!piece || piece.side !== opp) continue;
      if (publicType(piece) !== 'rook') continue;
      // If our side can attack that square, we "control" this rook
      if (isSquareAttacked(board, side, { row, col })) {
        result.push({ row, col });
      }
    }
  }
  return result;
}

function findOwnMajorsUnderAttack(board: Board, side: Side): Position[] {
  const opp = side === 'red' ? 'black' : 'red';
  const result: Position[] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (!piece || piece.side !== side) continue;
      if (publicType(piece) !== 'rook') continue;
      if (isSquareAttacked(board, opp, { row, col })) {
        result.push({ row, col });
      }
    }
  }
  return result;
}

function chebyshevDist(a: Position, b: Position): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

function isPalaceGuardPiece(piece: Piece): boolean {
  const t = publicType(piece);
  return t === 'advisor' || t === 'elephant';
}

function isMajorActivePiece(piece: Piece): boolean {
  const t = publicType(piece);
  return t === 'rook' || t === 'cannon' || t === 'horse';
}

function enemyPalaceCenter(side: Side): Position {
  return side === 'red' ? { row: 1, col: 4 } : { row: 8, col: 4 };
}

type EndgamePlan = {
  endgamePlanActive: boolean;
  towardEnemyKing: boolean;
  restrictKingMobility: boolean;
  attackPalaceGuard: boolean;
  improveMajorActivity: boolean;
  passedPawnAdvance: boolean;
  createNonCheckingThreat: boolean;
  avoidAimlessMove: boolean;
  endgamePlanScore: number;
};

function computeEndgamePlan(
  state: GameState,
  move: Move,
  nextBoard: Board,
  checking: boolean,
  importantThreat: boolean,
  captureGain: number,
  blocksImmediateWin: boolean,
  rescuesLooseHiddenPiece: boolean,
  weights: AiWeights
): EndgamePlan {
  const inactive: EndgamePlan = {
    endgamePlanActive: false,
    towardEnemyKing: false,
    restrictKingMobility: false,
    attackPalaceGuard: false,
    improveMajorActivity: false,
    passedPawnAdvance: false,
    createNonCheckingThreat: false,
    avoidAimlessMove: false,
    endgamePlanScore: 0,
  };
  if (isOpeningPhase(state, weights)) return inactive;

  const opp = opponent(state.turn);
  const movedPiece = nextBoard[move.to.row][move.to.col]!;
  const palaceCenter = enemyPalaceCenter(state.turn);
  const kingPos = opponentKingPosition(nextBoard, state.turn);

  // towardEnemyKing: revealed major moves closer to enemy king
  let towardEnemyKing = false;
  if (kingPos && movedPiece.revealed && isMajorActivePiece(movedPiece)) {
    const distBefore = chebyshevDist(move.from, kingPos);
    const distAfter = chebyshevDist(move.to, kingPos);
    towardEnemyKing = distAfter < distBefore;
  }

  // restrictKingMobility: opponent king has fewer legal moves after this move
  let restrictKingMobility = false;
  {
    const oppMovesBefore = getAllLegalMoves(state.board, opp).filter(m => publicType(m.piece) === 'king').length;
    const oppMovesAfter = getAllLegalMoves(nextBoard, opp).filter(m => publicType(m.piece) === 'king').length;
    restrictKingMobility = oppMovesAfter < oppMovesBefore;
  }

  // attackPalaceGuard: captured advisor/elephant, OR moved revealed piece can capture advisor/elephant
  let attackPalaceGuard = false;
  if (move.captured && isPalaceGuardPiece(move.captured)) {
    attackPalaceGuard = true;
  } else if (movedPiece.revealed) {
    const followUp = getAllLegalMoves(nextBoard, state.turn);
    attackPalaceGuard = followUp.some(m =>
      m.from.row === move.to.row && m.from.col === move.to.col &&
      m.captured != null && isPalaceGuardPiece(m.captured)
    );
  }

  // improveMajorActivity: revealed rook/cannon/horse moves closer to enemy palace center
  let improveMajorActivity = false;
  if (movedPiece.revealed && isMajorActivePiece(movedPiece)) {
    const distBefore = chebyshevDist(move.from, palaceCenter);
    const distAfter = chebyshevDist(move.to, palaceCenter);
    improveMajorActivity = distAfter < distBefore;
  }

  // passedPawnAdvance: revealed crossed pawn moving forward
  let passedPawnAdvance = false;
  if (movedPiece.revealed && publicType(movedPiece) === 'pawn' && isCrossedPawn(movedPiece, move.to)) {
    const movingForward = state.turn === 'red'
      ? move.to.row < move.from.row
      : move.to.row > move.from.row;
    passedPawnAdvance = movingForward;
  }

  // createNonCheckingThreat: important threat without giving check
  const createNonCheckingThreat = !checking && importantThreat;

  // avoidAimlessMove: no endgame or general purpose detected, and not already penalized as meaningless
  const hasAnyPurpose =
    towardEnemyKing || restrictKingMobility || attackPalaceGuard ||
    improveMajorActivity || passedPawnAdvance || createNonCheckingThreat ||
    captureGain > 0 || checking || blocksImmediateWin || rescuesLooseHiddenPiece;
  const avoidAimlessMove = !hasAnyPurpose;

  const endgamePlanScore =
    (towardEnemyKing ? weights.towardEnemyKingBonus : 0) +
    (restrictKingMobility ? weights.restrictKingMobilityBonus : 0) +
    (attackPalaceGuard ? weights.attackPalaceGuardBonus : 0) +
    (improveMajorActivity ? weights.improveMajorActivityBonus : 0) +
    (passedPawnAdvance ? weights.passedPawnAdvanceBonus : 0) +
    (createNonCheckingThreat ? weights.createNonCheckingThreatBonus : 0) +
    (avoidAimlessMove ? weights.avoidAimlessMovePenalty : 0);

  return {
    endgamePlanActive: true,
    towardEnemyKing,
    restrictKingMobility,
    attackPalaceGuard,
    improveMajorActivity,
    passedPawnAdvance,
    createNonCheckingThreat,
    avoidAimlessMove,
    endgamePlanScore,
  };
}

function allowsOpponentWin(state: GameState, move: Move): boolean {
  const next = applyMove(state, move.from, move.to);
  if (next === state || next.status !== 'playing') return false;
  const opponentMoves = getAllLegalMoves(next.board, next.turn);
  return opponentMoves.some(reply =>
    applyMove(next, reply.from, reply.to).status === winningStatus(next.turn)
  );
}

function evaluateMove(state: GameState, move: Move, blocksImmediateWin: boolean, weights: AiWeights, posRevealedMajorCaptureAvailable = false): MoveEvaluation {
  const next = applyMove(state, move.from, move.to);
  const nextBoard = next === state ? applyMoveToBoard(state.board, move) : next.board;
  const moved = nextBoard[move.to.row][move.to.col]!;
  const reply = opponentReplyPenalty(nextBoard, state.turn, move.to, moved, weights);
  const targetGain = captureScore(state.board, move, weights);
  const captureGain = targetGain;
  const openingBonus = openingPawnRevealBonus(state, move, weights);
  const beforeThreat = bestCaptureThreat(state.board, state.turn, undefined, weights);
  const afterThreat = bestCaptureThreat(nextBoard, state.turn, move.to, weights);
  const threatValue = afterThreat?.value ?? 0;
  const threatDelta = threatValue - (beforeThreat?.value ?? 0);
  const threatByMovedPiece = afterThreat?.byMovedPiece ?? false;
  const moveRevealsUnknown = !move.piece.revealed;
  const revealDependentThreat = moveRevealsUnknown && threatByMovedPiece;
  const importantThreat = threatValue >= weights.pieceValues.horse && (threatDelta > 0 || threatByMovedPiece) && !revealDependentThreat;
  const hasUnrevealedPawnSoldiers = hasUnrevealedPawnSoldiersForSide(state.board, state.turn);
  const unrevealedPawnSoldierCount = countUnrevealedPawnSoldiersForSide(state.board, state.turn);
  const pawnSoldiersStillDeveloping = unrevealedPawnSoldierCount >= 2;
  const pawnSoldierDevelopment = isOpeningPhase(state, weights) && isPawnSoldierDevelopmentMove(move);
  const pawnSoldierThreatRevealedMajor =
    pawnSoldierDevelopment &&
    moveFromPositionThreatensRevealedMajor(nextBoard, state.turn, move.to);
  const pawnSoldierFollowUp = pawnSoldierFollowUpEvaluation(state.board, state.turn, move, weights);
  const pawnSoldierDevelopmentScore = pawnSoldierDevelopment ? weights.pawnSoldierDevelopmentBonus : 0;
  const pawnSoldierThreatRevealedMajorScore = pawnSoldierThreatRevealedMajor
    ? weights.pawnSoldierThreatRevealedMajorBonus
    : 0;
  const wasUnderAttack = isSquareAttacked(state.board, opponent(state.turn), move.from);
  const escapeBonus = wasUnderAttack && !reply.immediateCapture && movedPieceValue(move.piece, weights) >= weights.pieceValues.horse ? weights.escapeImportantPieceBonus : 0;
  const pressureBonus = kingZonePressureBonus(nextBoard, state.turn, move.to, weights);
  const protectedMove = isSquareProtectedBySide(nextBoard, state.turn, move.to);
  const capturedConnectedAdvisor = !!move.captured && publicType(move.captured) === 'advisor' && isConnectedAdvisor(move.captured, state.board, move.to, weights);
  const capturedCrossedPawn = !!move.captured && publicType(move.captured) === 'pawn' && isCrossedPawn(move.captured, move.to);
  const rawKeySquareScore = keySquareBonus(nextBoard, state.turn, move.to, weights);
  const keySquareScore = openingBonus > 0 ? Math.min(rawKeySquareScore, weights.openingKeySquareMaxBonus) : rawKeySquareScore;
  const hiddenPressureScore = hiddenPiecePressureBonus(nextBoard, state.turn, weights);
  const controlsImportantHidden = hiddenPressureScore >= weights.hiddenPiecePressureBonus + weights.importantHiddenPiecePressureBonus;
  const rawChecking = next !== state && next.status === 'playing' && isInCheck(next.board, next.turn);
  const checking = moveRevealsUnknown ? false : rawChecking;
  const revealTacticalSuppressed = moveRevealsUnknown && (rawChecking || revealDependentThreat);
  const effectiveCheck = checking && (
    captureGain > 0 ||
    importantThreat ||
    pressureBonus > 0 ||
    reply.possibleLoss === 0 && threatValue >= weights.effectiveCheckThreatValue
  );
  const lowQualityCheck = checking && !effectiveCheck;
  const exchangeNet = captureGain - reply.possibleLoss;
  const hasClearGain = captureGain >= weights.pieceValues.cannon || blocksImmediateWin || effectiveCheck || (captureGain > 0 && exchangeNet >= 0) || escapeBonus > 0;
  const leaveKeySquareScore = leaveKeySquarePenalty(state.board, state.turn, move.from, move.to, hasClearGain, weights);
  const structure = structurePatternEvaluation(state, move, nextBoard, hasClearGain, weights);
  // Edge cannon pressure: cap hiddenPressureScore for plain pawn moves that don't resolve pressure
  const edgeCannonPressure = isOpeningPhase(state, weights) && hasOpeningEdgeCannonPressure(state.board, state.turn);
  const edgeRookPressure = isOpeningPhase(state, weights) && hasOpeningEdgeRookPawnLineLockRisk(state.board, state.turn);
  const isPlainUnrevealedPawnMove = !move.piece.revealed && move.piece.originalType === 'pawn' &&
    !structure.releasedHorseFromPressure && !structure.releasedElephantFromPressure &&
    !structure.preventsPawnLineLock && !structure.pawnLineDefense && captureGain === 0;
  const edgeCannonPressureUnresolved = edgeCannonPressure && isPlainUnrevealedPawnMove;
  const cappedHiddenPressureScore = edgeCannonPressureUnresolved
    ? Math.min(hiddenPressureScore, weights.edgeCannonPressureHiddenPressureCap)
    : hiddenPressureScore;

  // Safe capture priority: boost definite captures over speculative pressure
  const safeCapturePriority = captureGain > 0 && exchangeNet >= 0;
  const safeCapturePriorityBonus = safeCapturePriority ? weights.safeCapturePriorityBonus : 0;

  // Speculative hidden cannon attack: penalize unrevealed cannon threatening unrevealed target (no capture)
  const speculativeAttack = !move.piece.revealed && move.piece.originalType === 'cannon' &&
    captureGain === 0 && (afterThreat?.byMovedPiece ?? false) && !(afterThreat?.targetRevealed ?? true);
  const speculativeAttackPenalty = speculativeAttack ? weights.speculativeHiddenAttackPenalty : 0;

  // Repetitive check: penalize same side using any piece for checks multiple turns in a row
  const repetitiveCheck = detectRepetitiveCheck(state, move, checking);
  const repetitiveCheckPenaltyScore = repetitiveCheck ? weights.repetitiveCheckPenalty : 0;
  // Repeated checking cycle: same piece bouncing between 2 squares giving perpetual check
  const repeatedCheckingCycle = detectRepeatedCheckingCycle(state, move, checking);
  const repeatedCheckingCyclePenaltyScore = repeatedCheckingCycle ? weights.repeatedCheckingCyclePenalty : 0;
  // Position risk: any repetitive checking pattern triggers position risk flag
  const repeatedPositionRisk = repetitiveCheck || repeatedCheckingCycle;

  // 後手翻棋選擇權懲罰（揭棋核心：主動吃低價暗子後給對方選擇權）
  const { isRisk: revealChoiceRisk, penalty: revealChoicePenalty } =
    computeRevealChoiceRisk(state.board, state.turn, move, weights);

  // 開局大子活動目標（公平資訊，不偷看 realType）
  const { majorActivation, openingMajorGoal, opponentRevealSuppression } =
    computeOpeningMajorActivation(state, move, hiddenPressureScore, weights);

  // 開局非大子活動手的 hiddenPressureScore 上限（避免純壓制蓋過活馬/活炮）
  const isOpeningNonActivation = isOpeningPhase(state, weights) && !majorActivation && !edgeCannonPressureUnresolved;
  const finalHiddenPressureScore = isOpeningNonActivation
    ? Math.min(cappedHiddenPressureScore, weights.hiddenPressureNonActivationCap)
    : cappedHiddenPressureScore;

  const majorActivationScore = openingMajorGoal ? weights.majorActivationBonus : 0;
  const opponentRevealSuppressionScore = opponentRevealSuppression ? weights.opponentRevealSuppressionBonus : 0;

  // 暗士翻子卡陣風險
  const { isRisk: advisorRevealClogRisk, penalty: advisorRevealClogPenalty } =
    detectAdvisorRevealClogRisk(move, captureGain, effectiveCheck, blocksImmediateWin, weights);

  // 死車威脅保留：對方車已被我方控制（hangingMove 後才能確定是否保留）
  const controlledDeadMajorPositions = findControlledDeadMajors(state.board, state.turn);
  const controlledDeadMajor = controlledDeadMajorPositions.length > 0;
  const capturedControlledRook = controlledDeadMajor &&
    !!move.captured && publicType(move.captured) === 'rook' &&
    controlledDeadMajorPositions.some(p => p.row === move.to.row && p.col === move.to.col);

  // 明大子吃子優先（Req A/B）
  const revealedMajorCaptureAvailable = posRevealedMajorCaptureAvailable;
  const safeRevealedMajorCapture = !!move.captured && move.captured.revealed &&
    (publicType(move.captured) === 'rook' || publicType(move.captured) === 'cannon') &&
    exchangeNet >= 0;
  const safeRevealedRookCapture = safeRevealedMajorCapture && publicType(move.captured!) === 'rook';
  const revealedMajorCaptureScore = safeRevealedMajorCapture
    ? (safeRevealedRookCapture
        ? weights.safeRevealedRookCaptureBonus + weights.revealedMajorCapturePriorityBonus
        : weights.safeRevealedMajorCaptureBonus + weights.revealedMajorCapturePriorityBonus)
    : 0;
  // 暗兵卒開發延後（Req C）
  const pawnSoldierDelayedByMajorCapture = pawnSoldierDevelopment && revealedMajorCaptureAvailable;
  const pawnSoldierDelayPenalty = pawnSoldierDelayedByMajorCapture ? weights.pawnSoldierDelayWhenMajorCaptureAvailablePenalty : 0;

  // 暗兵卒走入已翻兵卒攻擊（白送）—— 不限開局階段
  const isUnrevealedPawnMove = isUnrevealedPawnSoldier(move.piece);
  const pawnSoldierProtectedAfterAdvance = isUnrevealedPawnMove &&
    isSquareProtectedBySide(nextBoard, state.turn, move.to);
  const pawnSoldierWalksIntoRevealedPawnAttack = isUnrevealedPawnMove &&
    captureGain === 0 &&
    !blocksImmediateWin &&
    isSquareAttackedByRevealedPawn(nextBoard, opponent(state.turn), move.to) &&
    !pawnSoldierProtectedAfterAdvance;
  const pawnSoldierSelfSacrifice = pawnSoldierWalksIntoRevealedPawnAttack;
  const pawnSoldierDevelopmentSuppressedByPawnAttack = pawnSoldierWalksIntoRevealedPawnAttack;
  const pawnSoldierWalksIntoPawnAttackPenalty = pawnSoldierWalksIntoRevealedPawnAttack
    ? weights.pawnSoldierWalksIntoRevealedPawnAttackPenalty : 0;
  const pawnSoldierDevelopmentSuppressedByPawnAttackPenalty = pawnSoldierDevelopmentSuppressedByPawnAttack
    ? weights.pawnSoldierDevelopmentSuppressedByPawnAttackPenalty : 0;

  // 暗大子回吃風險
  const hiddenMajorRecaptureRisk = captureGain > 0 &&
    !blocksImmediateWin &&
    !effectiveCheck &&
    hiddenMajorCanRecaptureAt(nextBoard, opponent(state.turn), move.to);
  const unsafeCaptureExchangeNet = captureGain -
    Math.round(defensiveTargetValue(move.piece, state.board, move.from, weights));
  const unsafeEndgameCapture = hiddenMajorRecaptureRisk &&
    unsafeCaptureExchangeNet < 0 &&
    !isSquareProtectedBySide(nextBoard, state.turn, move.to);
  const unsafeCapturePenalty = unsafeEndgameCapture ? weights.unsafeCapturePenalty : 0;

  // 硬保死車扣分：暗士翻子保護己方已被對方控制的車
  const ownMajorsUnderAttack = findOwnMajorsUnderAttack(state.board, state.turn);
  const defendsDoomedMajor = advisorRevealClogRisk && ownMajorsUnderAttack.length > 0 &&
    captureGain === 0 && !effectiveCheck && !blocksImmediateWin;
  const forcedBadDefense = defendsDoomedMajor;

  // Post-move loose hidden piece scan: only revealed enemy attackers count.
  const beforeLooseHiddenPieces = analyzeLooseHiddenPieces(state.board, state.turn);
  const postMoveLooseHiddenPieces = analyzeLooseHiddenPieces(nextBoard, state.turn);
  const postMoveLooseHiddenPieceCount = postMoveLooseHiddenPieces.loosePositions.length;
  const postMoveProtectedUnderAttackCount = postMoveLooseHiddenPieces.protectedUnderAttackPositions.length;
  const postMoveLooseHiddenPiece = postMoveLooseHiddenPieceCount > 0;
  const rescuedLooseHiddenPieceCount = beforeLooseHiddenPieces.loosePositions.filter(position =>
    !includesPosition(postMoveLooseHiddenPieces.loosePositions, position) &&
    !includesPosition(postMoveLooseHiddenPieces.protectedUnderAttackPositions, position)
  ).length;
  const movedFromLooseHiddenPiece = includesPosition(beforeLooseHiddenPieces.loosePositions, move.from);
  const movedPieceStillAttackedByRevealedEnemy =
    movedFromLooseHiddenPiece && isPositionAttackedByRevealedEnemy(nextBoard, state.turn, move.to);
  const rescuesLooseHiddenPiece = rescuedLooseHiddenPieceCount > 0 && !movedPieceStillAttackedByRevealedEnemy;
  const ignoresLooseHiddenPiece =
    beforeLooseHiddenPieces.loosePositions.length > 0 &&
    rescuedLooseHiddenPieceCount === 0 &&
    !rescuesLooseHiddenPiece;
  const postMoveLoosePiecePenalty =
    postMoveLooseHiddenPieceCount * weights.postMoveLooseHiddenPiecePenalty;
  const rescueLooseHiddenPieceScore = rescuesLooseHiddenPiece ? weights.rescueLooseHiddenPieceBonus : 0;
  const protectedUnderAttackPenalty = postMoveProtectedUnderAttackCount > 0
    ? Math.max(
      weights.protectedUnderAttackPenaltyCap,
      -10 * postMoveProtectedUnderAttackCount
    )
    : 0;
  const activationOnlyScore =
    Math.max(0, structure.score) +
    Math.max(0, majorActivationScore) +
    Math.max(0, opponentRevealSuppressionScore);
  const activationOnlyCapPenalty =
    ignoresLooseHiddenPiece &&
    captureGain === 0 &&
    !effectiveCheck &&
    !blocksImmediateWin &&
    activationOnlyScore > weights.activationOnlyCapWhenLoosePieceExists
      ? -(activationOnlyScore - weights.activationOnlyCapWhenLoosePieceExists)
      : 0;
  const firstMovePawnOpening = state.history.length === 0 && openingBonus > 0;
  const firstMoveBlindHorseActivation =
    hasFirstMovePriorityPawnOption(state, weights) &&
    state.history.length === 0 &&
    !move.piece.revealed &&
    move.piece.originalType === 'horse' &&
    captureGain === 0 &&
    !effectiveCheck &&
    !blocksImmediateWin &&
    !rescuesLooseHiddenPiece &&
    !isPositionAttackedByRevealedEnemy(state.board, state.turn, move.from);
  const firstMoveBlindHorsePenalty = firstMoveBlindHorseActivation
    ? weights.firstMoveBlindHorseActivationPenalty
    : 0;
  const firstMoveBlindMajorActivationCapPenalty =
    firstMoveBlindHorseActivation &&
    majorActivationScore > weights.firstMoveBlindMajorActivationCap
      ? -(majorActivationScore - weights.firstMoveBlindMajorActivationCap)
      : 0;
  const pureBlindHorseActivation =
    pawnSoldiersStillDeveloping &&
    !move.piece.revealed &&
    move.piece.originalType === 'horse' &&
    captureGain === 0 &&
    !effectiveCheck &&
    !blocksImmediateWin &&
    !rescuesLooseHiddenPiece &&
    !importantThreat &&
    !structure.horsePawnLineGuard &&
    (structure.score > 0 || majorActivation || structure.releasedHorseFromPressure);
  const blindHorseStructureCapped =
    pureBlindHorseActivation && structure.score > weights.pureBlindHorseStructureCap;
  const blindHorseMajorActivationCapped =
    pureBlindHorseActivation && majorActivationScore > weights.pureBlindHorseMajorActivationCap;
  const finalStructureScore = blindHorseStructureCapped
    ? weights.pureBlindHorseStructureCap
    : structure.score;
  const finalMajorActivationScore = blindHorseMajorActivationCapped
    ? weights.pureBlindHorseMajorActivationCap
    : majorActivationScore;
  const pureBlindHorsePenalty = pureBlindHorseActivation
    ? weights.pureBlindHorseActivationPenalty + weights.pawnSoldierHiddenExtraBlindHorsePenalty
    : 0;

  // Edge rook pressure: boost horse guard moves, penalize plain pawn development that ignores edge rook
  const horsePawnLineGuardEdgeRookBonus =
    pawnSoldiersStillDeveloping && structure.horsePawnLineGuard && edgeRookPressure
      ? weights.horsePawnLineGuardEdgeRookBonus
      : 0;
  const pawnSoldierDelayedByEdgeRookPressure =
    pawnSoldierDevelopment && edgeRookPressure && !pawnSoldierThreatRevealedMajor;
  const pawnSoldierDelayedByEdgeRookPressurePenalty = pawnSoldierDelayedByEdgeRookPressure
    ? weights.pawnSoldierDelayedByEdgeRookPressurePenalty
    : 0;

  const forcingReply =
    blocksImmediateWin ||
    effectiveCheck ||
    structure.releasedHorseFromPressure ||
    structure.releasedElephantFromPressure ||
    structure.preventsPawnLineLock;
  const safeHighExchange =
    captureGain >= weights.pieceValues.rook &&
    exchangeNet >= weights.safeCaptureExchangeNet &&
    protectedMove;
  const openingTempoPenalty = isPrematureOpeningCannonStrike(state, move) && !forcingReply && !safeHighExchange
    ? -Math.max(weights.openingCannonTempoMinPenalty, Math.round(captureGain * weights.openingCannonTempoPenaltyRatio))
    : 0;
  const purposeful = (
    captureGain > 0 ||
    openingBonus > 0 ||
    importantThreat ||
    escapeBonus > 0 ||
    pressureBonus > 0 ||
    keySquareScore >= weights.keySquareEnemyPalaceBonus ||
    hiddenPressureScore >= weights.hiddenPiecePressureBonus + weights.importantHiddenPiecePressureBonus ||
    finalStructureScore > 0 ||
    structure.pawnLineDefense ||
    structure.releasedHorseFromPressure ||
    structure.releasedElephantFromPressure ||
    pawnSoldierDevelopment ||
    pawnSoldierFollowUp.score > 0 ||
    blocksImmediateWin ||
    effectiveCheck ||
    rescuesLooseHiddenPiece ||
    forcingReply
  );
  const meaningless = !purposeful && !checking;
  const highValueMover = defensiveTargetValue(move.piece, state.board, move.from, weights) >= weights.pieceValues.horse;
  const hangingMove = highValueMover && !protectedMove && !hasClearGain;
  const deadMajorShouldCaptureNow = controlledDeadMajor && revealedMajorCaptureAvailable;
  const deadMajorHoldSuppressedBySafeCapture = deadMajorShouldCaptureNow && !safeRevealedMajorCapture;
  const deadMajorThreatHold = controlledDeadMajor && !capturedControlledRook && !hangingMove && !deadMajorHoldSuppressedBySafeCapture;
  const deadMajorPressureScore = deadMajorThreatHold ? weights.deadMajorThreatHoldBonus : 0;
  const forcedBadDefensePenalty = forcedBadDefense ? weights.defendDoomedMajorPenalty : 0;
  const purposePenalty = meaningless ? weights.meaninglessMovePenalty : 0;
  const checkPenalty = lowQualityCheck ? weights.lowQualityCheckPenalty : 0;
  const checkBonus = effectiveCheck ? weights.effectiveCheckBonus : 0;
  const threatBonus = importantThreat ? Math.round(Math.min(threatValue, weights.pieceValues.rook) * weights.importantThreatRatio) : 0;
  const blockDangerBonus = blocksImmediateWin ? weights.blockImmediateWinBonus : 0;
  const protectionScore = protectedMove ? weights.protectedMoveBonus : 0;
  const hangingPenalty = hangingMove ? weights.hangingMovePenalty : 0;

  const endgamePlan = computeEndgamePlan(
    state, move, nextBoard, checking, importantThreat, captureGain,
    blocksImmediateWin, rescuesLooseHiddenPiece, weights
  );

  const score =
    captureGain -
    reply.possibleLoss +
    revealScore(move, weights) +
    openingBonus +
    positionScore(move) +
    threatBonus +
    escapeBonus +
    pressureBonus +
    keySquareScore +
    finalHiddenPressureScore +
    leaveKeySquareScore +
    finalStructureScore +
    openingTempoPenalty +
    finalMajorActivationScore +
    opponentRevealSuppressionScore +
    pawnSoldierDevelopmentScore +
    pawnSoldierThreatRevealedMajorScore +
    revealedMajorCaptureScore +
    pawnSoldierDelayPenalty +
    pawnSoldierWalksIntoPawnAttackPenalty +
    pawnSoldierDevelopmentSuppressedByPawnAttackPenalty +
    pawnSoldierFollowUp.score +
    revealChoicePenalty +
    blockDangerBonus +
    checkBonus +
    protectionScore +
    hangingPenalty +
    purposePenalty +
    checkPenalty +
    safeCapturePriorityBonus +
    speculativeAttackPenalty +
    repetitiveCheckPenaltyScore +
    repeatedCheckingCyclePenaltyScore +
    advisorRevealClogPenalty +
    deadMajorPressureScore +
    postMoveLoosePiecePenalty +
    rescueLooseHiddenPieceScore +
    protectedUnderAttackPenalty +
    activationOnlyCapPenalty +
    firstMoveBlindHorsePenalty +
    firstMoveBlindMajorActivationCapPenalty +
    pureBlindHorsePenalty +
    forcedBadDefensePenalty +
    unsafeCapturePenalty +
    horsePawnLineGuardEdgeRookBonus +
    pawnSoldierDelayedByEdgeRookPressurePenalty +
    endgamePlan.endgamePlanScore -
    Math.round(reply.maxReplyGain * weights.maxReplyGainPenaltyRatio);

  return {
    score,
    risk: reply.risk,
    immediateCapture: reply.immediateCapture,
    exchangeNet,
    captureGain,
    openingBonus,
    threatValue,
    escapeBonus,
    pressureBonus,
    targetGain,
    protectedMove,
    hangingMove,
    capturedConnectedAdvisor,
    capturedCrossedPawn,
    keySquareScore,
    leaveKeySquareScore,
    hiddenPressureScore,
    controlsImportantHidden,
    structureScore: finalStructureScore,
    structurePatterns: structure.patterns,
    releasedHorseFromPressure: structure.releasedHorseFromPressure,
    releasedElephantFromPressure: structure.releasedElephantFromPressure,
    weakScreen: structure.weakScreen,
    preservesHiddenCannon: structure.preservesHiddenCannon,
    pawnLineDefense: structure.pawnLineDefense,
    preventsPawnLineLock: structure.preventsPawnLineLock,
    badHorseRelease: structure.badHorseRelease,
    openingTempoPenalty,
    forcingReply,
    blocksImmediateWin,
    checking,
    effectiveCheck,
    lowQualityCheck,
    meaningless,
    moveRevealsUnknown,
    revealTacticalSuppressed,
    threatDelta,
    threatByMovedPiece,
    threatTargetType: afterThreat?.targetType ?? null,
    threatTargetRevealed: afterThreat?.targetRevealed ?? null,
    edgeCannonPressureUnresolved,
    speculativeAttack,
    safeCapturePriority,
    repetitiveCheck,
    repetitiveCheckPenaltyScore,
    revealChoiceRisk,
    revealChoicePenalty,
    openingMajorGoal,
    majorActivation,
    opponentRevealSuppression,
    advisorRevealClogRisk,
    advisorRevealClogPenalty,
    controlledDeadMajor,
    deadMajorThreatHold,
    deadMajorPressureScore,
    defendsDoomedMajor,
    forcedBadDefense,
    postMoveLooseHiddenPiece,
    postMoveLooseHiddenPieceCount,
    postMoveProtectedUnderAttackCount,
    postMoveLoosePiecePenalty,
    rescuesLooseHiddenPiece,
    ignoresLooseHiddenPiece,
    firstMovePawnOpening,
    firstMoveBlindHorseActivation,
    firstMoveBlindHorsePenalty: firstMoveBlindHorsePenalty + firstMoveBlindMajorActivationCapPenalty,
    hasUnrevealedPawnSoldiers,
    pawnSoldierDevelopment,
    pawnSoldierThreatRevealedMajor,
    pureBlindHorseActivation,
    pureBlindHorsePenalty,
    blindHorseStructureCapped,
    blindHorseMajorActivationCapped,
    pawnSoldierFollowUpHorse: pawnSoldierFollowUp.pawnSoldierFollowUpHorse,
    pawnSoldierHorseFootBlock: pawnSoldierFollowUp.pawnSoldierHorseFootBlock,
    pawnSoldierFollowUpElephant: pawnSoldierFollowUp.pawnSoldierFollowUpElephant,
    pawnSoldierCenterPreference: pawnSoldierFollowUp.pawnSoldierCenterPreference,
    pawnSoldierFollowUpAdvisor: pawnSoldierFollowUp.pawnSoldierFollowUpAdvisor,
    pawnSoldierAntiAdvisorFork: pawnSoldierFollowUp.pawnSoldierAntiAdvisorFork,
    revealedMajorCaptureAvailable,
    safeRevealedMajorCapture,
    revealedMajorCaptureScore,
    pawnSoldierDelayedByMajorCapture,
    deadMajorShouldCaptureNow,
    deadMajorHoldSuppressedBySafeCapture,
    pawnSoldierWalksIntoRevealedPawnAttack,
    pawnSoldierSelfSacrifice,
    pawnSoldierProtectedAfterAdvance,
    pawnSoldierDevelopmentSuppressedByPawnAttack,
    repeatedCheckingCycle,
    repeatedCheckingCyclePenaltyScore,
    repeatedPositionRisk,
    repetitiveCheckSuppressed: false,
    repetitionCount: 0,
    endgamePlanActive: endgamePlan.endgamePlanActive,
    towardEnemyKing: endgamePlan.towardEnemyKing,
    restrictKingMobility: endgamePlan.restrictKingMobility,
    attackPalaceGuard: endgamePlan.attackPalaceGuard,
    improveMajorActivity: endgamePlan.improveMajorActivity,
    passedPawnAdvance: endgamePlan.passedPawnAdvance,
    createNonCheckingThreat: endgamePlan.createNonCheckingThreat,
    avoidAimlessMove: endgamePlan.avoidAimlessMove,
    endgamePlanScore: endgamePlan.endgamePlanScore,
    hiddenMajorRecaptureRisk,
    unsafeEndgameCapture,
    unsafeCaptureExchangeNet,
    edgeRookPawnLineLockRisk: structure.horsePawnLineGuard ? true : edgeRookPressure,
    horsePawnLineGuard: structure.horsePawnLineGuard,
    pawnSoldierDelayedByEdgeRookPressure,
  };
}

function reasonFor(best: Move, evaluation: MoveEvaluation, avoidedOpponentWin: boolean, weights: AiWeights): string {
  if (avoidedOpponentWin) return '避免對方一步殺';
  if (evaluation.rescuesLooseHiddenPiece) return '暗子無保護受攻擊，優先脫離';
  if (evaluation.postMoveLooseHiddenPiece && evaluation.postMoveLoosePiecePenalty < 0) return '下完仍有無保護暗子被抓，已扣分';
  if (evaluation.firstMoveBlindHorseActivation) return '第一手盲動暗馬，已降分';
  if (evaluation.pureBlindHorseActivation) return '暗兵卒尚未開發，純暗馬活化已降分';
  if (evaluation.forcedBadDefense) return '暗士硬保死車，易卡陣，已扣分';
  if (evaluation.hangingMove) return '落點缺少保護，已扣分';
  if (evaluation.advisorRevealClogRisk && evaluation.advisorRevealClogPenalty < 0) return '暗士翻子易卡住將門，已扣分';
  if (evaluation.revealChoiceRisk) return '吃低價暗子後給對方選擇權，已降分';
  if (best.captured && evaluation.exchangeNet < 0) return '交換可能虧損，已扣分';
  if (evaluation.capturedConnectedAdvisor) return '吃掉連環士';
  if (evaluation.capturedCrossedPawn) return '吃過河兵';
  if (evaluation.openingTempoPenalty < 0 && best.captured) return '吃子但未取得後續主動，已降分';
  if (evaluation.openingTempoPenalty < 0) return '暗炮過早出擊，先手權不足，已扣分';
  if (best.captured && evaluation.targetGain >= weights.pieceValues.cannon) return '吃高價目標';
  if (best.captured && evaluation.exchangeNet >= weights.safeCaptureExchangeNet) return '安全吃子';
  if (best.captured && evaluation.exchangeNet >= 0) return '交換不虧';
  if (evaluation.pawnSoldierHorseFootBlock) return '同路暗兵卒卡馬腳';
  if (evaluation.pawnSoldierFollowUpHorse) return '暗兵卒接續壓制明馬';
  if (evaluation.pawnSoldierCenterPreference) return '暗兵卒翻相，優先活中路';
  if (evaluation.pawnSoldierFollowUpElephant) return '暗兵卒翻相，優先活中路';
  if (evaluation.pawnSoldierAntiAdvisorFork) return '同路暗兵卒對翻，避免士抓蛇雙';
  if (evaluation.pawnSoldierFollowUpAdvisor) return '同路暗兵卒對翻，避免士抓蛇雙';
  if (evaluation.pawnSoldierThreatRevealedMajor) return '暗兵卒壓制對方明子';
  if (evaluation.safeRevealedMajorCapture) return '安全吃明大子，優先執行';
  if (evaluation.deadMajorHoldSuppressedBySafeCapture) return '有安全吃明大子機會，不應保留死車威脅';
  if (evaluation.pawnSoldierDelayedByMajorCapture) return '有明大子可吃，延後開發暗兵卒';
  if (evaluation.pawnSoldierWalksIntoRevealedPawnAttack) return '暗兵卒走入已翻兵卒攻擊，已降分';
  if (evaluation.pawnSoldierSelfSacrifice) return '暗兵卒白送，開發延後';
  if (evaluation.firstMovePawnOpening) return '第一手穩健翹邊兵';
  if (evaluation.pawnSoldierDevelopment) return '開局優先開發暗兵卒';
  if (evaluation.revealTacticalSuppressed && !evaluation.effectiveCheck && !evaluation.releasedHorseFromPressure && !evaluation.releasedElephantFromPressure && !evaluation.preventsPawnLineLock) return '暗子翻開效果未知，未按確定將軍加分';
  if (evaluation.repeatedCheckingCycle) return '重複循環將軍，改尋求起角';
  if (evaluation.repetitiveCheck) return '無成果連將，避免重複';
  if (evaluation.effectiveCheck) return '有效將軍';
  if (evaluation.lowQualityCheck) return '無成果將軍，已降分';
  if (evaluation.horsePawnLineGuard) return '邊路明車壓兵線，優先活馬守線';
  if (evaluation.pawnSoldierDelayedByEdgeRookPressure) return '邊 G 壓力下，延後普通暗兵卒開發';
  if (evaluation.releasedHorseFromPressure) return '活馬解除邊炮壓制';
  if (evaluation.releasedElephantFromPressure) return '活象解除邊炮壓制';
  if (evaluation.weakScreen) return '只是塞炮線但仍被卡馬腳，已扣分';
  if (evaluation.badHorseRelease) return '活馬落點不符當前威脅，已扣分';
  if (evaluation.preventsPawnLineLock) return '守住兵線，避免敵方 G 壓兵線';
  if (evaluation.forcingReply) return '形成強制應手';
  if (evaluation.pawnLineDefense && evaluation.structurePatterns.includes('hidden_rook_guard_point')) return '活馬並保護暗車控制點';
  if (evaluation.pawnLineDefense) return '守住兵線關鍵點';
  if (evaluation.deadMajorThreatHold) return '保留死車威脅，持續壓制';
  if (evaluation.preservesHiddenCannon) return '保留暗炮威懾';
  if (evaluation.leaveKeySquareScore < 0) return '離開關鍵點，價值下降';
  if (evaluation.meaningless) return '目的性不足，已扣分';
  const typeLabel: Record<PieceType, string> = { king: '帥/將', advisor: '仕/士', elephant: '相/象', rook: '車', horse: '馬', cannon: '炮/包', pawn: '兵/卒' };
  const newThreat = evaluation.threatValue >= weights.pieceValues.horse && (evaluation.threatDelta > 0 || evaluation.threatByMovedPiece);
  if (newThreat && evaluation.threatByMovedPiece && evaluation.threatTargetType) return `此步直接威脅對方${typeLabel[evaluation.threatTargetType]}`;
  if (newThreat && evaluation.threatDelta > 0) return '形成新的高價威脅';
  if (evaluation.escapeBonus > 0) return '脫離重要子力危險';
  if (evaluation.pressureBonus > 0) return '形成攻擊壓力';
  if (evaluation.controlsImportantHidden && !evaluation.edgeCannonPressureUnresolved) return '壓制對方重要暗子';
  if (evaluation.hiddenPressureScore > 0 && !evaluation.edgeCannonPressureUnresolved) return '壓制對方暗子';
  if (evaluation.keySquareScore >= weights.keySquareEnemyPalaceBonus) return '佔住關鍵點';
  if (evaluation.protectedMove) return '落點有保護';
  if (evaluation.openingMajorGoal && evaluation.opponentRevealSuppression) return '活出大子並壓制對方翻子';
  if (evaluation.openingMajorGoal) return '開局優先活出大子';
  if (evaluation.openingBonus > 0) return '開局優先翹 1379 路兵';
  if (evaluation.risk > 0 || evaluation.immediateCapture) return '避免明顯送子';
  if (evaluation.avoidAimlessMove) return '無明確目標，已降分';
  if (evaluation.towardEnemyKing) return '中殘局靠近敵將';
  if (evaluation.restrictKingMobility) return '限制將帥活動';
  if (evaluation.attackPalaceGuard) return '攻擊九宮防線';
  if (evaluation.createNonCheckingThreat) return '形成非將軍威脅';
  if (evaluation.improveMajorActivity) return '改善大子位置';
  if (evaluation.passedPawnAdvance) return '過河兵卒推進';
  if (evaluation.unsafeEndgameCapture) return '吃子後遭暗大子回吃，交換不利';
  return '簡單評分最佳';
}
export function recommendMove(
  state: GameState,
  candidateMoves?: Move[],
  weights: AiWeights = defaultAiWeights
): AiRecommendation {
  const moves = candidateMoves ?? getAllLegalMoves(state.board, state.turn);
  if (!moves.length) return { move: null, score: -99999, reason: '沒有合法走法' };

  for (const move of moves) {
    const next = applyMove(state, move.from, move.to);
    if (next.status === winningStatus(state.turn)) {
      return { move, score: 999999, reason: '此步直接形成絕殺' };
    }
  }

  const safeMoves = moves.filter(move => !allowsOpponentWin(state, move));
  const scoringMoves = safeMoves.length ? safeMoves : moves;
  const avoidedOpponentWin = safeMoves.length > 0 && safeMoves.length < moves.length;
  const currentlyAllowsOpponentWin = opponentHasImmediateWin(state.board, state.turn);

  const posRevealedMajorCaptureAvailable = scoringMoves.some(m => {
    if (!m.captured || !m.captured.revealed) return false;
    const capType = publicType(m.captured);
    if (capType !== 'rook' && capType !== 'cannon') return false;
    const capValue = weights.pieceValues[capType as 'rook' | 'cannon'];
    const moverValue = weights.pieceValues[publicType(m.piece) as 'rook' | 'cannon' | 'horse' | 'elephant' | 'advisor' | 'pawn' | 'king'];
    return capValue >= moverValue;
  });
  let best = scoringMoves[0];
  let bestEvaluation = evaluateMove(state, best, currentlyAllowsOpponentWin && !allowsOpponentWin(state, best), weights, posRevealedMajorCaptureAvailable);
  const evaluations: { move: Move; evaluation: ReturnType<typeof evaluateMove> }[] = [
    { move: best, evaluation: bestEvaluation },
  ];

  for (const move of scoringMoves.slice(1)) {
    const evaluation = evaluateMove(state, move, currentlyAllowsOpponentWin && !allowsOpponentWin(state, move), weights, posRevealedMajorCaptureAvailable);
    evaluations.push({ move, evaluation });
    if (evaluation.score > bestEvaluation.score) {
      best = move;
      bestEvaluation = evaluation;
    }
  }

  // Need B: If best is fruitless repetitive checking but alternatives exist, override
  const suppressedRepetitiveMoves = new Set<Move>();
  if (bestEvaluation.repetitiveCheck || bestEvaluation.repeatedCheckingCycle) {
    const isMaterialWin = bestEvaluation.captureGain >= weights.pieceValues.cannon &&
      bestEvaluation.exchangeNet >= 0;
    if (!isMaterialWin) {
      const nonRepetitive = evaluations.filter(({ evaluation: e }) =>
        !e.repetitiveCheck && !e.repeatedCheckingCycle
      );
      if (nonRepetitive.length > 0) {
        const altBest = nonRepetitive.reduce((a, b) =>
          b.evaluation.score > a.evaluation.score ? b : a
        );
        suppressedRepetitiveMoves.add(best);
        best = altBest.move;
        bestEvaluation = altBest.evaluation;
      }
    }
  }

  const traces: AiMoveTrace[] = evaluations.map(({ move, evaluation }) => ({
    move,
    score: evaluation.score,
    reason: reasonFor(move, evaluation, avoidedOpponentWin, weights),
    patterns: evaluation.structurePatterns,
    structureScore: evaluation.structureScore,
    exchangeNet: evaluation.exchangeNet,
    risk: evaluation.risk,
    captureGain: evaluation.captureGain,
    openingBonus: evaluation.openingBonus,
    keySquareScore: evaluation.keySquareScore,
    hiddenPressureScore: evaluation.hiddenPressureScore,
    leaveKeySquareScore: evaluation.leaveKeySquareScore,
    checking: evaluation.checking,
    effectiveCheck: evaluation.effectiveCheck,
    lowQualityCheck: evaluation.lowQualityCheck,
    meaningless: evaluation.meaningless,
    moveRevealsUnknown: evaluation.moveRevealsUnknown,
    revealTacticalSuppressed: evaluation.revealTacticalSuppressed,
    threatValue: evaluation.threatValue,
    threatDelta: evaluation.threatDelta,
    threatByMovedPiece: evaluation.threatByMovedPiece,
    threatTargetType: evaluation.threatTargetType,
    threatTargetRevealed: evaluation.threatTargetRevealed,
    edgeCannonPressureUnresolved: evaluation.edgeCannonPressureUnresolved,
    speculativeAttack: evaluation.speculativeAttack,
    safeCapturePriority: evaluation.safeCapturePriority,
    repetitiveCheck: evaluation.repetitiveCheck,
    repetitiveCheckPenalty: evaluation.repetitiveCheckPenaltyScore,
    revealChoiceRisk: evaluation.revealChoiceRisk,
    revealChoicePenalty: evaluation.revealChoicePenalty,
    openingMajorGoal: evaluation.openingMajorGoal,
    majorActivation: evaluation.majorActivation,
    opponentRevealSuppression: evaluation.opponentRevealSuppression,
    advisorRevealClogRisk: evaluation.advisorRevealClogRisk,
    advisorRevealClogPenalty: evaluation.advisorRevealClogPenalty,
    controlledDeadMajor: evaluation.controlledDeadMajor,
    deadMajorThreatHold: evaluation.deadMajorThreatHold,
    deadMajorPressureScore: evaluation.deadMajorPressureScore,
    defendsDoomedMajor: evaluation.defendsDoomedMajor,
    forcedBadDefense: evaluation.forcedBadDefense,
    postMoveLooseHiddenPiece: evaluation.postMoveLooseHiddenPiece,
    postMoveLooseHiddenPieceCount: evaluation.postMoveLooseHiddenPieceCount,
    postMoveProtectedUnderAttackCount: evaluation.postMoveProtectedUnderAttackCount,
    postMoveLoosePiecePenalty: evaluation.postMoveLoosePiecePenalty,
    rescuesLooseHiddenPiece: evaluation.rescuesLooseHiddenPiece,
    ignoresLooseHiddenPiece: evaluation.ignoresLooseHiddenPiece,
    firstMovePawnOpening: evaluation.firstMovePawnOpening,
    firstMoveBlindHorseActivation: evaluation.firstMoveBlindHorseActivation,
    firstMoveBlindHorsePenalty: evaluation.firstMoveBlindHorsePenalty,
    hasUnrevealedPawnSoldiers: evaluation.hasUnrevealedPawnSoldiers,
    pawnSoldierDevelopment: evaluation.pawnSoldierDevelopment,
    pawnSoldierThreatRevealedMajor: evaluation.pawnSoldierThreatRevealedMajor,
    pureBlindHorseActivation: evaluation.pureBlindHorseActivation,
    pureBlindHorsePenalty: evaluation.pureBlindHorsePenalty,
    blindHorseStructureCapped: evaluation.blindHorseStructureCapped,
    blindHorseMajorActivationCapped: evaluation.blindHorseMajorActivationCapped,
    pawnSoldierFollowUpHorse: evaluation.pawnSoldierFollowUpHorse,
    pawnSoldierHorseFootBlock: evaluation.pawnSoldierHorseFootBlock,
    pawnSoldierFollowUpElephant: evaluation.pawnSoldierFollowUpElephant,
    pawnSoldierCenterPreference: evaluation.pawnSoldierCenterPreference,
    pawnSoldierFollowUpAdvisor: evaluation.pawnSoldierFollowUpAdvisor,
    pawnSoldierAntiAdvisorFork: evaluation.pawnSoldierAntiAdvisorFork,
    revealedMajorCaptureAvailable: evaluation.revealedMajorCaptureAvailable,
    safeRevealedMajorCapture: evaluation.safeRevealedMajorCapture,
    revealedMajorCaptureScore: evaluation.revealedMajorCaptureScore,
    pawnSoldierDelayedByMajorCapture: evaluation.pawnSoldierDelayedByMajorCapture,
    deadMajorShouldCaptureNow: evaluation.deadMajorShouldCaptureNow,
    deadMajorHoldSuppressedBySafeCapture: evaluation.deadMajorHoldSuppressedBySafeCapture,
    pawnSoldierWalksIntoRevealedPawnAttack: evaluation.pawnSoldierWalksIntoRevealedPawnAttack,
    pawnSoldierSelfSacrifice: evaluation.pawnSoldierSelfSacrifice,
    pawnSoldierProtectedAfterAdvance: evaluation.pawnSoldierProtectedAfterAdvance,
    pawnSoldierDevelopmentSuppressedByPawnAttack: evaluation.pawnSoldierDevelopmentSuppressedByPawnAttack,
    repeatedCheckingCycle: evaluation.repeatedCheckingCycle,
    repeatedPositionRisk: evaluation.repeatedPositionRisk,
    repetitiveCheckSuppressed: suppressedRepetitiveMoves.has(move),
    repetitionCount: evaluation.repetitionCount,
    endgamePlanActive: evaluation.endgamePlanActive,
    towardEnemyKing: evaluation.towardEnemyKing,
    restrictKingMobility: evaluation.restrictKingMobility,
    attackPalaceGuard: evaluation.attackPalaceGuard,
    improveMajorActivity: evaluation.improveMajorActivity,
    passedPawnAdvance: evaluation.passedPawnAdvance,
    createNonCheckingThreat: evaluation.createNonCheckingThreat,
    avoidAimlessMove: evaluation.avoidAimlessMove,
    endgamePlanScore: evaluation.endgamePlanScore,
    hiddenMajorRecaptureRisk: evaluation.hiddenMajorRecaptureRisk,
    unsafeEndgameCapture: evaluation.unsafeEndgameCapture,
    unsafeCaptureExchangeNet: evaluation.unsafeCaptureExchangeNet,
    edgeRookPawnLineLockRisk: evaluation.edgeRookPawnLineLockRisk,
    horsePawnLineGuard: evaluation.horsePawnLineGuard,
    pawnSoldierDelayedByEdgeRookPressure: evaluation.pawnSoldierDelayedByEdgeRookPressure,
  }));

  return {
    move: best,
    score: bestEvaluation.score,
    reason: reasonFor(best, bestEvaluation, avoidedOpponentWin, weights),
    traces,
  };
}

/**
 * Oracle AI: full info, for debug / analysis / assisted board.
 */
export function recommendMoveOracle(
  state: GameState,
  candidateMoves?: Move[],
  weights: AiWeights = defaultAiWeights
): AiRecommendation {
  return recommendMove(state, candidateMoves, weights);
}

/**
 * Fair AI: official game entry. Hides unrevealed realType via AiVisibleState.
 * MVP ignores external candidateMoves to avoid leaking full realType via Move objects.
 */
export function recommendMoveFair(
  stateOrView: GameState | AiVisibleState,
  _candidateMoves?: Move[],
  weights: AiWeights = defaultAiWeights
): AiRecommendation {
  const view =
    'perspectiveSide' in stateOrView
      ? stateOrView
      : createAiView(stateOrView, stateOrView.turn);
  const maskedState = visibleStateToMaskedGameState(view);
  // MVP: ignore candidateMoves, let recommendMove generate from maskedState
  return recommendMove(maskedState, undefined, weights);
}

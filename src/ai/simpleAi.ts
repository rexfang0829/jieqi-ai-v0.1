import type { Board, GameState, Move, Piece, PieceType, Position, Side } from '../types/chess';
import { getAllLegalMoves, isInCheck } from '../game/checkRules';
import { applyMove } from '../game/gameEngine';
import { createInitialBoard } from '../game/initialBoard';
import { defaultAiWeights, type AiWeights } from './aiWeights';
import type { AiLearningPatternId } from './learningPatterns';

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
  blocksImmediateWin: boolean;
  checking: boolean;
  effectiveCheck: boolean;
  lowQualityCheck: boolean;
  meaningless: boolean;
};

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

function openingPawnRevealBonus(state: GameState, move: Move, weights: AiWeights): number {
  if (state.history.length > 8) return 0;
  if (move.piece.side !== state.turn) return 0;
  if (move.piece.originalType !== 'pawn') return 0;
  if (move.piece.revealed) return 0;
  if (!isOpeningPawnStart(state.turn, move.from)) return 0;

  let bonus = weights.openingPawnBonus;
  if (move.from.col === 0 || move.from.col === 8) bonus += weights.edgePawnBonus;
  else if (move.from.col === 2 || move.from.col === 6) bonus += weights.thirdSeventhPawnBonus;
  return bonus;
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
    };
  }

  const beforeCannonThreat = cannonLineThreatAgainstSide(state.board, state.turn, weights);
  const afterCannonThreat = cannonLineThreatAgainstSide(nextBoard, state.turn, weights);
  const beforePawnLineRisk = enemyRookOnPawnLineRisk(state.board, state.turn);
  const afterPawnLineRisk = enemyRookOnPawnLineRisk(nextBoard, state.turn);
  const releasedHorse = isReleasedHorseMove(move);
  const releasedElephant = isReleasedElephantMove(move);
  const pawnLineDefense = guardsPawnLineKeyPoint(state.turn, move.to);
  const preventsPawnLineLock = beforePawnLineRisk > 0 && afterPawnLineRisk <= beforePawnLineRisk && pawnLineDefense;
  const badHorseRelease = releasedHorse && isBadHorseReleaseSquare(state.turn, move.to) && !pawnLineDefense;
  const preservesHiddenCannon = !isHiddenCannon(move.piece) && state.board.some(row => row.some(piece => piece?.side === state.turn && isHiddenCannon(piece)));
  const weakScreen = isHiddenCannon(move.piece) && beforeCannonThreat > 0 && afterCannonThreat >= beforeCannonThreat && !hasClearGain;
  const patterns = new Set<AiLearningPatternId>();
  let score = 0;

  if (beforeCannonThreat > 0) patterns.add('opening_cannon_hits_hidden_rook');
  if (beforePawnLineRisk > 0) patterns.add('opening_edge_rook_pawn_line_lock');

  if (releasedHorse) {
    patterns.add('opening_hidden_pawn_blocks_horse_foot');
    score += weights.openingHiddenPawnAssumptionBonus + weights.pawnFootBlockThreatBonus;
    if (beforeCannonThreat > 0) score += weights.structureReleaseHorseBonus;
    if (isGoodHorseGuardSquare(state.turn, move.to)) {
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
    if (beforeCannonThreat > 0) {
      patterns.add('elephant_release_from_cannon_pressure');
      score += weights.structureReleaseElephantBonus;
    }
  }

  if (pawnLineDefense) score += weights.pawnLineDefenseBonus;
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
    releasedHorseFromPressure: releasedHorse && beforeCannonThreat > 0,
    releasedElephantFromPressure: releasedElephant && beforeCannonThreat > 0,
    weakScreen,
    preservesHiddenCannon: preservesHiddenCannon && !hasClearGain,
    pawnLineDefense,
    preventsPawnLineLock,
    badHorseRelease,
  };
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

function allowsOpponentWin(state: GameState, move: Move): boolean {
  const next = applyMove(state, move.from, move.to);
  if (next === state || next.status !== 'playing') return false;
  const opponentMoves = getAllLegalMoves(next.board, next.turn);
  return opponentMoves.some(reply =>
    applyMove(next, reply.from, reply.to).status === winningStatus(next.turn)
  );
}

function evaluateMove(state: GameState, move: Move, blocksImmediateWin: boolean, weights: AiWeights): MoveEvaluation {
  const next = applyMove(state, move.from, move.to);
  const nextBoard = next === state ? applyMoveToBoard(state.board, move) : next.board;
  const moved = nextBoard[move.to.row][move.to.col]!;
  const reply = opponentReplyPenalty(nextBoard, state.turn, move.to, moved, weights);
  const targetGain = captureScore(state.board, move, weights);
  const captureGain = targetGain;
  const openingBonus = openingPawnRevealBonus(state, move, weights);
  const threatValue = maxCaptureValue(nextBoard, state.turn, weights);
  const importantThreat = threatValue >= weights.pieceValues.horse;
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
  const checking = next !== state && next.status === 'playing' && isInCheck(next.board, next.turn);
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
  const purposeful = (
    captureGain > 0 ||
    openingBonus > 0 ||
    importantThreat ||
    escapeBonus > 0 ||
    pressureBonus > 0 ||
    keySquareScore >= weights.keySquareEnemyPalaceBonus ||
    hiddenPressureScore >= weights.hiddenPiecePressureBonus + weights.importantHiddenPiecePressureBonus ||
    structure.score > 0 ||
    structure.pawnLineDefense ||
    structure.releasedHorseFromPressure ||
    structure.releasedElephantFromPressure ||
    blocksImmediateWin ||
    effectiveCheck
  );
  const meaningless = !purposeful && !checking;
  const highValueMover = defensiveTargetValue(move.piece, state.board, move.from, weights) >= weights.pieceValues.horse;
  const hangingMove = highValueMover && !protectedMove && !hasClearGain;
  const purposePenalty = meaningless ? weights.meaninglessMovePenalty : 0;
  const checkPenalty = lowQualityCheck ? weights.lowQualityCheckPenalty : 0;
  const checkBonus = effectiveCheck ? weights.effectiveCheckBonus : 0;
  const threatBonus = importantThreat ? Math.round(Math.min(threatValue, weights.pieceValues.rook) * weights.importantThreatRatio) : 0;
  const blockDangerBonus = blocksImmediateWin ? weights.blockImmediateWinBonus : 0;
  const protectionScore = protectedMove ? weights.protectedMoveBonus : 0;
  const hangingPenalty = hangingMove ? weights.hangingMovePenalty : 0;

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
    hiddenPressureScore +
    leaveKeySquareScore +
    structure.score +
    blockDangerBonus +
    checkBonus +
    protectionScore +
    hangingPenalty +
    purposePenalty +
    checkPenalty -
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
    structureScore: structure.score,
    structurePatterns: structure.patterns,
    releasedHorseFromPressure: structure.releasedHorseFromPressure,
    releasedElephantFromPressure: structure.releasedElephantFromPressure,
    weakScreen: structure.weakScreen,
    preservesHiddenCannon: structure.preservesHiddenCannon,
    pawnLineDefense: structure.pawnLineDefense,
    preventsPawnLineLock: structure.preventsPawnLineLock,
    badHorseRelease: structure.badHorseRelease,
    blocksImmediateWin,
    checking,
    effectiveCheck,
    lowQualityCheck,
    meaningless,
  };
}

function reasonFor(best: Move, evaluation: MoveEvaluation, avoidedOpponentWin: boolean, weights: AiWeights): string {
  if (avoidedOpponentWin) return '避免送對方一步殺';
  if (evaluation.hangingMove) return '高價子落點無保護，已扣分';
  if (best.captured && evaluation.exchangeNet < 0) return '交換可能虧損，已扣分';
  if (evaluation.capturedConnectedAdvisor) return '吃連得起來的士';
  if (evaluation.capturedCrossedPawn) return '吃過河兵卒';
  if (best.captured && evaluation.targetGain >= weights.pieceValues.cannon) return '吃高價目標';
  if (best.captured && evaluation.exchangeNet >= weights.safeCaptureExchangeNet) return '安全吃子';
  if (best.captured && evaluation.exchangeNet >= 0) return '交換不虧';
  if (evaluation.effectiveCheck) return '有效將軍';
  if (evaluation.lowQualityCheck) return '無成果將軍，已降分';
  if (evaluation.releasedHorseFromPressure) return '活化馬，解除炮線壓制';
  if (evaluation.releasedElephantFromPressure) return '活化象，解除象眼壓制';
  if (evaluation.weakScreen) return '只是塞炮線但仍被卡馬腳，已扣分';
  if (evaluation.preventsPawnLineLock) return '避免敵方 G 壓住兵線';
  if (evaluation.pawnLineDefense && evaluation.structurePatterns.includes('hidden_rook_guard_point')) return '活馬並保護暗車控制點';
  if (evaluation.pawnLineDefense) return '守住兵線關鍵點';
  if (evaluation.badHorseRelease) return '活馬落點不佳，未守住兵線，已扣分';
  if (evaluation.preservesHiddenCannon) return '保留暗炮威懾';
  if (evaluation.leaveKeySquareScore < 0) return '離開要點且收益不足，已扣分';
  if (evaluation.meaningless) return '此步缺乏明確目的，已扣分';
  if (evaluation.threatValue >= weights.pieceValues.horse) return '威脅對方重要棋子';
  if (evaluation.escapeBonus > 0) return '讓重要棋子脫離危險';
  if (evaluation.pressureBonus > 0) return '增加將區壓力';
  if (evaluation.controlsImportantHidden) return '控制對方重要暗子位置';
  if (evaluation.hiddenPressureScore > 0) return '壓制對方暗子';
  if (evaluation.keySquareScore >= weights.keySquareEnemyPalaceBonus) return '佔據揭棋要點';
  if (evaluation.protectedMove) return '落點有保護';
  if (evaluation.openingBonus > 0) return '開局翻兵';
  if (evaluation.risk > 0 || evaluation.immediateCapture) return '此步有被吃風險，已扣分';
  return '簡易分數較佳';
}

export function recommendMove(
  state: GameState,
  candidateMoves?: Move[],
  weights: AiWeights = defaultAiWeights
): { move: Move | null; score: number; reason: string } {
  const moves = candidateMoves ?? getAllLegalMoves(state.board, state.turn);
  if (!moves.length) return { move: null, score: -99999, reason: '沒有合法步' };

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

  let best = scoringMoves[0];
  let bestEvaluation = evaluateMove(state, best, currentlyAllowsOpponentWin && !allowsOpponentWin(state, best), weights);

  for (const move of scoringMoves) {
    const evaluation = evaluateMove(state, move, currentlyAllowsOpponentWin && !allowsOpponentWin(state, move), weights);
    if (evaluation.score > bestEvaluation.score) {
      best = move;
      bestEvaluation = evaluation;
    }
  }

  return {
    move: best,
    score: bestEvaluation.score,
    reason: reasonFor(best, bestEvaluation, avoidedOpponentWin, weights),
  };
}

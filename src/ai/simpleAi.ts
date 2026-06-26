import type { Board, GameState, Move, Piece, PieceType, Position, Side } from '../types/chess';
import { getAllLegalMoves, isInCheck } from '../game/checkRules';
import { applyMove } from '../game/gameEngine';
import { createInitialBoard } from '../game/initialBoard';
import { defaultAiWeights, type AiWeights } from './aiWeights';

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
    const tradeNet = movedPieceValue(movedPiece, weights) - recaptureValue;
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
  const purposeful = (
    captureGain > 0 ||
    openingBonus > 0 ||
    importantThreat ||
    escapeBonus > 0 ||
    pressureBonus > 0 ||
    keySquareScore >= weights.keySquareEnemyPalaceBonus ||
    hiddenPressureScore >= weights.hiddenPiecePressureBonus + weights.importantHiddenPiecePressureBonus ||
    blocksImmediateWin ||
    effectiveCheck
  );
  const meaningless = !purposeful && !checking;
  const highValueMover = movedPieceValue(move.piece, weights) >= weights.pieceValues.horse;
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

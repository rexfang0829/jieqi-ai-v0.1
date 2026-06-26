import type { Board, GameState, Move, Piece, PieceType, Position, Side } from '../types/chess';
import { getAllLegalMoves, isInCheck } from '../game/checkRules';
import { applyMove } from '../game/gameEngine';
import { createInitialBoard } from '../game/initialBoard';

const value: Record<PieceType, number> = {
  king: 10000,
  rook: 500,
  cannon: 350,
  horse: 300,
  elephant: 150,
  advisor: 150,
  pawn: 80,
};

const meaninglessMovePenalty = -80;
const lowQualityCheckPenalty = -60;
const protectedMoveBonus = 20;
const hangingMovePenalty = -50;

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

function pieceValue(piece: Piece): number {
  return value[publicType(piece)];
}

function movedPieceValue(piece: Piece): number {
  return value[piece.realType];
}

function opponent(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}

function winningStatus(side: Side): GameState['status'] {
  return side === 'red' ? 'red_win' : 'black_win';
}

function isConnectedAdvisor(piece: Piece, board: Board, position: Position): boolean {
  if (publicType(piece) !== 'advisor') return false;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (row === position.row && col === position.col) continue;
      const other = board[row][col];
      if (!other || other.side !== piece.side || publicType(other) !== 'advisor') continue;
      const distance = Math.abs(row - position.row) + Math.abs(col - position.col);
      if (distance <= 3) return true;
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

function targetValue(piece: Piece, board: Board, position: Position): number {
  const type = publicType(piece);
  if (type === 'king') return value.king;
  if (type === 'rook') return value.rook;
  if (type === 'cannon') return 360;
  if (type === 'horse') return value.horse;
  if (type === 'advisor') return isConnectedAdvisor(piece, board, position) ? 280 : 170;
  if (type === 'elephant') return 140;
  if (type === 'pawn') {
    if (!isCrossedPawn(piece, position)) return 60;
    return isNearEnemyPalace(piece, position) ? 145 : 120;
  }
  return pieceValue(piece);
}

function captureScore(board: Board, move: Move): number {
  return move.captured ? targetValue(move.captured, board, move.to) : 0;
}

function revealScore(move: Move): number {
  return move.flipped ? 20 : 0;
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

function openingPawnRevealBonus(state: GameState, move: Move): number {
  if (state.history.length > 8) return 0;
  if (move.piece.side !== state.turn) return 0;
  if (move.piece.originalType !== 'pawn') return 0;
  if (move.piece.revealed) return 0;
  if (!isOpeningPawnStart(state.turn, move.from)) return 0;

  let bonus = 40;
  if (move.from.col === 0 || move.from.col === 8) bonus += 10;
  else if (move.from.col === 2 || move.from.col === 6) bonus += 8;
  return bonus;
}

function bestRecaptureValue(board: Board, side: Side, target: Position): number {
  const replies = getAllLegalMoves(board, side);
  let best = 0;
  for (const reply of replies) {
    if (!reply.captured || !samePosition(reply.to, target)) continue;
    best = Math.max(best, targetValue(reply.captured, board, reply.to));
  }
  return best;
}

function maxCaptureValue(board: Board, side: Side): number {
  let best = 0;
  for (const move of getAllLegalMoves(board, side)) {
    if (move.captured) best = Math.max(best, targetValue(move.captured, board, move.to));
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

function kingZonePressureBonus(board: Board, side: Side, movedTo: Position): number {
  const king = opponentKingPosition(board, side);
  if (!king) return 0;

  const distance = Math.abs(king.row - movedTo.row) + Math.abs(king.col - movedTo.col);
  if (distance <= 2) return 25;
  if (distance <= 4 && (king.row === movedTo.row || king.col === movedTo.col)) return 15;
  return 0;
}

function isNearEnemyCamp(side: Side, position: Position): boolean {
  return side === 'red' ? position.row <= 3 : position.row >= 6;
}

function keySquareBonus(board: Board, side: Side, position: Position): number {
  let score = 0;

  if (position.col === 4) score += 8;
  else if (position.col === 3 || position.col === 5) score += 4;

  if (position.row === 4 || position.row === 5) score += 8;
  if (isNearEnemyPalace({ id: 'key-square', side, originalType: 'pawn', realType: 'pawn', revealed: true }, position)) score += 12;
  if ((position.col === 1 || position.col === 7) && isNearEnemyCamp(side, position)) score += 6;

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
  if (adjacentHidden) score += 6;

  return Math.min(score, 28);
}

function leaveKeySquarePenalty(board: Board, side: Side, from: Position, to: Position, hasClearGain: boolean): number {
  if (hasClearGain) return 0;

  const fromScore = keySquareBonus(board, side, from);
  const toScore = keySquareBonus(board, side, to);
  if (fromScore < 16 || fromScore - toScore < 8) return 0;
  return fromScore >= 22 ? -20 : -12;
}

function hiddenPiecePressureBonus(board: Board, side: Side): number {
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
    score += 8;
    if (col === 4 || row === 4 || row === 5 || isNearEnemyCamp(side, { row, col })) score += 4;
  }
  return Math.min(score, 32);
}

function opponentReplyPenalty(board: Board, side: Side, movedTo: Position, movedPiece: Piece): {
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
      const gain = targetValue(reply.captured, board, reply.to);
      if (gain > maxReplyGain) maxReplyGain = gain;
    }

    if (!samePosition(reply.to, movedTo)) continue;

    immediateCapture = true;
    const replyBoard = applyMoveToBoard(board, reply);
    const recaptureValue = bestRecaptureValue(replyBoard, side, movedTo);
    const tradeNet = movedPieceValue(movedPiece) - recaptureValue;
    possibleLoss = Math.max(possibleLoss, Math.max(0, tradeNet));
  }

  return {
    immediateCapture,
    maxReplyGain,
    possibleLoss,
    risk: Math.round(possibleLoss * 1.8 + maxReplyGain * 0.25),
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

function evaluateMove(state: GameState, move: Move, blocksImmediateWin: boolean): MoveEvaluation {
  const next = applyMove(state, move.from, move.to);
  const nextBoard = next === state ? applyMoveToBoard(state.board, move) : next.board;
  const moved = nextBoard[move.to.row][move.to.col]!;
  const reply = opponentReplyPenalty(nextBoard, state.turn, move.to, moved);
  const targetGain = captureScore(state.board, move);
  const captureGain = targetGain;
  const openingBonus = openingPawnRevealBonus(state, move);
  const threatValue = maxCaptureValue(nextBoard, state.turn);
  const importantThreat = threatValue >= value.horse;
  const wasUnderAttack = isSquareAttacked(state.board, opponent(state.turn), move.from);
  const escapeBonus = wasUnderAttack && !reply.immediateCapture && movedPieceValue(move.piece) >= value.horse ? 45 : 0;
  const pressureBonus = kingZonePressureBonus(nextBoard, state.turn, move.to);
  const protectedMove = isSquareProtectedBySide(nextBoard, state.turn, move.to);
  const capturedConnectedAdvisor = !!move.captured && publicType(move.captured) === 'advisor' && isConnectedAdvisor(move.captured, state.board, move.to);
  const capturedCrossedPawn = !!move.captured && publicType(move.captured) === 'pawn' && isCrossedPawn(move.captured, move.to);
  const rawKeySquareScore = keySquareBonus(nextBoard, state.turn, move.to);
  const keySquareScore = openingBonus > 0 ? Math.min(rawKeySquareScore, 4) : rawKeySquareScore;
  const hiddenPressureScore = hiddenPiecePressureBonus(nextBoard, state.turn);
  const controlsImportantHidden = hiddenPressureScore >= 12;
  const checking = next !== state && next.status === 'playing' && isInCheck(next.board, next.turn);
  const effectiveCheck = checking && (
    captureGain > 0 ||
    importantThreat ||
    pressureBonus > 0 ||
    reply.possibleLoss === 0 && threatValue >= value.cannon
  );
  const lowQualityCheck = checking && !effectiveCheck;
  const exchangeNet = captureGain - reply.possibleLoss;
  const hasClearGain = captureGain >= value.cannon || blocksImmediateWin || effectiveCheck || (captureGain > 0 && exchangeNet >= 0) || escapeBonus > 0;
  const leaveKeySquareScore = leaveKeySquarePenalty(state.board, state.turn, move.from, move.to, hasClearGain);
  const purposeful = (
    captureGain > 0 ||
    openingBonus > 0 ||
    importantThreat ||
    escapeBonus > 0 ||
    pressureBonus > 0 ||
    keySquareScore >= 12 ||
    hiddenPressureScore >= 12 ||
    blocksImmediateWin ||
    effectiveCheck
  );
  const meaningless = !purposeful && !checking;
  const highValueMover = movedPieceValue(move.piece) >= value.horse;
  const hangingMove = highValueMover && !protectedMove && !hasClearGain;
  const purposePenalty = meaningless ? meaninglessMovePenalty : 0;
  const checkPenalty = lowQualityCheck ? lowQualityCheckPenalty : 0;
  const checkBonus = effectiveCheck ? 35 : 0;
  const threatBonus = importantThreat ? Math.round(Math.min(threatValue, value.rook) * 0.12) : 0;
  const blockDangerBonus = blocksImmediateWin ? 70 : 0;
  const protectionScore = protectedMove ? protectedMoveBonus : 0;
  const hangingPenalty = hangingMove ? hangingMovePenalty : 0;

  const score =
    captureGain -
    reply.possibleLoss +
    revealScore(move) +
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
    Math.round(reply.maxReplyGain * 0.25);

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

function reasonFor(best: Move, evaluation: MoveEvaluation, avoidedOpponentWin: boolean): string {
  if (avoidedOpponentWin) return '避免送對方一步殺';
  if (evaluation.hangingMove) return '高價子落點無保護，已扣分';
  if (best.captured && evaluation.exchangeNet < 0) return '交換可能虧損，已扣分';
  if (evaluation.capturedConnectedAdvisor) return '吃連得起來的士';
  if (evaluation.capturedCrossedPawn) return '吃過河兵卒';
  if (best.captured && evaluation.targetGain >= value.cannon) return '吃高價目標';
  if (best.captured && evaluation.exchangeNet >= 250) return '安全吃子';
  if (best.captured && evaluation.exchangeNet >= 0) return '交換不虧';
  if (evaluation.effectiveCheck) return '有效將軍';
  if (evaluation.lowQualityCheck) return '無成果將軍，已降分';
  if (evaluation.leaveKeySquareScore < 0) return '離開要點且收益不足，已扣分';
  if (evaluation.meaningless) return '此步缺乏明確目的，已扣分';
  if (evaluation.threatValue >= value.horse) return '威脅對方重要棋子';
  if (evaluation.escapeBonus > 0) return '讓重要棋子脫離危險';
  if (evaluation.pressureBonus > 0) return '增加將區壓力';
  if (evaluation.controlsImportantHidden) return '控制對方重要暗子位置';
  if (evaluation.hiddenPressureScore > 0) return '壓制對方暗子';
  if (evaluation.keySquareScore >= 12) return '佔據揭棋要點';
  if (evaluation.protectedMove) return '落點有保護';
  if (evaluation.openingBonus > 0) return '開局翻兵';
  if (evaluation.risk > 0 || evaluation.immediateCapture) return '此步有被吃風險，已扣分';
  return '簡易分數較佳';
}

export function recommendMove(state: GameState, candidateMoves?: Move[]): { move: Move | null; score: number; reason: string } {
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
  let bestEvaluation = evaluateMove(state, best, currentlyAllowsOpponentWin && !allowsOpponentWin(state, best));

  for (const move of scoringMoves) {
    const evaluation = evaluateMove(state, move, currentlyAllowsOpponentWin && !allowsOpponentWin(state, move));
    if (evaluation.score > bestEvaluation.score) {
      best = move;
      bestEvaluation = evaluation;
    }
  }

  return {
    move: best,
    score: bestEvaluation.score,
    reason: reasonFor(best, bestEvaluation, avoidedOpponentWin),
  };
}

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

function captureScore(move: Move): number {
  return move.captured ? pieceValue(move.captured) : 0;
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
    best = Math.max(best, pieceValue(reply.captured));
  }
  return best;
}

function maxCaptureValue(board: Board, side: Side): number {
  let best = 0;
  for (const move of getAllLegalMoves(board, side)) {
    if (move.captured) best = Math.max(best, pieceValue(move.captured));
  }
  return best;
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
      const gain = pieceValue(reply.captured);
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
  const captureGain = captureScore(move);
  const openingBonus = openingPawnRevealBonus(state, move);
  const threatValue = maxCaptureValue(nextBoard, state.turn);
  const importantThreat = threatValue >= value.horse;
  const wasUnderAttack = isSquareAttacked(state.board, opponent(state.turn), move.from);
  const escapeBonus = wasUnderAttack && !reply.immediateCapture && movedPieceValue(move.piece) >= value.horse ? 45 : 0;
  const pressureBonus = kingZonePressureBonus(nextBoard, state.turn, move.to);
  const checking = next !== state && next.status === 'playing' && isInCheck(next.board, next.turn);
  const effectiveCheck = checking && (
    captureGain > 0 ||
    importantThreat ||
    pressureBonus > 0 ||
    reply.possibleLoss === 0 && threatValue >= value.cannon
  );
  const lowQualityCheck = checking && !effectiveCheck;
  const exchangeNet = captureGain - reply.possibleLoss;
  const purposeful = (
    captureGain > 0 ||
    openingBonus > 0 ||
    importantThreat ||
    escapeBonus > 0 ||
    pressureBonus > 0 ||
    blocksImmediateWin ||
    effectiveCheck
  );
  const meaningless = !purposeful && !checking;
  const purposePenalty = meaningless ? meaninglessMovePenalty : 0;
  const checkPenalty = lowQualityCheck ? lowQualityCheckPenalty : 0;
  const checkBonus = effectiveCheck ? 35 : 0;
  const threatBonus = importantThreat ? Math.round(Math.min(threatValue, value.rook) * 0.12) : 0;
  const blockDangerBonus = blocksImmediateWin ? 70 : 0;

  const score =
    captureGain -
    reply.possibleLoss +
    revealScore(move) +
    openingBonus +
    positionScore(move) +
    threatBonus +
    escapeBonus +
    pressureBonus +
    blockDangerBonus +
    checkBonus +
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
    blocksImmediateWin,
    checking,
    effectiveCheck,
    lowQualityCheck,
    meaningless,
  };
}

function reasonFor(best: Move, evaluation: MoveEvaluation, avoidedOpponentWin: boolean): string {
  if (avoidedOpponentWin) return '避免送對方一步殺';
  if (best.captured && evaluation.exchangeNet >= 250) return '安全吃子';
  if (best.captured && evaluation.exchangeNet >= 0) return '交換不虧';
  if (evaluation.effectiveCheck) return '有效將軍';
  if (evaluation.lowQualityCheck) return '無成果將軍，已降分';
  if (evaluation.meaningless) return '此步缺乏明確目的，已扣分';
  if (evaluation.threatValue >= value.horse) return '威脅對方重要棋子';
  if (evaluation.escapeBonus > 0) return '讓重要棋子脫離危險';
  if (evaluation.pressureBonus > 0) return '增加將區壓力';
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

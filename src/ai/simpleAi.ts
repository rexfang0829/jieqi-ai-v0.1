import type { Board, GameState, Move, Piece, PieceType, Position, Side } from '../types/chess';
import { getAllLegalMoves } from '../game/checkRules';
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

const openingPawnStarts = createInitialBoard().flatMap((row, rowIndex) =>
  row.flatMap((piece, colIndex) =>
    piece?.originalType === 'pawn'
      ? [{ side: piece.side, row: rowIndex, col: colIndex }]
      : []
  )
);

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

function baseScore(state: GameState, move: Move, possibleLoss: number, maxReplyGain: number): number {
  return captureScore(move) - possibleLoss + revealScore(move) + openingPawnRevealBonus(state, move) + positionScore(move) - Math.round(maxReplyGain * 0.25);
}

function allowsOpponentWin(state: GameState, move: Move): boolean {
  const next = applyMove(state, move.from, move.to);
  if (next === state || next.status !== 'playing') return false;
  const opponentMoves = getAllLegalMoves(next.board, next.turn);
  return opponentMoves.some(reply =>
    applyMove(next, reply.from, reply.to).status === winningStatus(next.turn)
  );
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

  let best = scoringMoves[0];
  let bestScore = -999999;
  let bestRisk = 0;
  let bestImmediateCapture = false;
  let bestExchangeNet = 0;
  let sawRiskyMove = false;

  for (const move of scoringMoves) {
    const nextBoard = applyMoveToBoard(state.board, move);
    const moved = nextBoard[move.to.row][move.to.col]!;
    const reply = opponentReplyPenalty(nextBoard, state.turn, move.to, moved);
    const score = baseScore(state, move, reply.possibleLoss, reply.maxReplyGain);

    if (reply.risk > 0) sawRiskyMove = true;
    if (score > bestScore) {
      bestScore = score;
      best = move;
      bestRisk = reply.risk;
      bestImmediateCapture = reply.immediateCapture;
      bestExchangeNet = captureScore(move) - reply.possibleLoss;
    }
  }

  let reason = '簡易分數較佳';
  if (safeMoves.length && safeMoves.length < moves.length) reason = '避免對方下一手絕殺';
  else if (best.captured && bestExchangeNet >= 250) reason = '安全吃高價子';
  else if (best.captured && bestExchangeNet >= 0) reason = '此步交換不虧';
  else if (bestImmediateCapture) reason = '此步會被對方吃回，已按交換扣分';
  else if (sawRiskyMove && bestRisk === 0) reason = '避免送子';
  else if (bestRisk > 0) reason = '此步有被吃風險，已扣分';

  return { move: best, score: bestScore, reason };
}

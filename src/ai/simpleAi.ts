import type { Board, GameState, Move, Piece, PieceType, Position, Side } from '../types/chess';
import { getAllLegalMoves } from '../game/checkRules';
import { applyMove } from '../game/gameEngine';

const value: Record<PieceType, number> = {
  king: 10000,
  rook: 500,
  cannon: 350,
  horse: 300,
  elephant: 150,
  advisor: 150,
  pawn: 80,
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

function opponentReplyPenalty(board: Board, side: Side, movedTo: Position, movedPiece: Piece): { risk: number; immediateCapture: boolean; maxReplyGain: number } {
  const replies = getAllLegalMoves(board, opponent(side));
  let immediateCapture = false;
  let maxReplyGain = 0;

  for (const reply of replies) {
    if (!reply.captured) continue;
    const gain = pieceValue(reply.captured);
    if (gain > maxReplyGain) maxReplyGain = gain;
    if (samePosition(reply.to, movedTo)) immediateCapture = true;
  }

  const loss = immediateCapture ? movedPieceValue(movedPiece) : 0;
  return {
    immediateCapture,
    maxReplyGain,
    risk: Math.round(loss * 3 + maxReplyGain * 0.55),
  };
}

function baseScore(move: Move): number {
  return captureScore(move) + revealScore(move) + positionScore(move);
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
  let sawRiskyMove = false;

  for (const move of scoringMoves) {
    const nextBoard = applyMoveToBoard(state.board, move);
    const moved = nextBoard[move.to.row][move.to.col]!;
    const reply = opponentReplyPenalty(nextBoard, state.turn, move.to, moved);
    const score = baseScore(move) - reply.risk;

    if (reply.risk > 0) sawRiskyMove = true;
    if (score > bestScore) {
      bestScore = score;
      best = move;
      bestRisk = reply.risk;
      bestImmediateCapture = reply.immediateCapture;
    }
  }

  let reason = '簡易分數最佳';
  if (safeMoves.length && safeMoves.length < moves.length) reason = '避免對方下一手絕殺';
  else if (best.captured && bestRisk === 0) reason = '此步吃子且相對安全';
  else if (bestImmediateCapture) reason = '此步會被對方吃回，已扣分';
  else if (sawRiskyMove && bestRisk === 0) reason = '避免送子';
  else if (bestRisk > 0) reason = '此步有被吃風險，已扣分';

  return { move: best, score: bestScore, reason };
}

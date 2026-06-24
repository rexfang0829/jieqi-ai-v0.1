import type { Board, GameState, Move, Piece, PieceType, Position, Side } from '../types/chess';
import { getAllLegalMoves } from '../game/checkRules';

const value: Record<PieceType, number> = { king: 10000, rook: 500, cannon: 350, horse: 300, elephant: 150, advisor: 150, pawn: 80 };

function publicType(piece: { originalType: PieceType; realType: PieceType; revealed: boolean }): PieceType {
  return piece.revealed ? piece.realType : piece.originalType;
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(piece => piece ? {...piece} : null));
}

function applyMoveToBoard(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const moving = next[move.from.row][move.from.col];
  if (!moving) return next;
  next[move.to.row][move.to.col] = {...moving, revealed: true};
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

export function recommendMove(state: GameState): { move: Move | null; score: number; reason: string } {
  const moves = getAllLegalMoves(state.board, state.turn);
  if (!moves.length) return { move: null, score: -99999, reason: '沒有合法步' };

  let best = moves[0], bestScore = -999999, bestRisk = 0, bestImmediateCapture = false;
  let sawRiskyMove = false;

  for (const move of moves) {
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

  let reason = '改善位置並保留機動性';
  if (best.captured && bestRisk === 0) reason = '此步吃子且相對安全';
  else if (bestImmediateCapture) reason = '此步會被對方攻擊，已扣分';
  else if (sawRiskyMove && bestRisk === 0) reason = '避免送子';
  else if (bestRisk > 0) reason = '此步有被吃風險，已扣分';

  return { move: best, score: bestScore, reason };
}

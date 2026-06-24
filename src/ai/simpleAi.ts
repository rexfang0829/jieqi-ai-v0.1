import type { GameState, Move, PieceType } from '../types/chess';
import { getAllLegalMoves } from '../game/checkRules';

const value: Record<PieceType, number> = { king: 10000, rook: 500, cannon: 350, horse: 300, elephant: 150, advisor: 150, pawn: 80 };

export function recommendMove(state: GameState): { move: Move | null; score: number; reason: string } {
  const moves = getAllLegalMoves(state.board, state.turn);
  if (!moves.length) return { move: null, score: -99999, reason: '目前無合法步' };
  let best = moves[0], bestScore = -999999;
  for (const m of moves) {
    let score = 0;
    if (m.captured) score += value[m.captured.realType];
    if (m.flipped) score += 20;
    score += 4 - Math.abs(4 - m.to.col);
    if (m.to.row >= 3 && m.to.row <= 6) score += 3;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return { move: best, score: bestScore, reason: best.captured ? '優先吃子並兼顧中心控制' : '兼顧翻子、中心與活動度' };
}

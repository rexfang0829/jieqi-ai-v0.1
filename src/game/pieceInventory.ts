import type { Board, PieceType, Position, Side } from '../types/chess';

export const PIECE_LIMITS: Record<Side, Record<PieceType, number>> = {
  red: {
    king: 1,
    advisor: 2,
    elephant: 2,
    rook: 2,
    horse: 2,
    cannon: 2,
    pawn: 5,
  },
  black: {
    king: 1,
    advisor: 2,
    elephant: 2,
    rook: 2,
    horse: 2,
    cannon: 2,
    pawn: 5,
  },
};

export function countRealPieces(board: Board, side: Side, ignore?: Position): Record<PieceType, number> {
  const counts = Object.fromEntries(Object.keys(PIECE_LIMITS[side]).map(type => [type, 0])) as Record<PieceType, number>;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (ignore && ignore.row === row && ignore.col === col) continue;
      const piece = board[row][col];
      if (piece?.side === side) counts[piece.realType] += 1;
    }
  }

  return counts;
}

export function remainingRealPieces(board: Board, side: Side): Record<PieceType, number> {
  const counts = countRealPieces(board, side);
  const remaining = {...PIECE_LIMITS[side]};
  for (const type of Object.keys(remaining) as PieceType[]) {
    remaining[type] = Math.max(0, remaining[type] - counts[type]);
  }
  return remaining;
}

export function canSetRealType(board: Board, pos: Position, side: Side, realType: PieceType): boolean {
  const counts = countRealPieces(board, side, pos);
  return counts[realType] < PIECE_LIMITS[side][realType];
}

export function inventoryError(board: Board, pos: Position, side: Side, realType: PieceType): string | null {
  if (canSetRealType(board, pos, side, realType)) return null;
  return `此方 ${realType} 數量已達上限，未套用`;
}

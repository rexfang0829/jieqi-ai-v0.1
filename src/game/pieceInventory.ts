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

export function countRevealedRealPieces(board: Board, side: Side, ignore?: Position): Record<PieceType, number> {
  const counts = Object.fromEntries(Object.keys(PIECE_LIMITS[side]).map(type => [type, 0])) as Record<PieceType, number>;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (ignore && ignore.row === row && ignore.col === col) continue;
      const piece = board[row][col];
      if (piece?.side === side && piece.revealed) counts[piece.realType] += 1;
    }
  }

  return counts;
}

export const countRealPieces = countRevealedRealPieces;

export function remainingRealPieces(board: Board, side: Side): Record<PieceType, number> {
  const counts = countRevealedRealPieces(board, side);
  const remaining = {...PIECE_LIMITS[side]};
  for (const type of Object.keys(remaining) as PieceType[]) {
    remaining[type] = Math.max(0, remaining[type] - counts[type]);
  }
  return remaining;
}

export function canSetRealType(board: Board, pos: Position, side: Side, realType: PieceType): boolean {
  const counts = countRevealedRealPieces(board, side, pos);
  return counts[realType] < PIECE_LIMITS[side][realType];
}

export function inventoryError(board: Board, pos: Position, side: Side, realType: PieceType): string | null {
  if (canSetRealType(board, pos, side, realType)) return null;
  return `此方 ${realType} 數量已達上限，未套用`;
}

function poolForCounts(side: Side, counts: Record<PieceType, number>): PieceType[] | null {
  const pool: PieceType[] = [];
  for (const type of Object.keys(PIECE_LIMITS[side]) as PieceType[]) {
    const left = PIECE_LIMITS[side][type] - counts[type];
    if (left < 0) return null;
    for (let i = 0; i < left; i++) pool.push(type);
  }
  return pool;
}

export function reconcileHiddenRealTypes(board: Board, side: Side): Board | null {
  const pool = poolForCounts(side, countRevealedRealPieces(board, side));
  if (!pool) return null;

  const next = board.map(row => row.map(piece => piece ? {...piece} : null));
  const remaining = Object.fromEntries(Object.keys(PIECE_LIMITS[side]).map(type => [type, 0])) as Record<PieceType, number>;
  for (const type of pool) remaining[type] += 1;
  const needsType: Position[] = [];

  for (let row = 0; row < next.length; row++) {
    for (let col = 0; col < next[row].length; col++) {
      const piece = next[row][col];
      if (!piece || piece.side !== side || piece.revealed) continue;
      if (remaining[piece.realType] > 0) {
        remaining[piece.realType] -= 1;
      } else {
        needsType.push({ row, col });
      }
    }
  }

  const refill = (Object.keys(remaining) as PieceType[]).flatMap(type => Array.from({ length: remaining[type] }, () => type));
  if (needsType.length > refill.length) return null;
  needsType.forEach((pos, index) => {
    const piece = next[pos.row][pos.col];
    if (piece) next[pos.row][pos.col] = {...piece, realType: refill[index]};
  });

  return next;
}

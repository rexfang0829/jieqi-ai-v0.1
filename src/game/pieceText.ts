import type { Piece, PieceType, Side } from '../types/chess';

export const sideNames: Record<Side, string> = {
  red: '紅',
  black: '黑',
};

export const pieceTypeNames: Record<Side, Record<PieceType, string>> = {
  red: {
    king: '帥',
    advisor: '仕',
    elephant: '相',
    rook: '車',
    horse: '馬',
    cannon: '炮',
    pawn: '兵',
  },
  black: {
    king: '將',
    advisor: '士',
    elephant: '象',
    rook: '車',
    horse: '馬',
    cannon: '包',
    pawn: '卒',
  },
};

export const editorPieceTypeNames: Record<PieceType, string> = {
  king: '帥/將',
  advisor: '仕/士',
  elephant: '相/象',
  rook: '車',
  horse: '馬',
  cannon: '炮/包',
  pawn: '兵/卒',
};

export function pieceTypeName(side: Side, type: PieceType): string {
  return pieceTypeNames[side][type];
}

export function realPieceName(piece: Piece): string {
  return pieceTypeName(piece.side, piece.realType);
}

export function publicPieceName(piece: Piece): string {
  return pieceTypeName(piece.side, piece.revealed ? piece.realType : piece.originalType);
}

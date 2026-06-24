import type { Move, Piece, PieceType, Side } from '../types/chess';

const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

const pieceNames: Record<Side, Record<PieceType, string>> = {
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
    cannon: '炮',
    pawn: '卒',
  },
};

function typeForNotation(piece: Piece): PieceType {
  return piece.revealed ? piece.realType : piece.originalType;
}

function fileNumber(side: Side, col: number): string {
  return numerals[side === 'red' ? 8 - col : col];
}

function stepNumber(n: number): string {
  return numerals[n - 1] ?? String(n);
}

function forwardDelta(side: Side, fromRow: number, toRow: number): number {
  return side === 'red' ? fromRow - toRow : toRow - fromRow;
}

function actionText(piece: Piece, move: Move): string {
  const delta = forwardDelta(piece.side, move.from.row, move.to.row);
  if (delta === 0) return `平${fileNumber(piece.side, move.to.col)}`;

  const action = delta > 0 ? '進' : '退';
  const type = typeForNotation(piece);
  const diagonalPiece = type === 'advisor' || type === 'elephant' || type === 'horse';
  const value = diagonalPiece ? fileNumber(piece.side, move.to.col) : stepNumber(Math.abs(delta));
  return `${action}${value}`;
}

export function moveText(move: Move): string {
  const piece = move.piece;
  const type = typeForNotation(piece);
  const hiddenPrefix = piece.revealed ? '' : '暗';
  return `${hiddenPrefix}${pieceNames[piece.side][type]}${fileNumber(piece.side, move.from.col)}${actionText(piece, move)}`;
}

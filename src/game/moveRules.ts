import type { Board, Piece, PieceType, Position, Side } from '../types/chess';

export const inBoard = (p: Position) => p.row >= 0 && p.row < 10 && p.col >= 0 && p.col < 9;
const same = (a: Position, b: Position) => a.row === b.row && a.col === b.col;
const abs = Math.abs;

function typeForMove(piece: Piece): PieceType {
  return piece.revealed ? piece.realType : piece.originalType;
}

function palace(side: Side, p: Position) {
  const rows = side === 'red' ? [7,8,9] : [0,1,2];
  return rows.includes(p.row) && p.col >= 3 && p.col <= 5;
}

function crossedRiver(side: Side, row: number) {
  return side === 'red' ? row <= 4 : row >= 5;
}

function countBetween(board: Board, from: Position, to: Position) {
  let count = 0;
  if (from.row === to.row) {
    const [a,b] = [Math.min(from.col,to.col), Math.max(from.col,to.col)];
    for (let c=a+1;c<b;c++) if (board[from.row][c]) count++;
  } else if (from.col === to.col) {
    const [a,b] = [Math.min(from.row,to.row), Math.max(from.row,to.row)];
    for (let r=a+1;r<b;r++) if (board[r][from.col]) count++;
  }
  return count;
}

export function isBasicLegalMove(board: Board, from: Position, to: Position): boolean {
  if (!inBoard(from) || !inBoard(to) || same(from,to)) return false;
  const piece = board[from.row][from.col];
  if (!piece) return false;
  const target = board[to.row][to.col];
  if (target && target.side === piece.side) return false;

  const dr = to.row - from.row;
  const dc = to.col - from.col;
  const adr = abs(dr), adc = abs(dc);
  const type = typeForMove(piece);

  if (type === 'rook') return (dr === 0 || dc === 0) && countBetween(board, from, to) === 0;

  if (type === 'cannon') {
    if (dr !== 0 && dc !== 0) return false;
    const screens = countBetween(board, from, to);
    return target ? screens === 1 : screens === 0;
  }

  if (type === 'horse') {
    if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false;
    const leg = adr === 2 ? { row: from.row + dr / 2, col: from.col } : { row: from.row, col: from.col + dc / 2 };
    return !board[leg.row][leg.col];
  }

  if (type === 'elephant') {
    if (!(adr === 2 && adc === 2)) return false;
    if (piece.side === 'red' && to.row < 5) return false;
    if (piece.side === 'black' && to.row > 4) return false;
    const eye = { row: from.row + dr / 2, col: from.col + dc / 2 };
    return !board[eye.row][eye.col];
  }

  if (type === 'advisor') return adr === 1 && adc === 1 && palace(piece.side, to);

  if (type === 'king') return ((adr === 1 && adc === 0) || (adr === 0 && adc === 1)) && palace(piece.side, to);

  if (type === 'pawn') {
    const forward = piece.side === 'red' ? -1 : 1;
    if (dr === forward && dc === 0) return true;
    if (crossedRiver(piece.side, from.row) && dr === 0 && adc === 1) return true;
    return false;
  }

  return false;
}

export function kingsFace(board: Board): boolean {
  let red: Position | null = null, black: Position | null = null;
  for (let r=0;r<10;r++) for (let c=0;c<9;c++) {
    const p = board[r][c];
    if (p?.revealed && p.realType === 'king') {
      if (p.side === 'red') red = {row:r,col:c}; else black = {row:r,col:c};
    }
  }
  if (!red || !black || red.col !== black.col) return false;
  const a = Math.min(red.row, black.row), b = Math.max(red.row, black.row);
  for (let r=a+1;r<b;r++) if (board[r][red.col]) return false;
  return true;
}

export function getPseudoLegalMoves(board: Board, from: Position): Position[] {
  const out: Position[] = [];
  for (let r=0;r<10;r++) for (let c=0;c<9;c++) {
    const to = {row:r,col:c};
    if (isBasicLegalMove(board, from, to)) out.push(to);
  }
  return out;
}

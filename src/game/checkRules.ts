import type { Board, Move, Position, Side } from '../types/chess';
import { isBasicLegalMove, kingsFace } from './moveRules';

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(p => p ? {...p} : null));
}

function applyMoveToBoard(board: Board, from: Position, to: Position): Board {
  const next = cloneBoard(board);
  const moving = next[from.row][from.col];
  if (!moving) return next;
  next[to.row][to.col] = {...moving, revealed: true};
  next[from.row][from.col] = null;
  return next;
}

export function findKing(board: Board, side: Side): Position | null {
  for (let r=0;r<10;r++) for (let c=0;c<9;c++) {
    const p = board[r][c];
    if (p?.side === side && p.realType === 'king') return {row:r,col:c};
  }
  return null;
}

export function isInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return true;
  const enemy: Side = side === 'red' ? 'black' : 'red';
  for (let r=0;r<10;r++) for (let c=0;c<9;c++) {
    const p = board[r][c];
    if (p?.side === enemy && isBasicLegalMove(board, {row:r,col:c}, king)) return true;
  }
  return kingsFace(board);
}

export function getAllLegalMoves(board: Board, side: Side): Move[] {
  const moves: Move[] = [];
  for (let r=0;r<10;r++) for (let c=0;c<9;c++) {
    const piece = board[r][c];
    if (!piece || piece.side !== side) continue;
    for (let tr=0;tr<10;tr++) for (let tc=0;tc<9;tc++) {
      const from = {row:r,col:c}, to = {row:tr,col:tc};
      if (!isBasicLegalMove(board, from, to)) continue;
      const next = applyMoveToBoard(board, from, to);
      if (kingsFace(next)) continue;
      if (!isInCheck(next, side)) moves.push({from, to, piece, captured: board[tr][tc], flipped: !piece.revealed});
    }
  }
  return moves;
}

export function isCheckmate(board: Board, side: Side): boolean {
  return isInCheck(board, side) && getAllLegalMoves(board, side).length === 0;
}

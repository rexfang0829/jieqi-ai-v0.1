import type { Board, Position } from '../types/chess';

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;
export const BOARD_POINT_COUNT = BOARD_ROWS * BOARD_COLS;

export function isBoardShape(board: Board): boolean {
  return board.length === BOARD_ROWS && board.every(row => row.length === BOARD_COLS);
}

export function visualRowForBoardRow(row: number): number {
  return row <= 4 ? row : row + 1;
}

export function samePosition(a: Position | null, b: Position): boolean {
  return !!a && a.row === b.row && a.col === b.col;
}

export function hasLegalPosition(legalMoves: Position[], pos: Position): boolean {
  return legalMoves.some(move => move.row === pos.row && move.col === pos.col);
}

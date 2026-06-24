import type { Board, Position } from '../types/chess';

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;
export const BOARD_POINT_COUNT = BOARD_ROWS * BOARD_COLS;
export const TOP_FILE_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const BOTTOM_FILE_LABELS = ['\u4e5d', '\u516b', '\u4e03', '\u516d', '\u4e94', '\u56db', '\u4e09', '\u4e8c', '\u4e00'];

export function isBoardShape(board: Board): boolean {
  return board.length === BOARD_ROWS && board.every(row => row.length === BOARD_COLS);
}

export function visualRowForBoardRow(row: number): number {
  return row;
}

export function samePosition(a: Position | null, b: Position): boolean {
  return !!a && a.row === b.row && a.col === b.col;
}

export function hasLegalPosition(legalMoves: Position[], pos: Position): boolean {
  return legalMoves.some(move => move.row === pos.row && move.col === pos.col);
}

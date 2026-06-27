"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOTTOM_FILE_LABELS = exports.TOP_FILE_LABELS = exports.BOARD_POINT_COUNT = exports.BOARD_COLS = exports.BOARD_ROWS = void 0;
exports.isBoardShape = isBoardShape;
exports.visualRowForBoardRow = visualRowForBoardRow;
exports.samePosition = samePosition;
exports.hasLegalPosition = hasLegalPosition;
exports.BOARD_ROWS = 10;
exports.BOARD_COLS = 9;
exports.BOARD_POINT_COUNT = exports.BOARD_ROWS * exports.BOARD_COLS;
exports.TOP_FILE_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
exports.BOTTOM_FILE_LABELS = ['\u4e5d', '\u516b', '\u4e03', '\u516d', '\u4e94', '\u56db', '\u4e09', '\u4e8c', '\u4e00'];
function isBoardShape(board) {
    return board.length === exports.BOARD_ROWS && board.every(row => row.length === exports.BOARD_COLS);
}
function visualRowForBoardRow(row) {
    return row;
}
function samePosition(a, b) {
    return !!a && a.row === b.row && a.col === b.col;
}
function hasLegalPosition(legalMoves, pos) {
    return legalMoves.some(move => move.row === pos.row && move.col === pos.col);
}

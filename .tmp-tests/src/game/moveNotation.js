"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureText = captureText;
exports.moveText = moveText;
const pieceText_1 = require("./pieceText");
const redNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const blackNumerals = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
function typeForNotation(piece) {
    return piece.revealed ? piece.realType : piece.originalType;
}
function numberText(side, n) {
    return side === 'red' ? redNumerals[n - 1] ?? String(n) : blackNumerals[n - 1] ?? String(n);
}
function fileNumber(side, col) {
    return numberText(side, side === 'red' ? 9 - col : col + 1);
}
function forwardDelta(side, fromRow, toRow) {
    return side === 'red' ? fromRow - toRow : toRow - fromRow;
}
function actionText(piece, move) {
    const delta = forwardDelta(piece.side, move.from.row, move.to.row);
    if (delta === 0)
        return `平${fileNumber(piece.side, move.to.col)}`;
    const action = delta > 0 ? '進' : '退';
    const type = typeForNotation(piece);
    const diagonalPiece = type === 'advisor' || type === 'elephant' || type === 'horse';
    const value = diagonalPiece ? fileNumber(piece.side, move.to.col) : numberText(piece.side, Math.abs(delta));
    return `${action}${value}`;
}
function captureText(move) {
    if (!move.captured)
        return '';
    const capturedSide = pieceText_1.sideNames[move.captured.side];
    const capturedName = (0, pieceText_1.realPieceName)(move.captured);
    if (move.captureKind === 'hidden' || move.capturedWasHidden) {
        return `，吃${capturedSide}暗子（翻出${capturedName}）`;
    }
    return `，吃${capturedSide}${capturedName}`;
}
function moveText(move) {
    const piece = move.piece;
    const type = typeForNotation(piece);
    const hiddenPrefix = piece.revealed ? '' : '暗';
    return `${hiddenPrefix}${(0, pieceText_1.pieceTypeName)(piece.side, type)}${fileNumber(piece.side, move.from.col)}${actionText(piece, move)}${captureText(move)}`;
}

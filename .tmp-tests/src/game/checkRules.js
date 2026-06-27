"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findKing = findKing;
exports.isInCheck = isInCheck;
exports.getAllLegalMoves = getAllLegalMoves;
exports.isCheckmate = isCheckmate;
exports.isStalemate = isStalemate;
exports.winnerWhenNoLegalMoves = winnerWhenNoLegalMoves;
const moveRules_1 = require("./moveRules");
function cloneBoard(board) {
    return board.map(row => row.map(p => p ? { ...p } : null));
}
function applyMoveToBoard(board, from, to) {
    const next = cloneBoard(board);
    const moving = next[from.row][from.col];
    if (!moving)
        return next;
    next[to.row][to.col] = { ...moving, revealed: true };
    next[from.row][from.col] = null;
    return next;
}
function findKing(board, side) {
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p?.side === side && p.realType === 'king')
                return { row: r, col: c };
        }
    return null;
}
function isInCheck(board, side) {
    const king = findKing(board, side);
    if (!king)
        return true;
    const enemy = side === 'red' ? 'black' : 'red';
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p?.side === enemy && (0, moveRules_1.isBasicLegalMove)(board, { row: r, col: c }, king))
                return true;
        }
    return (0, moveRules_1.kingsFace)(board);
}
function getAllLegalMoves(board, side) {
    const moves = [];
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++) {
            const piece = board[r][c];
            if (!piece || piece.side !== side)
                continue;
            for (let tr = 0; tr < 10; tr++)
                for (let tc = 0; tc < 9; tc++) {
                    const from = { row: r, col: c }, to = { row: tr, col: tc };
                    if (!(0, moveRules_1.isBasicLegalMove)(board, from, to))
                        continue;
                    const next = applyMoveToBoard(board, from, to);
                    if ((0, moveRules_1.kingsFace)(next))
                        continue;
                    if (!isInCheck(next, side)) {
                        const captured = board[tr][tc];
                        moves.push({
                            from,
                            to,
                            piece,
                            captured,
                            capturedWasHidden: captured ? !captured.revealed : undefined,
                            captureKind: captured ? (captured.revealed ? 'revealed' : 'hidden') : undefined,
                            flipped: !piece.revealed,
                        });
                    }
                }
        }
    return moves;
}
function isCheckmate(board, side) {
    return isInCheck(board, side) && getAllLegalMoves(board, side).length === 0;
}
/** Pure stalemate: side has no legal moves and is NOT in check. */
function isStalemate(board, side) {
    return !isInCheck(board, side) && getAllLegalMoves(board, side).length === 0;
}
/** In 揭棋, the player with no legal moves loses; return the winner. */
function winnerWhenNoLegalMoves(side) {
    return side === 'red' ? 'black' : 'red';
}

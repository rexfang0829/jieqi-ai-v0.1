"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countRealPieces = exports.PIECE_LIMITS = void 0;
exports.countRevealedRealPieces = countRevealedRealPieces;
exports.remainingRealPieces = remainingRealPieces;
exports.canSetRealType = canSetRealType;
exports.inventoryError = inventoryError;
exports.reconcileHiddenRealTypes = reconcileHiddenRealTypes;
exports.PIECE_LIMITS = {
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
function countRevealedRealPieces(board, side, ignore) {
    const counts = Object.fromEntries(Object.keys(exports.PIECE_LIMITS[side]).map(type => [type, 0]));
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (ignore && ignore.row === row && ignore.col === col)
                continue;
            const piece = board[row][col];
            if (piece?.side === side && piece.revealed)
                counts[piece.realType] += 1;
        }
    }
    return counts;
}
exports.countRealPieces = countRevealedRealPieces;
function remainingRealPieces(board, side) {
    const counts = countRevealedRealPieces(board, side);
    const remaining = { ...exports.PIECE_LIMITS[side] };
    for (const type of Object.keys(remaining)) {
        remaining[type] = Math.max(0, remaining[type] - counts[type]);
    }
    return remaining;
}
function canSetRealType(board, pos, side, realType) {
    const counts = countRevealedRealPieces(board, side, pos);
    return counts[realType] < exports.PIECE_LIMITS[side][realType];
}
function inventoryError(board, pos, side, realType) {
    if (canSetRealType(board, pos, side, realType))
        return null;
    return `此方 ${realType} 數量已達上限，未套用`;
}
function poolForCounts(side, counts) {
    const pool = [];
    for (const type of Object.keys(exports.PIECE_LIMITS[side])) {
        const left = exports.PIECE_LIMITS[side][type] - counts[type];
        if (left < 0)
            return null;
        for (let i = 0; i < left; i++)
            pool.push(type);
    }
    return pool;
}
function reconcileHiddenRealTypes(board, side) {
    const pool = poolForCounts(side, countRevealedRealPieces(board, side));
    if (!pool)
        return null;
    const next = board.map(row => row.map(piece => piece ? { ...piece } : null));
    const remaining = Object.fromEntries(Object.keys(exports.PIECE_LIMITS[side]).map(type => [type, 0]));
    for (const type of pool)
        remaining[type] += 1;
    const needsType = [];
    for (let row = 0; row < next.length; row++) {
        for (let col = 0; col < next[row].length; col++) {
            const piece = next[row][col];
            if (!piece || piece.side !== side || piece.revealed)
                continue;
            if (remaining[piece.realType] > 0) {
                remaining[piece.realType] -= 1;
            }
            else {
                needsType.push({ row, col });
            }
        }
    }
    const refill = Object.keys(remaining).flatMap(type => Array.from({ length: remaining[type] }, () => type));
    if (needsType.length > refill.length)
        return null;
    needsType.forEach((pos, index) => {
        const piece = next[pos.row][pos.col];
        if (piece)
            next[pos.row][pos.col] = { ...piece, realType: refill[index] };
    });
    return next;
}

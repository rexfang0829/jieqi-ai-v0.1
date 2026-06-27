"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editorPieceTypeNames = exports.pieceTypeNames = exports.sideNames = void 0;
exports.pieceTypeName = pieceTypeName;
exports.realPieceName = realPieceName;
exports.publicPieceName = publicPieceName;
exports.sideNames = {
    red: '紅',
    black: '黑',
};
exports.pieceTypeNames = {
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
exports.editorPieceTypeNames = {
    king: '帥/將',
    advisor: '仕/士',
    elephant: '相/象',
    rook: '車',
    horse: '馬',
    cannon: '炮/包',
    pawn: '兵/卒',
};
function pieceTypeName(side, type) {
    return exports.pieceTypeNames[side][type];
}
function realPieceName(piece) {
    return pieceTypeName(piece.side, piece.realType);
}
function publicPieceName(piece) {
    return pieceTypeName(piece.side, piece.revealed ? piece.realType : piece.originalType);
}

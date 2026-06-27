"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capturedInfoFromMove = capturedInfoFromMove;
exports.getCapturedPieces = getCapturedPieces;
exports.getCapturedBoardStacks = getCapturedBoardStacks;
const pieceText_1 = require("./pieceText");
function capturedInfoFromMove(move) {
    if (!move.captured)
        return null;
    const kind = move.captureKind ?? (move.capturedWasHidden ? 'hidden' : 'revealed');
    const name = (0, pieceText_1.realPieceName)(move.captured);
    return {
        side: move.captured.side,
        kind,
        name,
        label: kind === 'hidden' ? `暗子（翻出${name}）` : name,
    };
}
function getCapturedPieces(history) {
    const result = {
        red: { hidden: [], revealed: [] },
        black: { hidden: [], revealed: [] },
    };
    for (const move of history) {
        const info = capturedInfoFromMove(move);
        if (!info)
            continue;
        result[info.side][info.kind].push(info);
    }
    return result;
}
function toBoardPiece(info) {
    return {
        ...info,
        hiddenBeforeCapture: info.kind === 'hidden',
    };
}
function getCapturedBoardStacks(history) {
    const captured = getCapturedPieces(history);
    return {
        // red captured these black pieces → show at bottom-left (red's side)
        bottomLeft: [...captured.black.revealed, ...captured.black.hidden].map(toBoardPiece),
        // black captured these red pieces → show at top-right (black's side)
        topRight: [...captured.red.revealed, ...captured.red.hidden].map(toBoardPiece),
    };
}

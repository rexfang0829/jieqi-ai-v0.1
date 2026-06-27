"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAiView = createAiView;
exports.visibleStateToMaskedGameState = visibleStateToMaskedGameState;
function toVisiblePiece(piece) {
    if (piece.revealed) {
        return {
            id: piece.id,
            side: piece.side,
            originalType: piece.originalType,
            revealed: true,
            realType: piece.realType,
        };
    }
    // 未翻棋子：不帶 realType，確保公平資訊
    return {
        id: piece.id,
        side: piece.side,
        originalType: piece.originalType,
        revealed: false,
    };
}
function toMaskedPiece(piece) {
    return {
        id: piece.id,
        side: piece.side,
        originalType: piece.originalType,
        revealed: piece.revealed,
        // 關鍵：未翻子一律把 realType mask 成 originalType
        realType: piece.revealed ? piece.realType : piece.originalType,
    };
}
function toVisibleMove(move) {
    return {
        from: move.from,
        to: move.to,
        piece: toVisiblePiece(move.piece),
        captured: move.captured != null ? toVisiblePiece(move.captured) : move.captured,
        capturedWasHidden: move.capturedWasHidden,
        captureKind: move.captureKind,
        flipped: move.flipped,
    };
}
function fromVisibleMove(move) {
    return {
        from: move.from,
        to: move.to,
        piece: toMaskedPiece(move.piece),
        captured: move.captured != null ? toMaskedPiece(move.captured) : move.captured,
        capturedWasHidden: move.capturedWasHidden,
        captureKind: move.captureKind,
        flipped: move.flipped,
    };
}
/**
 * 建立 AI 公平資訊視圖。
 * unrevealed piece 不帶 realType，確保 AI 無法偷看。
 */
function createAiView(state, perspectiveSide) {
    return {
        board: state.board.map(row => row.map(piece => piece ? toVisiblePiece(piece) : null)),
        turn: state.turn,
        status: state.status,
        perspectiveSide,
        history: state.history.map(toVisibleMove),
    };
}
/**
 * MVP 過渡 adapter：將 AiVisibleState 轉回 GameState，
 * 未翻棋子的 realType 一律 mask 成 originalType。
 * 讓現有 recommendMove() 可以暫時吃 masked state。
 */
function visibleStateToMaskedGameState(view) {
    const board = view.board.map(row => row.map(piece => piece ? toMaskedPiece(piece) : null));
    return {
        board,
        turn: view.turn,
        status: view.status,
        history: view.history.map(fromVisibleMove),
    };
}

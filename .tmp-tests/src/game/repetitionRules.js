"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPETITION_DRAW_THRESHOLD = exports.REPETITION_DRAW_MESSAGE = exports.AI_REPEAT_END_MESSAGE = exports.THIRD_REPETITION_MESSAGE = void 0;
exports.getPositionKey = getPositionKey;
exports.getPositionKeyAfterMove = getPositionKeyAfterMove;
exports.countPositionKey = countPositionKey;
exports.wouldCauseThirdRepetition = wouldCauseThirdRepetition;
exports.filterThirdRepetitionMoves = filterThirdRepetitionMoves;
exports.isRepetitionDraw = isRepetitionDraw;
const gameEngine_1 = require("./gameEngine");
exports.THIRD_REPETITION_MESSAGE = '此手會造成第三次重複局面';
exports.AI_REPEAT_END_MESSAGE = '無可避免重複，對局結束';
exports.REPETITION_DRAW_MESSAGE = '重複局面，和棋';
/** 同一局面出現此次數時判定和棋（4 次 = 重複 3 次後第 4 次出現） */
exports.REPETITION_DRAW_THRESHOLD = 4;
/**
 * Fair-info position key: uses originalType for unrevealed pieces
 * so the key reflects public information only.
 */
function getPositionKey(state) {
    const rows = state.board.map(row => row.map(piece => {
        if (!piece)
            return 'empty';
        const type = piece.revealed ? piece.realType : piece.originalType;
        return `${piece.side}:${piece.revealed ? '1' : '0'}:${type}`;
    }).join(',')).join('/');
    return `turn=${state.turn}|board=${rows}`;
}
function getPositionKeyAfterMove(state, move) {
    return getPositionKey((0, gameEngine_1.applyMove)(state, move.from, move.to));
}
function countPositionKey(states, key) {
    return states.reduce((count, state) => count + (getPositionKey(state) === key ? 1 : 0), 0);
}
function wouldCauseThirdRepetition(state, pastStates, move) {
    const key = getPositionKeyAfterMove(state, move);
    return countPositionKey([...pastStates, state], key) >= 2;
}
function filterThirdRepetitionMoves(state, pastStates, moves) {
    return moves.filter(move => !wouldCauseThirdRepetition(state, pastStates, move));
}
/**
 * Returns true if the current position has already appeared
 * >= (REPETITION_DRAW_THRESHOLD - 1) times in pastStates,
 * meaning it is now appearing for the Nth time => draw.
 */
function isRepetitionDraw(current, pastStates) {
    const key = getPositionKey(current);
    return countPositionKey(pastStates, key) >= exports.REPETITION_DRAW_THRESHOLD - 1;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_REPEAT_END_MESSAGE = exports.THIRD_REPETITION_MESSAGE = void 0;
exports.getPositionKey = getPositionKey;
exports.getPositionKeyAfterMove = getPositionKeyAfterMove;
exports.countPositionKey = countPositionKey;
exports.wouldCauseThirdRepetition = wouldCauseThirdRepetition;
exports.filterThirdRepetitionMoves = filterThirdRepetitionMoves;
const gameEngine_1 = require("./gameEngine");
exports.THIRD_REPETITION_MESSAGE = '此手會造成第三次重複局面';
exports.AI_REPEAT_END_MESSAGE = '無可避免重複，對局結束';
function getPositionKey(state) {
    const rows = state.board.map(row => row.map(piece => {
        if (!piece)
            return 'empty';
        return `${piece.side}:${piece.revealed ? '1' : '0'}:${piece.realType}`;
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncLastMove = syncLastMove;
exports.cancelLastMoveSync = cancelLastMoveSync;
const gameState_1 = require("./gameState");
function syncLastMove(state, from, to) {
    const next = (0, gameState_1.applyMove)(state, from, to);
    return {
        state: next,
        applied: next !== state,
    };
}
function cancelLastMoveSync(state) {
    return state;
}

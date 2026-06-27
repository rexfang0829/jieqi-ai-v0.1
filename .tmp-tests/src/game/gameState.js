"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newGame = newGame;
exports.applyMove = applyMove;
const initialBoard_1 = require("./initialBoard");
const checkRules_1 = require("./checkRules");
function newGame() {
    return { board: (0, initialBoard_1.createInitialBoard)(), turn: 'red', history: [], status: 'playing' };
}
function applyMove(state, from, to) {
    if (state.status !== 'playing')
        return state;
    const legal = (0, checkRules_1.getAllLegalMoves)(state.board, state.turn).find(m => m.from.row === from.row && m.from.col === from.col && m.to.row === to.row && m.to.col === to.col);
    if (!legal)
        return state;
    const board = state.board.map(row => row.map(p => p ? { ...p } : null));
    const moving = board[from.row][from.col];
    const captured = board[to.row][to.col];
    const flipped = !moving.revealed;
    board[to.row][to.col] = { ...moving, revealed: true };
    board[from.row][from.col] = null;
    const move = {
        from,
        to,
        piece: moving,
        captured,
        capturedWasHidden: captured ? !captured.revealed : undefined,
        captureKind: captured ? (captured.revealed ? 'revealed' : 'hidden') : undefined,
        flipped,
    };
    const nextTurn = state.turn === 'red' ? 'black' : 'red';
    const status = (0, checkRules_1.getAllLegalMoves)(board, nextTurn).length === 0
        ? (state.turn === 'red' ? 'red_win' : 'black_win')
        : 'playing';
    return { ...state, board, turn: nextTurn, history: [...state.history, move], status };
}

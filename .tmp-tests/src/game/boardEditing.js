"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyBoard = createEmptyBoard;
exports.createEditablePiece = createEditablePiece;
exports.editSquare = editSquare;
exports.editSquareError = editSquareError;
exports.clearSquare = clearSquare;
exports.clearBoard = clearBoard;
exports.setTurn = setTurn;
exports.revealHotkeyType = revealHotkeyType;
exports.revealSelectedByHotkey = revealSelectedByHotkey;
exports.correctSelectedRealType = correctSelectedRealType;
const pieceInventory_1 = require("./pieceInventory");
function createEmptyBoard() {
    return Array.from({ length: 10 }, () => Array(9).fill(null));
}
function createEditablePiece(draft) {
    return {
        id: `edit-${draft.side}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        side: draft.side,
        originalType: draft.originalType,
        realType: draft.realType,
        revealed: draft.revealed,
    };
}
function editSquare(state, pos, patch, fallback) {
    const current = state.board[pos.row][pos.col];
    if (!current && !fallback)
        return state;
    const board = state.board.map(row => row.map(piece => piece ? { ...piece } : null));
    board[pos.row][pos.col] = current
        ? { ...current, ...patch }
        : createEditablePiece({ ...fallback, ...patch });
    const piece = board[pos.row][pos.col];
    if (!piece)
        return state;
    const reconciled = (0, pieceInventory_1.reconcileHiddenRealTypes)(board, piece.side);
    if (!reconciled)
        return state;
    return {
        ...state,
        board: reconciled,
        status: 'playing',
    };
}
function editSquareError(state, pos, patch, fallback) {
    const current = state.board[pos.row][pos.col];
    if (!current && !fallback)
        return null;
    const side = patch.side ?? current?.side ?? fallback.side;
    const realType = patch.realType ?? current?.realType ?? fallback.realType;
    const revealed = patch.revealed ?? current?.revealed ?? fallback.revealed;
    if (!revealed)
        return null;
    return (0, pieceInventory_1.inventoryError)(state.board, pos, side, realType);
}
function clearSquare(state, pos) {
    if (!state.board[pos.row][pos.col])
        return state;
    const board = state.board.map(row => row.map(piece => piece ? { ...piece } : null));
    board[pos.row][pos.col] = null;
    return {
        ...state,
        board,
        status: 'playing',
    };
}
function clearBoard(state) {
    return {
        ...state,
        board: createEmptyBoard(),
        history: [],
        status: 'playing',
    };
}
function setTurn(state, turn) {
    return {
        ...state,
        turn,
        status: 'playing',
    };
}
function revealHotkeyType(key) {
    const mapping = {
        '1': 'rook',
        '2': 'horse',
        '3': 'elephant',
        '4': 'advisor',
        '5': 'cannon',
        '6': 'pawn',
    };
    return mapping[key] ?? null;
}
function revealSelectedByHotkey(state, selected, key) {
    const realType = revealHotkeyType(key);
    if (!selected || !realType)
        return state;
    if (!state.board[selected.row][selected.col])
        return state;
    return editSquare(state, selected, {
        realType,
        revealed: true,
    });
}
function correctSelectedRealType(state, selected, realType) {
    if (!selected)
        return state;
    if (!state.board[selected.row][selected.col])
        return state;
    return editSquare(state, selected, {
        realType,
        revealed: true,
    });
}

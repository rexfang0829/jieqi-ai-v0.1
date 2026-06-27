"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSITION_STORAGE_KEY = void 0;
exports.toSavedPosition = toSavedPosition;
exports.fromSavedPosition = fromSavedPosition;
exports.savePosition = savePosition;
exports.loadPosition = loadPosition;
exports.POSITION_STORAGE_KEY = 'jieqi-ai.savedPosition.v1';
function isSide(value) {
    return value === 'red' || value === 'black';
}
function isStatus(value) {
    return value === 'playing' || value === 'red_win' || value === 'black_win' || value === 'draw';
}
function isBoard(value) {
    return Array.isArray(value) &&
        value.length === 10 &&
        value.every(row => Array.isArray(row) && row.length === 9);
}
function isSavedPosition(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    return isBoard(data.board) && isSide(data.turn) && isStatus(data.status);
}
function toSavedPosition(state) {
    return {
        board: state.board,
        turn: state.turn,
        status: state.status,
    };
}
function fromSavedPosition(saved) {
    return {
        board: saved.board.map(row => row.map(piece => piece ? { ...piece } : null)),
        turn: saved.turn,
        status: saved.status,
        history: [],
    };
}
function savePosition(storage, state) {
    if (!storage)
        return false;
    storage.setItem(exports.POSITION_STORAGE_KEY, JSON.stringify(toSavedPosition(state)));
    return true;
}
function loadPosition(storage) {
    if (!storage)
        return null;
    try {
        const raw = storage.getItem(exports.POSITION_STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!isSavedPosition(parsed))
            return null;
        return fromSavedPosition(parsed);
    }
    catch {
        return null;
    }
}

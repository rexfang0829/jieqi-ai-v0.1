"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pieceName = pieceName;
exports.Square = Square;
const jsx_runtime_1 = require("react/jsx-runtime");
function pieceName(piece) {
    const red = { king: '帥', advisor: '仕', elephant: '相', rook: '俥', horse: '傌', cannon: '炮', pawn: '兵' };
    const black = { king: '將', advisor: '士', elephant: '象', rook: '車', horse: '馬', cannon: '砲', pawn: '卒' };
    return (piece.side === 'red' ? red : black)[piece.realType];
}
function Square({ piece, selected, legal, onClick }) {
    return ((0, jsx_runtime_1.jsx)("button", { className: `square ${selected ? 'selected' : ''} ${legal ? 'legal' : ''}`, onClick: onClick, children: piece && ((0, jsx_runtime_1.jsx)("div", { className: `piece ${piece.side} ${piece.revealed ? 'revealed' : 'hidden'}`, children: piece.revealed ? pieceName(piece) : '' })) }));
}

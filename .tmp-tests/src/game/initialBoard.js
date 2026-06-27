"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialBoard = createInitialBoard;
const layout = [
    ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook'],
    [null, null, null, null, null, null, null, null, null],
    [null, 'cannon', null, null, null, null, null, 'cannon', null],
    ['pawn', null, 'pawn', null, 'pawn', null, 'pawn', null, 'pawn'],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    ['pawn', null, 'pawn', null, 'pawn', null, 'pawn', null, 'pawn'],
    [null, 'cannon', null, null, null, null, null, 'cannon', null],
    [null, null, null, null, null, null, null, null, null],
    ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook'],
];
const redPool = ['advisor', 'advisor', 'elephant', 'elephant', 'rook', 'rook', 'horse', 'horse', 'cannon', 'cannon', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];
const blackPool = ['advisor', 'advisor', 'elephant', 'elephant', 'rook', 'rook', 'horse', 'horse', 'cannon', 'cannon', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];
function shuffle(items) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function makePiece(side, originalType, realType, index) {
    return {
        id: `${side}-${index}-${Math.random().toString(36).slice(2)}`,
        side,
        originalType,
        realType,
        revealed: originalType === 'king',
    };
}
function createInitialBoard() {
    const board = Array.from({ length: 10 }, () => Array(9).fill(null));
    const pools = { red: shuffle(redPool), black: shuffle(blackPool) };
    let redI = 0, blackI = 0;
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 9; col++) {
            const originalType = layout[row][col];
            if (!originalType)
                continue;
            const side = row <= 4 ? 'black' : 'red';
            if (originalType === 'king') {
                board[row][col] = makePiece(side, originalType, 'king', side === 'red' ? redI : blackI);
                continue;
            }
            const realType = side === 'red' ? pools.red[redI++] : pools.black[blackI++];
            board[row][col] = makePiece(side, originalType, realType, side === 'red' ? redI : blackI);
        }
    }
    return board;
}

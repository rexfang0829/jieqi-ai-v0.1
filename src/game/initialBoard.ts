import type { Board, Piece, PieceType, Side } from '../types/chess';

const layout: (PieceType | null)[][] = [
  ['rook','horse','elephant','advisor','king','advisor','elephant','horse','rook'],
  [null,null,null,null,null,null,null,null,null],
  [null,'cannon',null,null,null,null,null,'cannon',null],
  ['pawn',null,'pawn',null,'pawn',null,'pawn',null,'pawn'],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  ['pawn',null,'pawn',null,'pawn',null,'pawn',null,'pawn'],
  [null,'cannon',null,null,null,null,null,'cannon',null],
  [null,null,null,null,null,null,null,null,null],
  ['rook','horse','elephant','advisor','king','advisor','elephant','horse','rook'],
];

const redPool: PieceType[] = ['advisor','advisor','elephant','elephant','rook','rook','horse','horse','cannon','cannon','pawn','pawn','pawn','pawn','pawn'];
const blackPool: PieceType[] = ['advisor','advisor','elephant','elephant','rook','rook','horse','horse','cannon','cannon','pawn','pawn','pawn','pawn','pawn'];

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePiece(side: Side, originalType: PieceType, realType: PieceType, index: number): Piece {
  return {
    id: `${side}-${index}-${Math.random().toString(36).slice(2)}`,
    side,
    originalType,
    realType,
    revealed: originalType === 'king',
  };
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const pools = { red: shuffle(redPool), black: shuffle(blackPool) };
  let redI = 0, blackI = 0;

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const originalType = layout[row][col];
      if (!originalType) continue;

      const side: Side = row <= 4 ? 'black' : 'red';
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

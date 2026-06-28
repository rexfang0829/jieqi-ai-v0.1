export type Side = 'red' | 'black';
export type PieceType = 'king' | 'advisor' | 'elephant' | 'rook' | 'horse' | 'cannon' | 'pawn';

export type Position = { row: number; col: number };

export type Piece = {
  id: string;
  side: Side;
  originalType: PieceType;
  realType: PieceType;
  revealed: boolean;
};

export type Board = (Piece | null)[][];

export type Move = {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece | null;
  capturedWasHidden?: boolean;
  captureKind?: 'hidden' | 'revealed';
  flipped?: boolean;
  notationPrefix?: '前' | '後';
};

export type GameStatus = 'playing' | 'red_win' | 'black_win' | 'draw';

export type GameState = {
  board: Board;
  turn: Side;
  history: Move[];
  status: GameStatus;
};

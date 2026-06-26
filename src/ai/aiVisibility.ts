import type { Board, GameState, GameStatus, Move, Piece, PieceType, Position, Side } from '../types/chess';

export type AiVisiblePiece = {
  id: string;
  side: Side;
  originalType: PieceType;
  revealed: boolean;
  /**
   * 只有 revealed=true 時才存在。
   * revealed=false 時必須是 undefined。
   */
  realType?: PieceType;
};

export type AiVisibleBoard = (AiVisiblePiece | null)[][];

export type AiVisibleMove = {
  from: Position;
  to: Position;
  piece: AiVisiblePiece;
  captured?: AiVisiblePiece | null;
  capturedWasHidden?: boolean;
  captureKind?: 'hidden' | 'revealed';
  flipped?: boolean;
};

export type AiVisibleState = {
  board: AiVisibleBoard;
  turn: Side;
  history: AiVisibleMove[];
  status: GameStatus;
  perspectiveSide: Side;
};

function toVisiblePiece(piece: Piece): AiVisiblePiece {
  if (piece.revealed) {
    return {
      id: piece.id,
      side: piece.side,
      originalType: piece.originalType,
      revealed: true,
      realType: piece.realType,
    };
  }
  // 未翻棋子：不帶 realType，確保公平資訊
  return {
    id: piece.id,
    side: piece.side,
    originalType: piece.originalType,
    revealed: false,
  };
}

function toMaskedPiece(piece: AiVisiblePiece): Piece {
  return {
    id: piece.id,
    side: piece.side,
    originalType: piece.originalType,
    revealed: piece.revealed,
    // 關鍵：未翻子一律把 realType mask 成 originalType
    realType: piece.revealed ? piece.realType! : piece.originalType,
  };
}

function toVisibleMove(move: Move): AiVisibleMove {
  return {
    from: move.from,
    to: move.to,
    piece: toVisiblePiece(move.piece),
    captured: move.captured != null ? toVisiblePiece(move.captured) : (move.captured as null | undefined),
    capturedWasHidden: move.capturedWasHidden,
    captureKind: move.captureKind,
    flipped: move.flipped,
  };
}

function fromVisibleMove(move: AiVisibleMove): Move {
  return {
    from: move.from,
    to: move.to,
    piece: toMaskedPiece(move.piece),
    captured: move.captured != null ? toMaskedPiece(move.captured) : (move.captured as null | undefined),
    capturedWasHidden: move.capturedWasHidden,
    captureKind: move.captureKind,
    flipped: move.flipped,
  };
}

/**
 * 建立 AI 公平資訊視圖。
 * unrevealed piece 不帶 realType，確保 AI 無法偷看。
 */
export function createAiView(state: GameState, perspectiveSide: Side): AiVisibleState {
  return {
    board: state.board.map(row =>
      row.map(piece => piece ? toVisiblePiece(piece) : null)
    ),
    turn: state.turn,
    status: state.status,
    perspectiveSide,
    history: state.history.map(toVisibleMove),
  };
}

/**
 * MVP 過渡 adapter：將 AiVisibleState 轉回 GameState，
 * 未翻棋子的 realType 一律 mask 成 originalType。
 * 讓現有 recommendMove() 可以暫時吃 masked state。
 */
export function visibleStateToMaskedGameState(view: AiVisibleState): GameState {
  const board: Board = view.board.map(row =>
    row.map(piece => piece ? toMaskedPiece(piece) : null)
  );
  return {
    board,
    turn: view.turn,
    status: view.status,
    history: view.history.map(fromVisibleMove),
  };
}

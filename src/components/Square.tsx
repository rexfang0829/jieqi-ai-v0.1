import type { Piece, PieceType, Side } from '../types/chess';

const names: Record<Side, Record<PieceType, string>> = {
  red: {
    king: '帥',
    advisor: '仕',
    elephant: '相',
    rook: '車',
    horse: '馬',
    cannon: '炮',
    pawn: '兵',
  },
  black: {
    king: '將',
    advisor: '士',
    elephant: '象',
    rook: '車',
    horse: '馬',
    cannon: '炮',
    pawn: '卒',
  },
};

export function pieceName(piece: Piece): string {
  return names[piece.side][piece.realType];
}

export function Square({ piece, selected, legal, onClick }: { piece: Piece | null; selected: boolean; legal: boolean; onClick: () => void }) {
  return (
    <button className={`square ${selected ? 'selected' : ''} ${legal ? 'legal' : ''}`} onClick={onClick}>
      {piece && (
        <div className={`piece ${piece.side} ${piece.revealed ? 'revealed' : 'hidden'}`}>
          {piece.revealed ? pieceName(piece) : ''}
        </div>
      )}
    </button>
  );
}

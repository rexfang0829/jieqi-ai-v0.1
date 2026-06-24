import type { Piece } from '../types/chess';

export function pieceName(piece: Piece): string {
  const red: Record<string,string> = { king:'帥', advisor:'仕', elephant:'相', rook:'俥', horse:'傌', cannon:'炮', pawn:'兵' };
  const black: Record<string,string> = { king:'將', advisor:'士', elephant:'象', rook:'車', horse:'馬', cannon:'砲', pawn:'卒' };
  return (piece.side === 'red' ? red : black)[piece.realType];
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

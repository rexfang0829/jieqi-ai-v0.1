import type { Piece } from '../types/chess';
import { realPieceName } from '../game/pieceText';

export function pieceName(piece: Piece): string {
  return realPieceName(piece);
}

export function Square({ piece, selected, syncOrigin = false, legal, onClick }: { piece: Piece | null; selected: boolean; syncOrigin?: boolean; legal: boolean; onClick: () => void }) {
  return (
    <button className={`square ${selected ? 'selected' : ''} ${syncOrigin ? 'syncOrigin' : ''} ${legal ? 'legal' : ''} ${legal && piece ? 'captureTarget' : ''}`} onClick={onClick}>
      {piece && (
        <div className={`piece ${piece.side} ${piece.revealed ? 'revealed' : 'hidden'}`}>
          {piece.revealed ? pieceName(piece) : ''}
        </div>
      )}
    </button>
  );
}

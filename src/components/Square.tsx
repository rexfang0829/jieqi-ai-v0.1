import React from 'react';
import type { Piece } from '../types/chess';
import { realPieceName } from '../game/pieceText';

export function pieceName(piece: Piece): string {
  return realPieceName(piece);
}

export function Square({ piece, selected, syncOrigin = false, legal, onClick, onLongPress }: { piece: Piece | null; selected: boolean; syncOrigin?: boolean; legal: boolean; onClick: () => void; onLongPress?: () => void }) {
  const timer = React.useRef(null) as { current: number | null };
  const longPressed = React.useRef(false) as { current: boolean };

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function pointerDown() {
    if (!piece || !onLongPress) return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onLongPress();
    }, 520);
  }

  function click(event: any) {
    if (longPressed.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressed.current = false;
      return;
    }
    onClick();
  }

  return (
    <button
      className={`square ${selected ? 'selected' : ''} ${syncOrigin ? 'syncOrigin' : ''} ${legal ? 'legal' : ''} ${legal && piece ? 'captureTarget' : ''}`}
      onClick={click}
      onPointerDown={pointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event: any) => {
        if (piece && onLongPress) {
          event.preventDefault();
          onLongPress();
        }
      }}
    >
      {piece && (
        <div className={`piece ${piece.side} ${piece.revealed ? 'revealed' : 'hidden'}`}>
          {piece.revealed ? pieceName(piece) : ''}
        </div>
      )}
    </button>
  );
}

import { useRef, type MouseEvent, type PointerEvent } from 'react';
import type { Piece } from '../types/chess';
import { realPieceName } from '../game/pieceText';

export function pieceName(piece: Piece): string {
  return realPieceName(piece);
}

export type LongPressAnchor = { x: number; y: number };

export function Square({ piece, selected, syncOrigin = false, legal, onClick, onLongPress }: { piece: Piece | null; selected: boolean; syncOrigin?: boolean; legal: boolean; onClick: () => void; onLongPress?: (anchor: LongPressAnchor) => void }) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const anchor = useRef<LongPressAnchor>({ x: 0, y: 0 });

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!piece || !onLongPress) return;
    const rect = event.currentTarget.getBoundingClientRect();
    anchor.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onLongPress(anchor.current);
    }, 520);
  }

  function click(event: MouseEvent<HTMLButtonElement>) {
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
      onContextMenu={(event: MouseEvent<HTMLButtonElement>) => {
        if (piece && onLongPress) {
          event.preventDefault();
          onLongPress({ x: event.clientX, y: event.clientY });
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

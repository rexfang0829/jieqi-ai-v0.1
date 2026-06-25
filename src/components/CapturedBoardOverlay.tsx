import type { Move } from '../types/chess';
import { getCapturedBoardStacks, type CapturedBoardPiece } from '../game/capturedPieces';

function CapturedMiniPiece({ piece }: { piece: CapturedBoardPiece; key?: string }) {
  return (
    <span
      className={`capturedMiniPiece ${piece.side} ${piece.hiddenBeforeCapture ? 'hiddenCapturedMini' : ''}`}
      title={piece.label}
      aria-label={piece.label}
    >
      {piece.name}
    </span>
  );
}

function CapturedStack({ className, pieces }: { className: string; pieces: CapturedBoardPiece[] }) {
  if (!pieces.length) return null;
  return (
    <div className={`capturedBoardStack ${className}`} aria-hidden="false">
      {pieces.map((piece, index) => (
        <CapturedMiniPiece key={`${piece.side}-${piece.name}-${piece.kind}-${index}`} piece={piece} />
      ))}
    </div>
  );
}

/** position="left"  → red's captures, bottom-left of board
 *  position="right" → black's captures, top-right of board */
export function CapturedBoardOverlay({ moves, position }: { moves: Move[]; position: 'left' | 'right' }) {
  const stacks = getCapturedBoardStacks(moves);
  if (position === 'left') {
    return (
      <div className="capturedBoardOverlay capturedOverlayLeft">
        <CapturedStack className="capturedBottomLeft" pieces={stacks.bottomLeft} />
      </div>
    );
  }
  return (
    <div className="capturedBoardOverlay capturedOverlayRight">
      <CapturedStack className="capturedTopRight" pieces={stacks.topRight} />
    </div>
  );
}

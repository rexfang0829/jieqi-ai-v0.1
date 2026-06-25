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

export function CapturedBoardOverlay({ moves }: { moves: Move[] }) {
  const stacks = getCapturedBoardStacks(moves);
  return (
    <div className="capturedBoardOverlay">
      <CapturedStack className="capturedTopLeft" pieces={stacks.topLeft} />
      <CapturedStack className="capturedBottomLeft" pieces={stacks.bottomLeft} />
    </div>
  );
}

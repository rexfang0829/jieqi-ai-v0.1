import { useEffect, useRef } from 'react';
import type { Move } from '../types/chess';
import { moveText } from '../game/moveNotation';

/** 普通列表模式（打譜面板用） */
function MoveListPlain({ moves }: { moves: Move[] }) {
  return (
    <div className="panel">
      <h3>棋譜</h3>
      <ol>
        {moves.map((m, i) => (
          <li
            key={i}
            className={
              m.captureKind === 'hidden'
                ? 'hiddenCapture'
                : m.captureKind === 'revealed'
                ? 'revealedCapture'
                : ''
            }
          >
            {moveText(m)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 回放模式：水平捲動可點選步驟 */
function MoveListPlayback({
  moves,
  activeStep,
  onStepClick,
}: {
  moves: Move[];
  activeStep: number;
  onStepClick: (step: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeStep]);

  return (
    <div className="playbackMoveScroll" aria-label="棋譜步驟">
      {moves.map((m, i) => {
        const step = i + 1;
        const isActive = activeStep === step;
        return (
          <button
            key={i}
            ref={isActive ? activeRef : null}
            className={`playbackMoveChip${isActive ? ' active' : ''}`}
            onClick={() => onStepClick(step)}
            aria-current={isActive || undefined}
          >
            {step}.{moveText(m)}
          </button>
        );
      })}
    </div>
  );
}

export function MoveList({
  moves,
  activeStep,
  onStepClick,
}: {
  moves: Move[];
  activeStep?: number;
  onStepClick?: (step: number) => void;
}) {
  if (onStepClick !== undefined && activeStep !== undefined) {
    return (
      <MoveListPlayback moves={moves} activeStep={activeStep} onStepClick={onStepClick} />
    );
  }
  return <MoveListPlain moves={moves} />;
}

import type { Move, Side } from '../types/chess';
import { getCapturedPieces } from '../game/capturedPieces';

const sideLabel: Record<Side, string> = {
  red: '紅方被吃',
  black: '黑方被吃',
};

function countText(items: { label: string }[]) {
  return items.length ? items.map(item => item.label).join('、') : '無';
}

export function CapturedPanel({ moves }: { moves: Move[] }) {
  const captured = getCapturedPieces(moves);

  return (
    <div className="panel capturedPanel compactCapturedPanel">
      <h3>被吃子輔助資訊</h3>
      {(['red', 'black'] as const).map(side => (
        <p key={side}>
          <strong>{sideLabel[side]}</strong>
          <span>明：{countText(captured[side].revealed)}</span>
          <span>暗：{countText(captured[side].hidden)}</span>
        </p>
      ))}
    </div>
  );
}

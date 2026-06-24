import type { Move, Side } from '../types/chess';
import { getCapturedPieces } from '../game/capturedPieces';

const sideLabel: Record<Side, string> = {
  red: '紅方被吃',
  black: '黑方被吃',
};

function PieceList({ title, items }: { title: string; items: { label: string }[] }) {
  return (
    <div className="capturedGroup">
      <span>{title}</span>
      {items.length ? (
        <div className="capturedPieces">
          {items.map((item, index) => <em key={`${item.label}-${index}`}>{item.label}</em>)}
        </div>
      ) : (
        <small>無</small>
      )}
    </div>
  );
}

export function CapturedPanel({ moves }: { moves: Move[] }) {
  const captured = getCapturedPieces(moves);

  return (
    <div className="panel capturedPanel">
      <h3>被吃子資訊</h3>
      {(['red', 'black'] as const).map(side => (
        <section key={side} className="capturedSide">
          <h4>{sideLabel[side]}</h4>
          <PieceList title="明" items={captured[side].revealed} />
          <PieceList title="暗" items={captured[side].hidden} />
        </section>
      ))}
    </div>
  );
}

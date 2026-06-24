import type { Move } from '../types/chess';
import { moveText } from '../game/moveNotation';

export function MoveList({ moves }: { moves: Move[] }) {
  return (
    <div className="panel">
      <h3>棋譜</h3>
      <ol>{moves.map((m, i) => <li key={i} className={m.captureKind === 'hidden' ? 'hiddenCapture' : m.captureKind === 'revealed' ? 'revealedCapture' : ''}>{moveText(m)}</li>)}</ol>
    </div>
  );
}

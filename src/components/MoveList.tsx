import type { Move } from '../types/chess';
import { moveText } from '../game/moveNotation';

export function MoveList({ moves }: { moves: Move[] }) {
  return <div className="panel"><h3>走法紀錄</h3><ol>{moves.map((m,i)=><li key={i}>{moveText(m)}</li>)}</ol></div>;
}

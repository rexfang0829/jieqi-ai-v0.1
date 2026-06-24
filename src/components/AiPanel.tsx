import type { GameState } from '../types/chess';
import { recommendMove } from '../ai/simpleAi';
import { moveText } from '../game/moveNotation';

export function AiPanel({ state }: { state: GameState }) {
  const r = recommendMove(state);
  return <div className="panel"><h3>AI 推薦</h3>{r.move ? <><p>{moveText(r.move)}</p><p>分數：{r.score}</p><p>{r.reason}</p></> : <p>{r.reason}</p>}</div>;
}

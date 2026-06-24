import type { GameState } from '../types/chess';
import { recommendMove } from '../ai/simpleAi';
import { SIMPLE_AI_NOTE, SIMPLE_AI_TITLE } from '../ai/simpleAiText';
import { getEndgameFeedback } from '../game/endgameFeedback';
import { moveText } from '../game/moveNotation';

export function AiPanel({ state }: { state: GameState }) {
  const endgame = getEndgameFeedback(state.status);
  if (endgame) {
    return (
      <div className="panel aiEndgamePanel">
        <h3>{endgame.title}</h3>
        <p>{endgame.body}</p>
        <p>{endgame.winnerText}</p>
      </div>
    );
  }

  const r = recommendMove(state);
  return (
    <div className="panel aiPanel">
      <h3>{SIMPLE_AI_TITLE}</h3>
      <p className="aiDisclaimer">{SIMPLE_AI_NOTE}</p>
      {r.move ? (
        <>
          <p>{moveText(r.move)}</p>
          <p>分數：{r.score}</p>
          <p>{r.reason}</p>
        </>
      ) : (
        <p>{r.reason}</p>
      )}
    </div>
  );
}

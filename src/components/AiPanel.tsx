import { useState } from 'react';
import type { GameState, Move } from '../types/chess';
import { recommendMoveOracle } from '../ai/simpleAi';
import { SIMPLE_AI_NOTE, SIMPLE_AI_TITLE } from '../ai/simpleAiText';
import { getEndgameFeedback } from '../game/endgameFeedback';
import { moveText } from '../game/moveNotation';
import { formatAiDebugReport } from '../ai/aiDebugReport';

type Props = {
  state: GameState;
  version?: number;
  modeName?: string;
  analysisMoves?: Move[];
};

export function AiPanel({ state, version: _version, modeName, analysisMoves }: Props) {
  const [copied, setCopied] = useState(false);

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

  const r = recommendMoveOracle(state);

  function copyReport() {
    const text = formatAiDebugReport({
      modeName: modeName ?? '輔助盤面',
      state,
      analysisMoves,
      recommendation: r,
    });
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      /* clipboard unavailable -- silently ignore */
    });
  }

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
        <p>目前沒有可建議的合法步</p>
      )}
      <div style={{ marginTop: 8 }}>
        <button onClick={copyReport} style={{ fontSize: 13 }}>
          複製 AI 測試報告
        </button>
        {copied && (
          <span style={{ marginLeft: 10, color: '#86efac', fontSize: 13 }}>
            已複製 AI 測試報告
          </span>
        )}
      </div>
    </div>
  );
}

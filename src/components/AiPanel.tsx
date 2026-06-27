import { useState } from 'react';
import type { GameState, Move } from '../types/chess';
import { buildAiPanelDebugReport, getAiPanelRecommendations } from '../ai/aiPanelRecommendations';
import { SIMPLE_AI_NOTE } from '../ai/simpleAiText';
import { getEndgameFeedback } from '../game/endgameFeedback';
import { moveText } from '../game/moveNotation';

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

  const { fair: r, oracle, differs } = getAiPanelRecommendations(state);

  function copyReport() {
    const text = buildAiPanelDebugReport({
      modeName: modeName ?? 'AI panel',
      state,
      analysisMoves,
      fair: r,
      oracle,
      differs,
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
      <h3>Fair AI 推薦</h3>
      <p className="aiDisclaimer">{SIMPLE_AI_NOTE}</p>
      {r.move ? (
        <>
          <p>{moveText(r.move)}</p>
          <p>分數：{r.score}</p>
          <p>{r.reason}</p>
        </>
      ) : (
        <p>沒有合法走法</p>
      )}

      <div style={{ marginTop: 10, fontSize: 13 }}>
        <strong>天眼 Debug 推薦</strong>
        {oracle.move ? (
          <>
            <p>{moveText(oracle.move)}</p>
            <p>分數：{oracle.score}</p>
            <p>{oracle.reason}</p>
          </>
        ) : (
          <p>沒有合法走法</p>
        )}
        {differs && (
          <p className="aiDisclaimer">
            正式 AI 不看未翻 realType；天眼 Debug 可看完整資訊，因此推薦可能不同。
          </p>
        )}
      </div>

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

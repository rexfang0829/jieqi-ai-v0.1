import type { GameState, Move } from '../types/chess';
import { moveText } from '../game/moveNotation';
import { formatAiDebugReport } from './aiDebugReport';
import type { AiRecommendation } from './aiTrace';
import { recommendMoveFair, recommendMoveOracle } from './simpleAi';

function sameMove(a: Move | null, b: Move | null): boolean {
  if (!a || !b) return a === b;
  return a.from.row === b.from.row &&
    a.from.col === b.from.col &&
    a.to.row === b.to.row &&
    a.to.col === b.to.col;
}

export function getAiPanelRecommendations(state: GameState): {
  fair: AiRecommendation;
  oracle: AiRecommendation;
  differs: boolean;
} {
  const fair = recommendMoveFair(state);
  const oracle = recommendMoveOracle(state);
  return { fair, oracle, differs: !sameMove(fair.move, oracle.move) };
}

export function buildAiPanelDebugReport(input: {
  modeName?: string;
  state: GameState;
  analysisMoves?: Move[];
  fair: AiRecommendation;
  oracle: AiRecommendation;
  differs: boolean;
}): string {
  const main = formatAiDebugReport({
    modeName: `${input.modeName ?? 'AI panel'} / Fair AI`,
    state: input.state,
    analysisMoves: input.analysisMoves,
    recommendation: input.fair,
  });
  const oracleMove = input.oracle.move ? moveText(input.oracle.move) : 'no move';
  const oracleBlock = [
    '',
    '--- Oracle / Debug recommendation ---',
    'Oracle sees full hidden realType and is not the official Fair AI recommendation.',
    `move: ${oracleMove}`,
    `score: ${input.oracle.score}`,
    `reason: ${input.oracle.reason}`,
  ];
  if (input.differs) {
    oracleBlock.unshift(
      '',
      'Fair AI does not read unrevealed realType; Oracle / Debug can see full information, so recommendations may differ.'
    );
  }
  return [main, ...oracleBlock].join('\n');
}

import type { GameState, Move } from '../types/chess';
import type { AiMoveTrace, AiRecommendation } from './aiTrace';
import { moveText } from '../game/moveNotation';

/** Context passed into formatAiDebugReport. */
export type AiDebugReportInput = {
  modeName: string;
  state: GameState;
  /** Extra moves from analysis variation (optional). */
  analysisMoves?: Move[];
  recommendation: AiRecommendation;
};

function bool(v: boolean | undefined | null): string {
  if (v === undefined || v === null) return '-';
  return v ? 'true' : 'false';
}

function num(v: number | undefined | null): string {
  if (v === undefined || v === null) return '-';
  return String(v);
}

function fmtTrace(t: AiMoveTrace): string {
  const lines: string[] = [
    '  棋步：' + moveText(t.move),
    '  score：' + t.score,
    '  reason：' + t.reason,
    '  patterns：' + (t.patterns?.join(', ') || '（無）'),
    '  structureScore：' + num(t.structureScore),
    '  exchangeNet：' + num(t.exchangeNet),
    '  risk：' + num(t.risk),
    '  captureGain：' + num(t.captureGain),
    '  threatValue：' + num(t.threatValue),
    '  threatDelta：' + num(t.threatDelta),
    '  threatByMovedPiece：' + bool(t.threatByMovedPiece),
    '  moveRevealsUnknown：' + bool(t.moveRevealsUnknown),
    '  revealTacticalSuppressed：' + bool(t.revealTacticalSuppressed),
    '  edgeCannonPressureUnresolved：' + bool(t.edgeCannonPressureUnresolved),
    '  speculativeAttack：' + bool(t.speculativeAttack),
    '  safeCapturePriority：' + bool(t.safeCapturePriority),
    '  repetitiveCheck：' + bool(t.repetitiveCheck),
    '  revealChoiceRisk：' + bool(t.revealChoiceRisk ?? false),
    '  revealChoicePenalty：' + num(t.revealChoicePenalty ?? 0),
    '  openingMajorGoal：' + bool(t.openingMajorGoal ?? false),
    '  majorActivation：' + bool(t.majorActivation ?? false),
    '  opponentRevealSuppression：' + bool(t.opponentRevealSuppression ?? false),
  ];
  return lines.join('\n');
}

/** Format a human-readable AI debug report as plain text. */
export function formatAiDebugReport(input: AiDebugReportInput): string {
  const { modeName, state, analysisMoves, recommendation: r } = input;
  const lines: string[] = [];

  lines.push('=== AI 測試報告 ===');
  lines.push('模式：' + modeName);
  lines.push('輪到：' + (state.turn === 'red' ? '紅方' : '黑方'));
  lines.push('手數：' + state.history.length + (analysisMoves?.length ? '（+' + analysisMoves.length + ' 變化手）' : ''));

  /* Recent moves */
  const allMoves = [...state.history, ...(analysisMoves ?? [])];
  const recent = allMoves.slice(-10);
  if (recent.length > 0) {
    lines.push('');
    lines.push('--- 最近棋步（最後 ' + recent.length + ' 手）---');
    const offset = allMoves.length - recent.length;
    for (let i = 0; i < recent.length; i++) {
      lines.push((offset + i + 1) + '. ' + moveText(recent[i]));
    }
  }

  /* AI recommendation */
  lines.push('');
  lines.push('--- AI 建議 ---');
  if (r.move) {
    lines.push('推薦棋步：' + moveText(r.move));
    lines.push('分數：' + r.score);
    lines.push('reason：' + r.reason);
  } else {
    lines.push('（無合法棋步）');
  }

  /* Selected trace */
  const selectedTrace = r.traces?.find(t =>
    r.move &&
    t.move.from.row === r.move.from.row && t.move.from.col === r.move.from.col &&
    t.move.to.row === r.move.to.row && t.move.to.col === r.move.to.col
  );
  if (selectedTrace) {
    lines.push('');
    lines.push('--- 推薦步 trace ---');
    lines.push(fmtTrace(selectedTrace));
  }

  /* Top 5 candidates */
  const traces = r.traces;
  if (traces && traces.length > 0) {
    const top5 = [...traces].sort((a, b) => b.score - a.score).slice(0, 5);
    lines.push('');
    lines.push('--- 候選前 5 名 ---');
    for (let i = 0; i < top5.length; i++) {
      const t = top5[i];
      lines.push((i + 1) + '. ' + moveText(t.move) + '｜' + t.score + '｜' + t.reason);
    }
  }

  lines.push('');
  lines.push('==================');
  return lines.join('\n');
}

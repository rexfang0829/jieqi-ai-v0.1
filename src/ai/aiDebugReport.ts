import type { GameState, Move } from '../types/chess';
import type { AiMoveTrace, AiRecommendation } from './aiTrace';
import { moveText } from '../game/moveNotation';
import { pieceTypeName } from '../game/pieceText';

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
    '  hasUnrevealedPawnSoldiers: ' + bool(t.hasUnrevealedPawnSoldiers),
    '  pawnSoldierDevelopment: ' + bool(t.pawnSoldierDevelopment),
    '  pawnSoldierThreatRevealedMajor: ' + bool(t.pawnSoldierThreatRevealedMajor),
    '  pureBlindHorseActivation: ' + bool(t.pureBlindHorseActivation),
    '  pureBlindHorsePenalty: ' + num(t.pureBlindHorsePenalty),
    '  blindHorseStructureCapped: ' + bool(t.blindHorseStructureCapped),
    '  blindHorseMajorActivationCapped: ' + bool(t.blindHorseMajorActivationCapped),
    '  pawnSoldierFollowUpHorse: ' + bool(t.pawnSoldierFollowUpHorse),
    '  pawnSoldierHorseFootBlock: ' + bool(t.pawnSoldierHorseFootBlock),
    '  pawnSoldierFollowUpElephant: ' + bool(t.pawnSoldierFollowUpElephant),
    '  pawnSoldierCenterPreference: ' + bool(t.pawnSoldierCenterPreference),
    '  pawnSoldierFollowUpAdvisor: ' + bool(t.pawnSoldierFollowUpAdvisor),
    '  pawnSoldierAntiAdvisorFork: ' + bool(t.pawnSoldierAntiAdvisorFork),
    '  revealedMajorCaptureAvailable: ' + bool(t.revealedMajorCaptureAvailable),
    '  safeRevealedMajorCapture: ' + bool(t.safeRevealedMajorCapture),
    '  revealedMajorCaptureScore: ' + num(t.revealedMajorCaptureScore),
    '  pawnSoldierDelayedByMajorCapture: ' + bool(t.pawnSoldierDelayedByMajorCapture),
    '  deadMajorShouldCaptureNow: ' + bool(t.deadMajorShouldCaptureNow),
    '  deadMajorHoldSuppressedBySafeCapture: ' + bool(t.deadMajorHoldSuppressedBySafeCapture),
    '  pawnSoldierWalksIntoRevealedPawnAttack: ' + bool(t.pawnSoldierWalksIntoRevealedPawnAttack),
    '  pawnSoldierSelfSacrifice: ' + bool(t.pawnSoldierSelfSacrifice),
    '  pawnSoldierProtectedAfterAdvance: ' + bool(t.pawnSoldierProtectedAfterAdvance),
    '  pawnSoldierDevelopmentSuppressedByPawnAttack: ' + bool(t.pawnSoldierDevelopmentSuppressedByPawnAttack),
  '  repeatedCheckingCycle: ' + bool(t.repeatedCheckingCycle),
  '  repeatedPositionRisk: ' + bool(t.repeatedPositionRisk),
  '  repetitiveCheckSuppressed: ' + bool(t.repetitiveCheckSuppressed),
  '  repetitionCount: ' + num(t.repetitionCount),
    '  endgamePlanActive: ' + bool(t.endgamePlanActive),
    '  towardEnemyKing: ' + bool(t.towardEnemyKing),
    '  restrictKingMobility: ' + bool(t.restrictKingMobility),
    '  attackPalaceGuard: ' + bool(t.attackPalaceGuard),
    '  improveMajorActivity: ' + bool(t.improveMajorActivity),
    '  passedPawnAdvance: ' + bool(t.passedPawnAdvance),
    '  createNonCheckingThreat: ' + bool(t.createNonCheckingThreat),
    '  avoidAimlessMove: ' + bool(t.avoidAimlessMove),
    '  endgamePlanScore: ' + num(t.endgamePlanScore),
    '  hiddenMajorRecaptureRisk: ' + bool(t.hiddenMajorRecaptureRisk),
    '  unsafeEndgameCapture: ' + bool(t.unsafeEndgameCapture),
    '  unsafeCaptureExchangeNet: ' + num(t.unsafeCaptureExchangeNet),
    '  edgeRookPawnLineLockRisk: ' + bool(t.edgeRookPawnLineLockRisk),
    '  horsePawnLineGuard: ' + bool(t.horsePawnLineGuard),
    '  pawnSoldierDelayedByEdgeRookPressure: ' + bool(t.pawnSoldierDelayedByEdgeRookPressure),
    '  decisionLayer: ' + num(t.decisionLayer),
    '  decisionLayerLabel: ' + (t.decisionLayerLabel ?? '-'),
    '  safetyGateTriggered: ' + bool(t.safetyGateTriggered),
    '  highValuePieceInDanger: ' + bool(t.highValuePieceInDanger),
    '  resolvedHighValueThreat: ' + bool(t.resolvedHighValueThreat),
    '  unresolvedHighValueThreat: ' + bool(t.unresolvedHighValueThreat),
    '  ignoredHigherPriorityThreat: ' + bool(t.ignoredHigherPriorityThreat),
    '  postMoveLooseHiddenPiece: ' + bool(t.postMoveLooseHiddenPiece),
    '  postMoveProtectedUnderAttackCount: ' + num(t.postMoveProtectedUnderAttackCount),
    '  rescuesLooseHiddenPiece: ' + bool(t.rescuesLooseHiddenPiece),
    '  ignoresLooseHiddenPiece: ' + bool(t.ignoresLooseHiddenPiece),
    '  multiPurposeDefense: ' + bool(t.multiPurposeDefense),
    '  rescuesHighValuePiece: ' + bool(t.rescuesHighValuePiece),
    '  rescuesSecondaryPiece: ' + bool(t.rescuesSecondaryPiece),
    '  blocksHorseFork: ' + bool(t.blocksHorseFork),
    '  counterAttacksAttacker: ' + bool(t.counterAttacksAttacker),
    '  forcesOpponentChoice: ' + bool(t.forcesOpponentChoice),
    '  damageControl: ' + bool(t.damageControl),
    '  minimumLossDefense: ' + bool(t.minimumLossDefense),
    '  partialDefense: ' + bool(t.partialDefense),
    '  unresolvedThreatAfterDefense: ' + bool(t.unresolvedThreatAfterDefense),
    '  threatLossBefore: ' + num(t.threatLossBefore),
    '  threatLossAfter: ' + num(t.threatLossAfter),
    '  threatLossReduced: ' + num(t.threatLossReduced),
    '  checkingQuality: ' + (t.checkingQuality ?? '-'),
    '  checkingQualityScore: ' + num(t.checkingQualityScore),
    '  materialCheck: ' + bool(t.materialCheck),
    '  forcesBadKingMove: ' + bool(t.forcesBadKingMove),
    '  checkRestrictsKingMobility: ' + bool(t.checkRestrictsKingMobility),
    '  meaninglessCheck: ' + bool(t.meaninglessCheck),
    '  dynamicMoverValue: ' + num(t.dynamicMoverValue),
    '  dynamicTargetValue: ' + num(t.dynamicTargetValue),
    '  dynamicValuePhase: ' + (t.dynamicValuePhase ?? '-'),
    '  cannonFrameAdjustment: ' + num(t.cannonFrameAdjustment),
    '  horseMobilityAdjustment: ' + num(t.horseMobilityAdjustment),
    '  forcingMove: ' + bool(t.forcingMove),
    '  forcingTargetKind: ' + (t.forcingTargetKind ?? '-'),
    '  forcingTargetType: ' + (t.forcingTargetType ?? '-'),
    '  forcingTargetRevealed: ' + bool(t.forcingTargetRevealed),
    '  forcingTargetValue: ' + num(t.forcingTargetValue),
    '  forcingMoveQuality: ' + (t.forcingMoveQuality ?? '-'),
    '  forcingMoveProgress: ' + num(t.forcingMoveProgress),
    '  unproductiveForcingMove: ' + bool(t.unproductiveForcingMove),
    '  repetitiveForcingMove: ' + bool(t.repetitiveForcingMove),
    '  forcingCycle: ' + bool(t.forcingCycle),
    '  mutualChaseLoop: ' + bool(t.mutualChaseLoop),
    '  loopBreakingMove: ' + bool(t.loopBreakingMove),
    '  productiveAlternative: ' + bool(t.productiveAlternative),
    '  seekNewInformation: ' + bool(t.seekNewInformation),
    '  loopBreakingDevelopment: ' + bool(t.loopBreakingDevelopment),
    '  boardStateRefreshMove: ' + bool(t.boardStateRefreshMove),
    '  palaceThreatMapScore: ' + num(t.palaceThreatMapScore),
    '  cannonPalaceRestriction: ' + bool(t.cannonPalaceRestriction),
    '  kingJoinAttack: ' + bool(t.kingJoinAttack),
    '  lowValuePieceSupportsMateNet: ' + bool(t.lowValuePieceSupportsMateNet),
    '  mateNetPotential: ' + bool(t.mateNetPotential),
  ];
  return lines.join('\n');
}


/** Render a 10×9 text board snapshot for the debug report. */
function boardSnapshot(state: GameState): string {
  const lines: string[] = [];
  lines.push('盤面快照（r0=黑方上方，r9=紅方下方，明子=紅車/黑馬，暗子=紅暗車/黑暗卒）：');
  lines.push('   0    1    2    3    4    5    6    7    8');
  for (let r = 0; r < 10; r++) {
    const cells = state.board[r].map(piece => {
      if (!piece) return '··';
      const side = piece.side === 'red' ? '紅' : '黑';
      if (piece.revealed) {
        return side + pieceTypeName(piece.side, piece.realType);
      }
      return side + '暗' + pieceTypeName(piece.side, piece.originalType);
    });
    lines.push('r' + r + ': ' + cells.join('  '));
  }
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

  /* Board snapshot */
  lines.push('');
  lines.push(boardSnapshot(state));

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

  /* Task 6 (第四包): Forcing Move Quality */
  lines.push('');
  lines.push('--- Forcing Move Quality（強制步品質） ---');
  if (selectedTrace) {
    const t = selectedTrace;
    lines.push('forcingMove：' + bool(t.forcingMove));
    if (t.forcingMove) {
      lines.push('forcingTargetKind：' + (t.forcingTargetKind ?? '-'));
      lines.push('forcingTargetType：' + (t.forcingTargetType ?? '-'));
      lines.push('forcingTargetRevealed：' + bool(t.forcingTargetRevealed));
      lines.push('forcingTargetValue：' + num(t.forcingTargetValue));
      lines.push('forcingMoveQuality：' + (t.forcingMoveQuality ?? '-'));
      lines.push('forcingMoveProgress：' + num(t.forcingMoveProgress));
      lines.push('unproductiveForcingMove：' + bool(t.unproductiveForcingMove));
    } else {
      lines.push('（此步不構成 forcingMove）');
    }
  } else {
    lines.push('（無推薦步 trace 可供分析）');
  }

  /* Task 6 (第四包): Chase/Cycle Detection */
  lines.push('');
  lines.push('--- Chase/Cycle Detection（追逃循環偵測） ---');
  if (selectedTrace) {
    const t = selectedTrace;
    lines.push('repetitiveForcingMove：' + bool(t.repetitiveForcingMove));
    lines.push('forcingCycle：' + bool(t.forcingCycle));
    lines.push('mutualChaseLoop：' + bool(t.mutualChaseLoop));
    if (t.mutualChaseLoop || t.forcingCycle) {
      lines.push('判定：雙方來回追逃，局面沒有改變');
    } else if (t.repetitiveForcingMove) {
      lines.push('判定：近期已多次追同一目標，未取得實質進展');
    } else {
      lines.push('判定：未偵測到追逃循環');
    }
  } else {
    lines.push('（無推薦步 trace 可供分析）');
  }

  /* Task 6 (第四包): Loop Breaking Alternatives */
  lines.push('');
  lines.push('--- Loop Breaking Alternatives（破循環替代方案） ---');
  if (selectedTrace) {
    const t = selectedTrace;
    if (t.loopBreakingMove) {
      lines.push('已採用破循環替代步：放棄無成果追擊，改為：');
      if (t.seekNewInformation) lines.push('  - 翻新子（seekNewInformation / boardStateRefreshMove）');
      if (t.loopBreakingDevelopment) lines.push('  - 改善低價子（loopBreakingDevelopment）');
      lines.push('  - productiveAlternative：' + bool(t.productiveAlternative));
    } else {
      lines.push('未觸發破循環邏輯（目前最佳步非無成果/重複/循環強制步，或已被安全門/解殺優先）');
    }
  } else {
    lines.push('（無推薦步 trace 可供分析）');
  }

  /* Task 6 (第四包): Palace Threat Map MVP */
  lines.push('');
  lines.push('--- Palace Threat Map MVP（九宮威脅地圖，僅供參考，非絕殺判斷） ---');
  if (selectedTrace) {
    const t = selectedTrace;
    lines.push('palaceThreatMapScore：' + num(t.palaceThreatMapScore));
    lines.push('cannonPalaceRestriction：' + bool(t.cannonPalaceRestriction));
    lines.push('kingJoinAttack：' + bool(t.kingJoinAttack));
    lines.push('lowValuePieceSupportsMateNet：' + bool(t.lowValuePieceSupportsMateNet));
    lines.push('mateNetPotential：' + bool(t.mateNetPotential));
    lines.push('（此區塊僅為啟發式九宮壓迫參考分數，不可取代真正的絕殺/解殺判斷）');
  } else {
    lines.push('（無推薦步 trace 可供分析）');
  }

  lines.push('');
  lines.push('==================');
  return lines.join('\n');
}

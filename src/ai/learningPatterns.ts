export type AiLearningPatternId =
  | 'opening_cannon_hits_hidden_rook'
  | 'opening_edge_rook_pawn_line_lock'
  | 'opening_hidden_pawn_blocks_horse_foot'
  | 'opening_hidden_pawn_blocks_elephant_eye'
  | 'opening_hidden_pawn_as_cannon_screen'
  | 'preserve_hidden_cannon_threat'
  | 'horse_release_to_guard_pawn_line'
  | 'elephant_release_from_cannon_pressure'
  | 'hidden_rook_guard_point';

export type AiLearningPattern = {
  id: AiLearningPatternId;
  label: string;
  description: string;
  futureSignals: string[];
};

export const aiLearningPatterns: Record<AiLearningPatternId, AiLearningPattern> = {
  opening_cannon_hits_hidden_rook: {
    id: 'opening_cannon_hits_hidden_rook',
    label: '開局炮線瞄暗車',
    description: '敵炮透過剛好一個炮架瞄住己方暗車或暗大子，評估重點不是單純擋線，而是是否能釋放後方結構。',
    futureSignals: ['patternTriggered', 'chosenMove', 'finalResult', 'cannonLinePressureDelta'],
  },
  opening_edge_rook_pawn_line_lock: {
    id: 'opening_edge_rook_pawn_line_lock',
    label: '邊路車壓兵線',
    description: '敵方邊路車或高價暗子可能吃進兵線，造成多個兵卒失去安全翻子權。',
    futureSignals: ['patternTriggered', 'chosenMove', 'pawnLineLockDelta', 'finalResult'],
  },
  opening_hidden_pawn_blocks_horse_foot: {
    id: 'opening_hidden_pawn_blocks_horse_foot',
    label: '暗兵卡馬腳',
    description: '開局暗子高機率為兵卒，若落在馬腳關鍵點，馬的活化價值需要提高。',
    futureSignals: ['patternTriggered', 'releasedHorse', 'horseMobilityDelta', 'finalResult'],
  },
  opening_hidden_pawn_blocks_elephant_eye: {
    id: 'opening_hidden_pawn_blocks_elephant_eye',
    label: '暗兵卡象眼',
    description: '開局暗兵若佔住象眼，容易讓象無法活出，需評估先活象的結構價值。',
    futureSignals: ['patternTriggered', 'releasedElephant', 'elephantMobilityDelta', 'finalResult'],
  },
  opening_hidden_pawn_as_cannon_screen: {
    id: 'opening_hidden_pawn_as_cannon_screen',
    label: '暗兵作炮架',
    description: '開局暗兵可能成為炮架，使炮線壓制或吃暗大子威脅成立。',
    futureSignals: ['patternTriggered', 'screenSquare', 'captureThreatDelta', 'finalResult'],
  },
  preserve_hidden_cannon_threat: {
    id: 'preserve_hidden_cannon_threat',
    label: '保留暗炮威懾',
    description: '暗炮在原位可能保留炮線或反制威懾，若只是塞線且不改善結構，價值應下降。',
    futureSignals: ['patternTriggered', 'hiddenCannonMoved', 'threatPreserved', 'finalResult'],
  },
  horse_release_to_guard_pawn_line: {
    id: 'horse_release_to_guard_pawn_line',
    label: '活馬守兵線',
    description: '活馬若同時守住兵線關鍵點與暗車控制點，應高於只活馬但不守線的落點。',
    futureSignals: ['patternTriggered', 'guardedPawnLine', 'hiddenRookGuardPoint', 'finalResult'],
  },
  elephant_release_from_cannon_pressure: {
    id: 'elephant_release_from_cannon_pressure',
    label: '活象解除炮線壓制',
    description: '象先活出可降低象眼被卡與後方大子被炮線壓制的風險。',
    futureSignals: ['patternTriggered', 'releasedElephant', 'structurePressureDelta', 'finalResult'],
  },
  hidden_rook_guard_point: {
    id: 'hidden_rook_guard_point',
    label: '暗車守控制點',
    description: '暗車尚未公開時仍可能控制前方關鍵點，活馬或守線手應考慮保留此威懾。',
    futureSignals: ['patternTriggered', 'guardPointControlled', 'hiddenRookPreserved', 'finalResult'],
  },
};

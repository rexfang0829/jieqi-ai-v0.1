"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiLearningPatterns = void 0;
exports.aiLearningPatterns = {
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
    /* ── 邊炮 / 邊 G 分流 patterns（對應 simpleAi.ts 邊炮 / 邊車分流邏輯） ── */
    opening_edge_cannon_structure_pressure: {
        id: 'opening_edge_cannon_structure_pressure',
        label: '邊炮炮架壓制結構',
        description: [
            '場景：敵方邊兵翻出炮，炮透過炮架（通常是己方或對方暗子）壓制暗車或暗大子。',
            '威脅核心是炮線貫穿壓制，而非直接吃兵線。',
            '標準應對方向：偏馬八進九（活馬靠邊解除炮線壓力）或象七進九（堵炮架）。',
            '此 pattern 不應套用兵線封鎖防守邏輯（兵線封鎖屬於 opening_edge_rook_line_lock_defense）。',
        ].join(' '),
        futureSignals: ['patternTriggered', 'cannonLinePressureDelta', 'chosenMove', 'finalResult'],
    },
    opening_edge_rook_line_lock_defense: {
        id: 'opening_edge_rook_line_lock_defense',
        label: '邊路車 / G 封鎖兵線',
        description: [
            '場景：敵方邊兵翻出 G（車）或高價暗子，風險是直接吃進兵線、封鎖己方兵卒翻子權。',
            '威脅核心是兵線主動權喪失，而非炮線壓制。',
            '標準應對方向：偏馬八進七（守兵線、保持翻子空間）。',
            '此 pattern 不應套用邊炮壓制的象 / 馬靠邊邏輯（邊炮邏輯屬於 opening_edge_cannon_structure_pressure）。',
        ].join(' '),
        futureSignals: ['patternTriggered', 'pawnLineLockDelta', 'chosenMove', 'finalResult'],
    },
    horse_release_from_cannon_pressure: {
        id: 'horse_release_from_cannon_pressure',
        label: '活馬解除邊炮壓制',
        description: [
            '對應 opening_edge_cannon_structure_pressure 的活馬回應。',
            '馬往邊路（馬八進九方向）活出，目的是解除炮線對後方大子的壓制、或搶占邊路控制點。',
            '應記錄活馬後炮線壓力是否實際下降，作為後續自我對弈調參依據。',
        ].join(' '),
        futureSignals: ['patternTriggered', 'cannonLinePressureDelta', 'horseMobilityDelta', 'finalResult'],
    },
    horse_release_to_pawn_line_guard: {
        id: 'horse_release_to_pawn_line_guard',
        label: '活馬守兵線',
        description: [
            '對應 opening_edge_rook_line_lock_defense 的活馬回應。',
            '馬往內側（馬八進七方向）活出，目的是守兵線翻子點、防止敵方車 / G 直接吃入兵線。',
            '與 horse_release_to_guard_pawn_line（舊版 pattern，語義相同）保持相容；新紀錄建議優先用此 id。',
            '應記錄守線後兵線翻子安全度是否實際提升。',
        ].join(' '),
        futureSignals: ['patternTriggered', 'pawnLineLockDelta', 'guardedPawnLine', 'finalResult'],
    },
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiPanelRecommendations = getAiPanelRecommendations;
exports.buildAiPanelDebugReport = buildAiPanelDebugReport;
const moveNotation_1 = require("../game/moveNotation");
const aiDebugReport_1 = require("./aiDebugReport");
const simpleAi_1 = require("./simpleAi");
function sameMove(a, b) {
    if (!a || !b)
        return a === b;
    return a.from.row === b.from.row &&
        a.from.col === b.from.col &&
        a.to.row === b.to.row &&
        a.to.col === b.to.col;
}
function getAiPanelRecommendations(state) {
    const fair = (0, simpleAi_1.recommendMoveFair)(state);
    const oracle = (0, simpleAi_1.recommendMoveOracle)(state);
    return { fair, oracle, differs: !sameMove(fair.move, oracle.move) };
}
function buildAiPanelDebugReport(input) {
    const main = (0, aiDebugReport_1.formatAiDebugReport)({
        modeName: `${input.modeName ?? 'AI panel'} / Fair AI`,
        state: input.state,
        analysisMoves: input.analysisMoves,
        recommendation: input.fair,
    });
    const oracleMove = input.oracle.move ? (0, moveNotation_1.moveText)(input.oracle.move) : 'no move';
    const oracleBlock = [
        '',
        '--- Oracle / Debug recommendation ---',
        'Oracle sees full hidden realType and is not the official Fair AI recommendation.',
        `move: ${oracleMove}`,
        `score: ${input.oracle.score}`,
        `reason: ${input.oracle.reason}`,
    ];
    if (input.differs) {
        oracleBlock.unshift('', 'Fair AI does not read unrevealed realType; Oracle / Debug can see full information, so recommendations may differ.');
    }
    return [main, ...oracleBlock].join('\n');
}

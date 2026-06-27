"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiPanelRecommendations = getAiPanelRecommendations;
exports.buildAiPanelDebugReport = buildAiPanelDebugReport;
exports.AiPanel = AiPanel;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const simpleAi_1 = require("../ai/simpleAi");
const simpleAiText_1 = require("../ai/simpleAiText");
const endgameFeedback_1 = require("../game/endgameFeedback");
const moveNotation_1 = require("../game/moveNotation");
const aiDebugReport_1 = require("../ai/aiDebugReport");
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
function AiPanel({ state, version: _version, modeName, analysisMoves }) {
    const [copied, setCopied] = (0, react_1.useState)(false);
    const endgame = (0, endgameFeedback_1.getEndgameFeedback)(state.status);
    if (endgame) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "panel aiEndgamePanel", children: [(0, jsx_runtime_1.jsx)("h3", { children: endgame.title }), (0, jsx_runtime_1.jsx)("p", { children: endgame.body }), (0, jsx_runtime_1.jsx)("p", { children: endgame.winnerText })] }));
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "panel aiPanel", children: [(0, jsx_runtime_1.jsx)("h3", { children: "Fair AI \u63A8\u85A6" }), (0, jsx_runtime_1.jsx)("p", { className: "aiDisclaimer", children: simpleAiText_1.SIMPLE_AI_NOTE }), r.move ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("p", { children: (0, moveNotation_1.moveText)(r.move) }), (0, jsx_runtime_1.jsxs)("p", { children: ["\u5206\u6578\uFF1A", r.score] }), (0, jsx_runtime_1.jsx)("p", { children: r.reason })] })) : ((0, jsx_runtime_1.jsx)("p", { children: "\u6C92\u6709\u5408\u6CD5\u8D70\u6CD5" })), (0, jsx_runtime_1.jsxs)("div", { style: { marginTop: 10, fontSize: 13 }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\u5929\u773C Debug \u63A8\u85A6" }), oracle.move ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("p", { children: (0, moveNotation_1.moveText)(oracle.move) }), (0, jsx_runtime_1.jsxs)("p", { children: ["\u5206\u6578\uFF1A", oracle.score] }), (0, jsx_runtime_1.jsx)("p", { children: oracle.reason })] })) : ((0, jsx_runtime_1.jsx)("p", { children: "\u6C92\u6709\u5408\u6CD5\u8D70\u6CD5" })), differs && ((0, jsx_runtime_1.jsx)("p", { className: "aiDisclaimer", children: "\u6B63\u5F0F AI \u4E0D\u770B\u672A\u7FFB realType\uFF1B\u5929\u773C Debug \u53EF\u770B\u5B8C\u6574\u8CC7\u8A0A\uFF0C\u56E0\u6B64\u63A8\u85A6\u53EF\u80FD\u4E0D\u540C\u3002" }))] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginTop: 8 }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: copyReport, style: { fontSize: 13 }, children: "\u8907\u88FD AI \u6E2C\u8A66\u5831\u544A" }), copied && ((0, jsx_runtime_1.jsx)("span", { style: { marginLeft: 10, color: '#86efac', fontSize: 13 }, children: "\u5DF2\u8907\u88FD AI \u6E2C\u8A66\u5831\u544A" }))] })] }));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEndgameFeedback = getEndgameFeedback;
exports.statusLabel = statusLabel;
exports.shouldPlayEndgameSound = shouldPlayEndgameSound;
function getEndgameFeedback(status) {
    if (status === 'red_win') {
        return {
            title: '絕殺',
            winner: 'red',
            winnerText: '紅方勝',
            body: '紅方絕殺，本局結束',
        };
    }
    if (status === 'black_win') {
        return {
            title: '絕殺',
            winner: 'black',
            winnerText: '黑方勝',
            body: '黑方絕殺，本局結束',
        };
    }
    return null;
}
function statusLabel(status, turn) {
    const feedback = getEndgameFeedback(status);
    if (feedback)
        return `${feedback.winnerText}，絕殺`;
    if (status === 'playing')
        return `輪到${turn === 'red' ? '紅方' : '黑方'}`;
    return '和棋';
}
function shouldPlayEndgameSound(previous, current) {
    return previous !== current && !!getEndgameFeedback(current);
}

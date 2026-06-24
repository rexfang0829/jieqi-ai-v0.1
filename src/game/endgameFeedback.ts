import type { GameStatus, Side } from '../types/chess';

export type EndgameFeedback = {
  title: string;
  winner: Side;
  winnerText: string;
  body: string;
};

export function getEndgameFeedback(status: GameStatus): EndgameFeedback | null {
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

export function statusLabel(status: GameStatus, turn: Side): string {
  const feedback = getEndgameFeedback(status);
  if (feedback) return `${feedback.winnerText}，絕殺`;
  if (status === 'playing') return `輪到${turn === 'red' ? '紅方' : '黑方'}`;
  return '和棋';
}

export function shouldPlayEndgameSound(previous: GameStatus, current: GameStatus): boolean {
  return previous !== current && !!getEndgameFeedback(current);
}

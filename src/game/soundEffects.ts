import type { GameState } from '../types/chess';

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

function audioContext(win: Window): AudioContext | null {
  const audioWindow = win as AudioWindow;
  const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextClass) return null;
  return new AudioContextClass();
}

export function shouldPlayMoveSound(previous: GameState, next: GameState): boolean {
  return previous !== next && next.history.length === previous.history.length + 1;
}

export function playMoveSound(win: Window = window): void {
  try {
    const context = audioContext(win);
    if (!context) return;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
    gain.connect(context.destination);

    const oscillator = context.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(240, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(120, context.currentTime + 0.06);
    oscillator.connect(gain);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.08);

    win.setTimeout(() => {
      context.close().catch(() => undefined);
    }, 180);
  } catch {
    // Mobile browsers may block audio until user interaction; UI should continue normally.
  }
}

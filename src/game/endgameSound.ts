type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

export function playEndgameSound(win: Window = window): void {
  try {
    const audioWindow = win as AudioWindow;
    const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const sweepGain = context.createGain();
    sweepGain.gain.setValueAtTime(0.0001, context.currentTime);
    sweepGain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.04);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.48);
    sweepGain.connect(context.destination);

    const sweep = context.createOscillator();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(1200, context.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.42);
    sweep.connect(sweepGain);
    sweep.start(context.currentTime);
    sweep.stop(context.currentTime + 0.5);

    const boomGain = context.createGain();
    boomGain.gain.setValueAtTime(0.0001, context.currentTime + 0.34);
    boomGain.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.38);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.05);
    boomGain.connect(context.destination);

    const boom = context.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(95, context.currentTime + 0.34);
    boom.frequency.exponentialRampToValueAtTime(42, context.currentTime + 0.95);
    boom.connect(boomGain);
    boom.start(context.currentTime + 0.34);
    boom.stop(context.currentTime + 1.05);

    win.setTimeout(() => {
      context.close().catch(() => undefined);
    }, 1300);
  } catch {
    // Mobile browsers may block audio until user interaction; UI should continue normally.
  }
}

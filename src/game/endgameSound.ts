type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

let sharedEndgameCtx: AudioContext | null = null;

function getEndgameContext(): AudioContext | null {
  try {
    if (sharedEndgameCtx && sharedEndgameCtx.state !== 'closed') return sharedEndgameCtx;
    const win = window as AudioWindow;
    const Ctx = win.AudioContext ?? win.webkitAudioContext;
    if (!Ctx) return null;
    sharedEndgameCtx = new Ctx();
    return sharedEndgameCtx;
  } catch {
    return null;
  }
}

export function playEndgameSound(win: Window = window): void {
  try {
    const context = getEndgameContext();
    if (!context) return;

    const resume = context.state === 'suspended' ? context.resume() : Promise.resolve();
    resume.then(() => {
      const t = context.currentTime;

      const buf1Size = Math.ceil(context.sampleRate * 0.3);
      const buf1 = context.createBuffer(1, buf1Size, context.sampleRate);
      const buf1Data = buf1.getChannelData(0);
      for (let i = 0; i < buf1Size; i++) buf1Data[i] = Math.random() * 2 - 1;
      const src1 = context.createBufferSource();
      src1.buffer = buf1;
      const filt1 = context.createBiquadFilter();
      filt1.type = 'lowpass';
      filt1.frequency.value = 400;
      const gain1 = context.createGain();
      gain1.gain.setValueAtTime(0.0001, t);
      gain1.gain.exponentialRampToValueAtTime(0.8, t + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      src1.connect(filt1); filt1.connect(gain1); gain1.connect(context.destination);
      src1.start(t); src1.stop(t + 0.3);

      const osc2 = context.createOscillator();
      osc2.type = 'sine'; osc2.frequency.value = 55;
      const gain2 = context.createGain();
      gain2.gain.setValueAtTime(0.0001, t);
      gain2.gain.exponentialRampToValueAtTime(0.4, t + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc2.connect(gain2); gain2.connect(context.destination);
      osc2.start(t); osc2.stop(t + 0.65);

      const osc3 = context.createOscillator();
      osc3.type = 'sawtooth';
      osc3.frequency.setValueAtTime(600, t + 0.15);
      osc3.frequency.exponentialRampToValueAtTime(80, t + 0.95);
      const gain3 = context.createGain();
      gain3.gain.setValueAtTime(0.0001, t + 0.15);
      gain3.gain.exponentialRampToValueAtTime(0.15, t + 0.17);
      gain3.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      osc3.connect(gain3); gain3.connect(context.destination);
      osc3.start(t + 0.15); osc3.stop(t + 1.0);

      const osc4 = context.createOscillator();
      osc4.type = 'sine'; osc4.frequency.value = 220;
      const gain4 = context.createGain();
      gain4.gain.setValueAtTime(0.0001, t + 0.5);
      gain4.gain.exponentialRampToValueAtTime(0.1, t + 0.51);
      gain4.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      osc4.connect(gain4); gain4.connect(context.destination);
      osc4.start(t + 0.5); osc4.stop(t + 1.8);
    }).catch(() => undefined);
  } catch {
    // audio blocked
  }

  try {
    if (typeof win.speechSynthesis === 'undefined') return;
    const UtteranceClass = (win as unknown as Record<string, unknown>)['SpeechSynthesisUtterance'] as
      | (new (text: string) => SpeechSynthesisUtterance)
      | undefined;
    if (!UtteranceClass) return;
    win.speechSynthesis.cancel();
    const utter = new UtteranceClass('絕殺');
    utter.lang = 'zh-TW';
    utter.pitch = 0.6;
    utter.rate = 0.75;
    utter.volume = 1;
    const voices = win.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utter.voice = zhVoice;
    win.speechSynthesis.speak(utter);
  } catch {
    // speechSynthesis unavailable
  }
}

/**
 * Play timeout result announcement.
 * Does NOT play the "絕殺" speech — instead announces time-out result.
 */
export function playTimeoutSound(side: 'red' | 'black', win: Window = window): void {
  try {
    if (typeof win.speechSynthesis === 'undefined') return;
    const UtteranceClass = (win as unknown as Record<string, unknown>)['SpeechSynthesisUtterance'] as
      | (new (t: string) => SpeechSynthesisUtterance)
      | undefined;
    if (!UtteranceClass) return;
    win.speechSynthesis.cancel();
    const text = side === 'red' ? '紅方時間到，黑方勝' : '黑方時間到，紅方勝';
    const utter = new UtteranceClass(text);
    utter.lang = 'zh-TW';
    utter.pitch = 0.8;
    utter.rate = 0.85;
    utter.volume = 0.7;
    const voices = win.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utter.voice = zhVoice;
    win.speechSynthesis.speak(utter);
  } catch {
    // speechSynthesis unavailable
  }
}

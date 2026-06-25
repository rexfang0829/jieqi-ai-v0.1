import type { GameState } from '../types/chess';

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

// Singleton AudioContext — 建立一次，之後 resume() 重用，避免行動瀏覽器節流
let sharedCtx: AudioContext | null = null;

function getSharedContext(): AudioContext | null {
  try {
    if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx;
    const win = window as AudioWindow;
    const Ctx = win.AudioContext ?? win.webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
    return sharedCtx;
  } catch {
    return null;
  }
}

async function getResumedContext(): Promise<AudioContext | null> {
  const ctx = getSharedContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { return null; }
  }
  return ctx;
}

function noiseBurst(
  context: AudioContext,
  frequency: number,
  q: number,
  peakGain: number,
  decayTime: number,
): void {
  const bufferSize = Math.ceil(context.sampleRate * (decayTime + 0.02));
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const gain = context.createGain();
  const t = context.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peakGain, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decayTime);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(t);
  source.stop(t + decayTime + 0.01);
}

function speakNow(win: Window, text: string, pitch: number, rate: number): void {
  try {
    if (typeof win.speechSynthesis === 'undefined') return;
    const UtteranceClass = (win as unknown as Record<string, unknown>)['SpeechSynthesisUtterance'] as
      | (new (t: string) => SpeechSynthesisUtterance)
      | undefined;
    if (!UtteranceClass) return;
    win.speechSynthesis.cancel();
    const utter = new UtteranceClass(text);
    utter.lang = 'zh-TW';
    utter.pitch = pitch;
    utter.rate = rate;
    utter.volume = 1;
    const voices = win.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utter.voice = zhVoice;
    win.speechSynthesis.speak(utter);
  } catch {
    // speechSynthesis unavailable
  }
}

export function shouldPlayMoveSound(previous: GameState, next: GameState): boolean {
  return previous !== next && next.history.length === previous.history.length + 1;
}

export function playMoveSound(): void {
  getResumedContext().then(ctx => {
    if (!ctx) return;
    try { noiseBurst(ctx, 900, 8, 0.35, 0.07); } catch { /* blocked */ }
  }).catch(() => undefined);
}

export function playCaptureSound(): void {
  getResumedContext().then(ctx => {
    if (!ctx) return;
    try { noiseBurst(ctx, 700, 6, 0.55, 0.10); } catch { /* blocked */ }
  }).catch(() => undefined);
}

export function playCheckSound(win: Window = window): void {
  getResumedContext().then(ctx => {
    if (!ctx) return;
    try { noiseBurst(ctx, 800, 7, 0.45, 0.08); } catch { /* blocked */ }
  }).catch(() => undefined);
  speakNow(win, '將軍', 0.7, 0.85);
}

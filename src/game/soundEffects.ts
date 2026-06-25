import type { GameState } from '../types/chess';

/* ── Volume Constants (adjust here to tune all sounds at once) ── */
export const BOARD_SOUND_VOLUME = 0.80;  // noise burst peak-gain multiplier
export const VOICE_SOUND_VOLUME = 0.70;  // speech synthesis volume

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

// Singleton AudioContext — created once, resumed on reuse (avoids mobile throttling)
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

/**
 * Queue a speech utterance WITHOUT cancelling what is already speaking.
 * Used by playBoardSoundFeedback so multiple voices can stack (capture + check).
 */
function queueSpeech(win: Window, text: string, pitch: number, rate: number): void {
  try {
    if (typeof win.speechSynthesis === 'undefined') return;
    const UtteranceClass = (win as unknown as Record<string, unknown>)['SpeechSynthesisUtterance'] as
      | (new (t: string) => SpeechSynthesisUtterance)
      | undefined;
    if (!UtteranceClass) return;
    const utter = new UtteranceClass(text);
    utter.lang = 'zh-TW';
    utter.pitch = pitch;
    utter.rate = rate;
    utter.volume = VOICE_SOUND_VOLUME;
    const voices = win.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utter.voice = zhVoice;
    win.speechSynthesis.speak(utter);
  } catch {
    // speechSynthesis unavailable
  }
}

/**
 * Cancel any ongoing speech and speak immediately.
 * Used by legacy playCheckSound and endgameSound.
 */
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
    utter.volume = VOICE_SOUND_VOLUME;
    const voices = win.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utter.voice = zhVoice;
    win.speechSynthesis.speak(utter);
  } catch {
    // speechSynthesis unavailable
  }
}

/* ── Unified Board Sound Helper ───────────────────────────────── */

export interface BoardSoundFeedback {
  captured: boolean;
  check: boolean;
  win?: Window;
}

/**
 * Unified sound feedback for any board move or playback step change.
 * Always plays the move noise burst (peakGain = 1.0 * BOARD_SOUND_VOLUME).
 * Queues "eat" voice if captured, "check" voice if in check.
 * Endgame sound is handled separately by the caller or endgame useEffect.
 */
export function playBoardSoundFeedback({ captured, check, win = window }: BoardSoundFeedback): void {
  // Move noise burst — always, full volume
  getResumedContext().then(ctx => {
    if (!ctx) return;
    try { noiseBurst(ctx, 900, 8, 1.0 * BOARD_SOUND_VOLUME, 0.08); } catch { /* blocked */ }
  }).catch(() => undefined);

  // Voice stacking — queue, no cancel
  if (captured) queueSpeech(win, '吃', 0.9, 0.9);
  if (check)    queueSpeech(win, '將軍', 0.7, 0.85);
}

/* ── Legacy exports (preserved for tests and backward compat) ─── */

export function shouldPlayMoveSound(previous: GameState, next: GameState): boolean {
  return previous !== next && next.history.length === previous.history.length + 1;
}

export function playMoveSound(): void {
  getResumedContext().then(ctx => {
    if (!ctx) return;
    try { noiseBurst(ctx, 900, 8, 1.0 * BOARD_SOUND_VOLUME, 0.08); } catch { /* blocked */ }
  }).catch(() => undefined);
}

export function playCaptureSound(): void {
  getResumedContext().then(ctx => {
    if (!ctx) return;
    try { noiseBurst(ctx, 700, 6, 1.0 * BOARD_SOUND_VOLUME, 0.10); } catch { /* blocked */ }
  }).catch(() => undefined);
}

export function playCheckSound(win: Window = window): void {
  getResumedContext().then(ctx => {
    if (!ctx) return;
    try { noiseBurst(ctx, 800, 7, 0.45 * BOARD_SOUND_VOLUME, 0.08); } catch { /* blocked */ }
  }).catch(() => undefined);
  speakNow(win, '將軍', 0.7, 0.85);
}

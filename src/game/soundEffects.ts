import type { GameState } from '../types/chess';

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

function getAudioContext(win: Window): AudioContext | null {
  try {
    const audioWindow = win as AudioWindow;
    const Ctx = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!Ctx) return null;
    return new Ctx();
  } catch {
    return null;
  }
}

/** 白噪音 + bandpass 模擬木頭棋子敲擊聲 */
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

function speakChinese(
  win: Window,
  text: string,
  pitch: number,
  rate: number,
  delayMs: number,
): void {
  win.setTimeout(() => {
    try {
      if (typeof win.speechSynthesis === 'undefined') return;
      const UtteranceClass = (win as unknown as Record<string, unknown>)['SpeechSynthesisUtterance'] as
        | (new (text: string) => SpeechSynthesisUtterance)
        | undefined;
      if (!UtteranceClass) return;
      const utter = new UtteranceClass(text);
      utter.lang = 'zh-TW';
      utter.pitch = pitch;
      utter.rate = rate;
      utter.volume = 1;
      const voices = win.speechSynthesis.getVoices();
      const maleVoice = voices.find(
        v => v.lang.startsWith('zh') &&
          (v.name.toLowerCase().includes('male') || v.name.includes('男')),
      );
      const zhVoice = voices.find(v => v.lang.startsWith('zh'));
      if (maleVoice) utter.voice = maleVoice;
      else if (zhVoice) utter.voice = zhVoice;
      win.speechSynthesis.speak(utter);
    } catch {
      // speechSynthesis 不可用時靜默略過
    }
  }, delayMs);
}

export function shouldPlayMoveSound(previous: GameState, next: GameState): boolean {
  return previous !== next && next.history.length === previous.history.length + 1;
}

/** 落子聲：木頭輕敲 */
export function playMoveSound(win: Window = window): void {
  try {
    const ctx = getAudioContext(win);
    if (!ctx) return;
    noiseBurst(ctx, 900, 8, 0.35, 0.07);
    win.setTimeout(() => { ctx.close().catch(() => undefined); }, 200);
  } catch {
    // 行動瀏覽器可能在使用者互動前封鎖音訊，UI 照常運作
  }
}

/** 吃子聲：木頭重敲 */
export function playCaptureSound(win: Window = window): void {
  try {
    const ctx = getAudioContext(win);
    if (!ctx) return;
    noiseBurst(ctx, 700, 6, 0.55, 0.10);
    win.setTimeout(() => { ctx.close().catch(() => undefined); }, 300);
  } catch {
    // 行動瀏覽器可能在使用者互動前封鎖音訊，UI 照常運作
  }
}

/** 將軍聲：棋子聲 + 男聲語音「將軍」 */
export function playCheckSound(win: Window = window): void {
  try {
    const ctx = getAudioContext(win);
    if (!ctx) return;
    noiseBurst(ctx, 800, 7, 0.45, 0.08);
    win.setTimeout(() => { ctx.close().catch(() => undefined); }, 300);
  } catch {
    // 行動瀏覽器可能在使用者互動前封鎖音訊，UI 照常運作
  }
  speakChinese(win, '將軍', 0.7, 0.85, 100);
}

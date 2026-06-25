type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

/** 絕殺音效：四層 Web Audio + 男聲語音「絕殺」 */
export function playEndgameSound(win: Window = window): void {
  try {
    const audioWindow = win as AudioWindow;
    const Ctx = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!Ctx) return;
    const context = new Ctx();
    const t = context.currentTime;

    // Layer 1：重擊（白噪音 + lowpass，t=0）
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
    src1.connect(filt1);
    filt1.connect(gain1);
    gain1.connect(context.destination);
    src1.start(t);
    src1.stop(t + 0.3);

    // Layer 2：低頻隆隆（sine 55Hz，t=0）
    const osc2 = context.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 55;
    const gain2 = context.createGain();
    gain2.gain.setValueAtTime(0.0001, t);
    gain2.gain.exponentialRampToValueAtTime(0.4, t + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc2.connect(gain2);
    gain2.connect(context.destination);
    osc2.start(t);
    osc2.stop(t + 0.65);

    // Layer 3：金屬餘音（sawtooth 600→80Hz，t=0.15）
    const osc3 = context.createOscillator();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(600, t + 0.15);
    osc3.frequency.exponentialRampToValueAtTime(80, t + 0.95);
    const gain3 = context.createGain();
    gain3.gain.setValueAtTime(0.0001, t + 0.15);
    gain3.gain.exponentialRampToValueAtTime(0.15, t + 0.17);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    osc3.connect(gain3);
    gain3.connect(context.destination);
    osc3.start(t + 0.15);
    osc3.stop(t + 1.0);

    // Layer 4：尾韻鐘聲（sine 220Hz，t=0.5）
    const osc4 = context.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.value = 220;
    const gain4 = context.createGain();
    gain4.gain.setValueAtTime(0.0001, t + 0.5);
    gain4.gain.exponentialRampToValueAtTime(0.1, t + 0.51);
    gain4.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    osc4.connect(gain4);
    gain4.connect(context.destination);
    osc4.start(t + 0.5);
    osc4.stop(t + 1.8);

    win.setTimeout(() => { context.close().catch(() => undefined); }, 2500);
  } catch {
    // 行動瀏覽器可能在使用者互動前封鎖音訊，UI 照常運作
  }

  // 語音「絕殺」：直接在手勢 call stack 內呼叫，不用 setTimeout
  try {
    if (typeof win.speechSynthesis !== 'undefined') {
      const UtteranceClass = (win as unknown as Record<string, unknown>)['SpeechSynthesisUtterance'] as
        | (new (text: string) => SpeechSynthesisUtterance)
        | undefined;
      if (UtteranceClass) {
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
      }
    }
  } catch {
    // speechSynthesis 不可用時靜默略過
  }
}

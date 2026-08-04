// Web Audio API helper for application sound effects

let sharedAudioCtx: AudioContext | null = null;
let lastPlayTime = 0;

function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    console.warn("Could not initialize AudioContext:", err);
    return null;
  }
}

// Auto unlock AudioContext on first user interaction in document
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
}

export function playCashRegisterSound() {
  const nowTime = Date.now();
  // Throttle play sound calls within 600ms to avoid overlapping duplicate audio
  if (nowTime - lastPlayTime < 600) {
    return;
  }
  lastPlayTime = nowTime;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Mechanical "clink / drawer release" sound (short noise burst)
    const bufferSize = ctx.sampleRate * 0.05; // 50ms
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3500;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);

    // 2. Dual-chime "Cha-Ching!" metallic bells
    // First bell chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1567.98, now + 0.03); // G6 note
    gain1.gain.setValueAtTime(0.35, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now + 0.03);
    osc1.stop(now + 0.45);

    // Second higher bell chime (the "ching!")
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2637.02, now + 0.09); // E7 note
    gain2.gain.setValueAtTime(0.5, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    // Add overtone for metallic ring
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(3135.96, now + 0.09); // G7 note
    gain3.gain.setValueAtTime(0.2, now + 0.09);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    osc2.start(now + 0.09);
    osc2.stop(now + 0.85);

    osc3.start(now + 0.09);
    osc3.stop(now + 0.65);

  } catch (err) {
    console.warn("Could not play cash register sound:", err);
  }
}

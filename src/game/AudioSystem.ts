// Detailed audio manager using the Web Audio API.
// Procedurally generates ambient + music + event sounds with no external files.
// Singleton pattern — prevents double-initialization in React StrictMode.

export type SoundEvent =
  | 'click'
  | 'placeBuilding'
  | 'buildingFinished'
  | 'winterComes'
  | 'guestArrives'
  | 'starvation'
  | 'trainingComplete';

type AudioState = {
  ctx: AudioContext | null;
  masterGain: GainNode | null;
  musicGain: GainNode | null;
  ambientGain: GainNode | null;
  sfxGain: GainNode | null;
  ambientNodes: AudioNode[];
  ambientInterval: ReturnType<typeof setInterval> | null;
  ambientTimer: ReturnType<typeof setInterval> | null;
  musicNodes: OscillatorNode[];
  ambientStarted: boolean;
  musicStarted: boolean;
  currentSeason: string;
  musicVolume: number;
  ambientVolume: number;
  sfxVolume: number;
  muted: boolean;
};

let state: AudioState | null = null;

function getState(): AudioState {
  if (!state) {
    state = {
      ctx: null,
      masterGain: null,
      musicGain: null,
      ambientGain: null,
      sfxGain: null,
      ambientNodes: [],
      ambientInterval: null,
      ambientTimer: null,
      musicNodes: [],
      ambientStarted: false,
      musicStarted: false,
      currentSeason: 'summer',
      musicVolume: 0.3,
      ambientVolume: 0.4,
      sfxVolume: 0.6,
      muted: false,
    };
  }
  return state;
}

export function initAudio(): void {
  const s = getState();
  if (s.ctx) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    s.ctx = new Ctx();
    const ctx = s.ctx;
    s.masterGain = ctx.createGain();
    s.masterGain.gain.value = s.muted ? 0 : 1;
    s.masterGain.connect(ctx.destination);

    s.musicGain = ctx.createGain();
    s.musicGain.gain.value = s.musicVolume;
    s.musicGain.connect(s.masterGain);

    s.ambientGain = ctx.createGain();
    s.ambientGain.gain.value = s.ambientVolume;
    s.ambientGain.connect(s.masterGain);

    s.sfxGain = ctx.createGain();
    s.sfxGain.gain.value = s.sfxVolume;
    s.sfxGain.connect(s.masterGain);
  } catch {
    s.ctx = null;
  }
}

// --- Mute ---
export function toggleMute(): boolean {
  const s = getState();
  s.muted = !s.muted;
  if (s.masterGain && s.ctx) {
    s.masterGain.gain.setTargetAtTime(s.muted ? 0 : 1, s.ctx.currentTime, 0.05);
  }
  return s.muted;
}

export function isMuted(): boolean {
  return getState().muted;
}

// --- Ambient layers ---

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function startSummerAmbient(): void {
  const s = getState();
  if (!s.ctx || !s.ambientGain) return;
  if (s.ambientStarted) return;
  s.ambientStarted = true;
  const ctx = s.ctx;

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, 2);
  noise.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 500;
  noise.connect(windFilter);
  const windGain = ctx.createGain();
  windGain.gain.value = 0.08;
  windFilter.connect(windGain);
  windGain.connect(s.ambientGain);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.04;
  lfo.connect(lfoGain);
  lfoGain.connect(windGain.gain);

  noise.start();
  lfo.start();
  s.ambientNodes = [noise, lfo, windFilter, windGain, lfoGain];

  s.ambientInterval = setInterval(() => {
    if (!s.ctx || !s.ambientGain) return;
    const c = s.ctx;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1400 + Math.random() * 1000;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + 0.12);
    osc.connect(g);
    g.connect(s.ambientGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }, 3000 + Math.random() * 5000);
}

function startWinterAmbient(): void {
  const s = getState();
  if (!s.ctx || !s.ambientGain) return;
  if (s.ambientStarted && s.currentSeason === 'winter') return;
  stopAmbientNodes();
  s.ambientStarted = true;
  const ctx = s.ctx;

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, 3);
  noise.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 800;
  windFilter.Q.value = 0.5;
  noise.connect(windFilter);
  const windGain = ctx.createGain();
  windGain.gain.value = 0.14;
  windFilter.connect(windGain);
  windGain.connect(s.ambientGain);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.2;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.07;
  lfo.connect(lfoGain);
  lfoGain.connect(windGain.gain);

  const sweepLfo = ctx.createOscillator();
  sweepLfo.frequency.value = 0.05;
  const sweepGain = ctx.createGain();
  sweepGain.gain.value = 200;
  sweepLfo.connect(sweepGain);
  sweepGain.connect(windFilter.frequency);

  noise.start();
  lfo.start();
  sweepLfo.start();
  s.ambientNodes = [noise, lfo, sweepLfo, windFilter, windGain, lfoGain, sweepGain];

  if (s.ambientInterval) {
    clearInterval(s.ambientInterval);
    s.ambientInterval = null;
  }
}

export function startAmbient(season: string = 'summer'): void {
  const s = getState();
  if (!s.ctx || s.ambientStarted) return;
  s.currentSeason = season;
  if (season === 'winter') {
    startWinterAmbient();
  } else {
    startSummerAmbient();
  }
}

export function switchAmbient(season: string): void {
  const s = getState();
  if (!s.ctx || s.currentSeason === season) return;
  stopAmbientNodes();
  s.ambientStarted = false;
  s.currentSeason = season;
  if (season === 'winter') {
    startWinterAmbient();
  } else {
    startSummerAmbient();
  }
}

function stopAmbientNodes(): void {
  const s = getState();
  for (const n of s.ambientNodes) {
    try {
      if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) {
        n.stop();
      }
    } catch {
      // already stopped
    }
  }
  s.ambientNodes = [];
  if (s.ambientInterval) {
    clearInterval(s.ambientInterval);
    s.ambientInterval = null;
  }
  s.ambientStarted = false;
}

// --- Music: slow drone with harmonics ---

export function startMusic(): void {
  const s = getState();
  if (!s.ctx || !s.musicGain || s.musicStarted) return;
  s.musicStarted = true;
  const ctx = s.ctx;

  const freqs = [110, 165, 220];
  const types: OscillatorType[] = ['sine', 'sine', 'triangle'];
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = types[i];
    osc.frequency.value = freqs[i] * (1 + (Math.random() - 0.5) * 0.003);
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.1 : 0.04;
    osc.connect(g);
    g.connect(s.musicGain);
    osc.start();
    s.musicNodes.push(osc);
  }

  const swell = ctx.createOscillator();
  swell.frequency.value = 0.04;
  const swellGain = ctx.createGain();
  swellGain.gain.value = 0.03;
  swell.connect(swellGain);
  if (s.musicGain) swellGain.connect(s.musicGain.gain);
  swell.start();
  s.musicNodes.push(swell);
}

// --- SFX: named event sounds ---

export function playSound(event: SoundEvent): void {
  const s = getState();
  if (!s.ctx || !s.sfxGain || s.muted) return;
  const ctx = s.ctx;
  const now = ctx.currentTime;

  switch (event) {
    case 'click': {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 180;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(g);
      g.connect(s.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 600;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.04, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc2.connect(g2);
      g2.connect(s.sfxGain);
      osc2.start(now);
      osc2.stop(now + 0.05);
      break;
    }
    case 'placeBuilding': {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(g);
      g.connect(s.sfxGain);
      osc.start(now);
      osc.stop(now + 0.22);
      const noise = ctx.createBufferSource();
      noise.buffer = makeNoiseBuffer(ctx, 0.2);
      const nf = ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.value = 200;
      noise.connect(nf);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.1, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      nf.connect(ng);
      ng.connect(s.sfxGain);
      noise.start(now);
      noise.stop(now + 0.16);
      break;
    }
    case 'buildingFinished': {
      const notes = [220, 277, 330];
      for (const freq of notes) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.06, now + 0.05);
        g.gain.linearRampToValueAtTime(0, now + 0.5);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        osc.connect(filter);
        filter.connect(g);
        g.connect(s.sfxGain);
        osc.start(now);
        osc.stop(now + 0.55);
      }
      break;
    }
    case 'winterComes': {
      const noise = ctx.createBufferSource();
      noise.buffer = makeNoiseBuffer(ctx, 2);
      noise.loop = false;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 1);
      filter.Q.value = 2;
      noise.connect(filter);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.2, now + 0.3);
      g.gain.linearRampToValueAtTime(0.05, now + 1.5);
      g.gain.linearRampToValueAtTime(0, now + 2);
      filter.connect(g);
      g.connect(s.sfxGain);
      noise.start(now);
      noise.stop(now + 2);
      break;
    }
    case 'guestArrives': {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(196, now);
      osc.frequency.linearRampToValueAtTime(261, now + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.1, now + 0.05);
      g.gain.linearRampToValueAtTime(0, now + 0.4);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      osc.connect(filter);
      filter.connect(g);
      g.connect(s.sfxGain);
      osc.start(now);
      osc.stop(now + 0.42);
      break;
    }
    case 'starvation': {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(g);
      g.connect(s.sfxGain);
      osc.start(now);
      osc.stop(now + 0.72);
      break;
    }
    case 'trainingComplete': {
      const notes = [392, 494, 587];
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = notes[i];
        const g = ctx.createGain();
        const t = now + i * 0.08;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(g);
        g.connect(s.sfxGain);
        osc.start(t);
        osc.stop(t + 0.17);
      }
      break;
    }
  }
}

// --- Volume controls ---

export function setMusicVolume(v: number): void {
  const s = getState();
  s.musicVolume = v;
  if (s.musicGain && s.ctx) {
    s.musicGain.gain.setTargetAtTime(v, s.ctx.currentTime, 0.1);
  }
}

export function setAmbientVolume(v: number): void {
  const s = getState();
  s.ambientVolume = v;
  if (s.ambientGain && s.ctx) {
    s.ambientGain.gain.setTargetAtTime(v, s.ctx.currentTime, 0.1);
  }
}

export function setSfxVolume(v: number): void {
  const s = getState();
  s.sfxVolume = v;
  if (s.sfxGain && s.ctx) {
    s.sfxGain.gain.setTargetAtTime(v, s.ctx.currentTime, 0.1);
  }
}

export function getMusicVolume(): number { return getState().musicVolume; }
export function getAmbientVolume(): number { return getState().ambientVolume; }
export function getSfxVolume(): number { return getState().sfxVolume; }

export function stopAllAudio(): void {
  const s = getState();
  stopAmbientNodes();
  for (const n of s.musicNodes) {
    try { (n as OscillatorNode).stop?.(); } catch { /* ignore */ }
  }
  s.musicNodes = [];
  s.musicStarted = false;
}

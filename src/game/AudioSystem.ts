// Detailed audio manager using the Web Audio API.
// Procedurally generates ambient + music + event sounds with no external files.
// Each event sound has a named enum so callers stay decoupled from synthesis.

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
  started: boolean;
  currentSeason: string;
  musicVolume: number;
  ambientVolume: number;
  sfxVolume: number;
};

const state: AudioState = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  ambientGain: null,
  sfxGain: null,
  ambientNodes: [],
  ambientInterval: null,
  ambientTimer: null,
  musicNodes: [],
  started: false,
  currentSeason: 'summer',
  musicVolume: 0.3,
  ambientVolume: 0.4,
  sfxVolume: 0.6,
};

export function initAudio(): void {
  if (state.ctx) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    state.ctx = new Ctx();
    const ctx = state.ctx;
    state.masterGain = ctx.createGain();
    state.masterGain.gain.value = 1;
    state.masterGain.connect(ctx.destination);

    state.musicGain = ctx.createGain();
    state.musicGain.gain.value = state.musicVolume;
    state.musicGain.connect(state.masterGain);

    state.ambientGain = ctx.createGain();
    state.ambientGain.gain.value = state.ambientVolume;
    state.ambientGain.connect(state.masterGain);

    state.sfxGain = ctx.createGain();
    state.sfxGain.gain.value = state.sfxVolume;
    state.sfxGain.connect(state.masterGain);
  } catch {
    state.ctx = null;
  }
}

// --- Ambient layers ---

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function startSummerAmbient(): void {
  if (!state.ctx || !state.ambientGain) return;
  const ctx = state.ctx;

  // Gentle wind: low-pass filtered noise with slow LFO.
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
  windGain.connect(state.ambientGain);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.04;
  lfo.connect(lfoGain);
  lfoGain.connect(windGain.gain);

  noise.start();
  lfo.start();
  state.ambientNodes = [noise, lfo, windFilter, windGain, lfoGain];

  // Bird chirps every few seconds.
  state.ambientInterval = setInterval(() => {
    if (!state.ctx || !state.ambientGain) return;
    const c = state.ctx;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1400 + Math.random() * 1000;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + 0.12);
    osc.connect(g);
    g.connect(state.ambientGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }, 3000 + Math.random() * 5000);
}

function startWinterAmbient(): void {
  if (!state.ctx || !state.ambientGain) return;
  const ctx = state.ctx;

  // Cold howling wind: band-passed noise, higher pitch, more constant.
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
  windGain.connect(state.ambientGain);

  // Stronger, faster LFO for howling gusts.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.2;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.07;
  lfo.connect(lfoGain);
  lfoGain.connect(windGain.gain);

  // Filter sweep for wind pitch variation.
  const sweepLfo = ctx.createOscillator();
  sweepLfo.frequency.value = 0.05;
  const sweepGain = ctx.createGain();
  sweepGain.gain.value = 200;
  sweepLfo.connect(sweepGain);
  sweepGain.connect(windFilter.frequency);

  noise.start();
  lfo.start();
  sweepLfo.start();
  state.ambientNodes = [noise, lfo, sweepLfo, windFilter, windGain, lfoGain, sweepGain];

  // No bird chirps in winter.
  if (state.ambientInterval) {
    clearInterval(state.ambientInterval);
    state.ambientInterval = null;
  }
}

export function startAmbient(season: string = 'summer'): void {
  if (!state.ctx || state.started) return;
  state.started = true;
  state.currentSeason = season;
  if (season === 'winter') {
    startWinterAmbient();
  } else {
    startSummerAmbient();
  }
}

export function switchAmbient(season: string): void {
  if (!state.ctx || state.currentSeason === season) return;
  // Stop existing ambient.
  stopAmbientNodes();
  state.currentSeason = season;
  if (season === 'winter') {
    startWinterAmbient();
  } else {
    startSummerAmbient();
  }
}

function stopAmbientNodes(): void {
  for (const n of state.ambientNodes) {
    try {
      if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) {
        n.stop();
      }
    } catch {
      // already stopped
    }
  }
  state.ambientNodes = [];
  if (state.ambientInterval) {
    clearInterval(state.ambientInterval);
    state.ambientInterval = null;
  }
}

// --- Music: slow drone with harmonics ---

export function startMusic(): void {
  if (!state.ctx || !state.musicGain) return;
  const ctx = state.ctx;

  const freqs = [110, 165, 220];
  const types: OscillatorType[] = ['sine', 'sine', 'triangle'];
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = types[i];
    osc.frequency.value = freqs[i] * (1 + (Math.random() - 0.5) * 0.003);
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.1 : 0.04;
    osc.connect(g);
    g.connect(state.musicGain);
    osc.start();
    state.musicNodes.push(osc);
  }

  // Slow swell.
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.04;
  const swellGain = ctx.createGain();
  swellGain.gain.value = 0.03;
  swell.connect(swellGain);
  if (state.musicGain) swellGain.connect(state.musicGain.gain);
  swell.start();
  state.musicNodes.push(swell);
}

// --- SFX: named event sounds ---

export function playSound(event: SoundEvent): void {
  if (!state.ctx || !state.sfxGain) return;
  const ctx = state.ctx;
  const now = ctx.currentTime;

  switch (event) {
    case 'click': {
      // Light wooden tap.
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 180;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(g);
      g.connect(state.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
      // High click overtone.
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 600;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.04, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc2.connect(g2);
      g2.connect(state.sfxGain);
      osc2.start(now);
      osc2.stop(now + 0.05);
      break;
    }
    case 'placeBuilding': {
      // Dull hammer/thud: low square + noise burst.
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(g);
      g.connect(state.sfxGain);
      osc.start(now);
      osc.stop(now + 0.22);
      // Noise thud.
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
      ng.connect(state.sfxGain);
      noise.start(now);
      noise.stop(now + 0.16);
      break;
    }
    case 'buildingFinished': {
      // Short triumphant horn chord: three sine notes.
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
        g.connect(state.sfxGain);
        osc.start(now);
        osc.stop(now + 0.55);
      }
      break;
    }
    case 'winterComes': {
      // Howling wind blast: 2-second filtered noise sweep.
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
      g.connect(state.sfxGain);
      noise.start(now);
      noise.stop(now + 2);
      break;
    }
    case 'guestArrives': {
      // Horn call.
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
      g.connect(state.sfxGain);
      osc.start(now);
      osc.stop(now + 0.42);
      break;
    }
    case 'starvation': {
      // Low descending ominous tone.
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(g);
      g.connect(state.sfxGain);
      osc.start(now);
      osc.stop(now + 0.72);
      break;
    }
    case 'trainingComplete': {
      // Bright ascending arpeggio.
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
        g.connect(state.sfxGain);
        osc.start(t);
        osc.stop(t + 0.17);
      }
      break;
    }
  }
}

// --- Volume controls ---

export function setMusicVolume(v: number): void {
  state.musicVolume = v;
  if (state.musicGain && state.ctx) {
    state.musicGain.gain.setTargetAtTime(v, state.ctx.currentTime, 0.1);
  }
}

export function setAmbientVolume(v: number): void {
  state.ambientVolume = v;
  if (state.ambientGain && state.ctx) {
    state.ambientGain.gain.setTargetAtTime(v, state.ctx.currentTime, 0.1);
  }
}

export function setSfxVolume(v: number): void {
  state.sfxVolume = v;
  if (state.sfxGain && state.ctx) {
    state.sfxGain.gain.setTargetAtTime(v, state.ctx.currentTime, 0.1);
  }
}

export function getMusicVolume(): number { return state.musicVolume; }
export function getAmbientVolume(): number { return state.ambientVolume; }
export function getSfxVolume(): number { return state.sfxVolume; }

export function stopAllAudio(): void {
  stopAmbientNodes();
  for (const n of state.musicNodes) {
    try { (n as OscillatorNode).stop?.(); } catch { /* ignore */ }
  }
  state.musicNodes = [];
  state.started = false;
}

// Simple audio manager using the Web Audio API.
// Generates procedural ambient wind/forest sounds and a looping drone "music"
// track — no external audio files needed.

type AudioState = {
  ctx: AudioContext | null;
  masterGain: GainNode | null;
  musicGain: GainNode | null;
  ambientGain: GainNode | null;
  musicNodes: OscillatorNode[];
  ambientNodes: AudioNode[];
  started: boolean;
  musicVolume: number;
  ambientVolume: number;
};

const state: AudioState = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  ambientGain: null,
  musicNodes: [],
  ambientNodes: [],
  started: false,
  musicVolume: 0.3,
  ambientVolume: 0.4,
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
  } catch {
    state.ctx = null;
  }
}

export function startAmbient(): void {
  if (!state.ctx || !state.ambientGain || state.started) return;
  const ctx = state.ctx;
  state.started = true;

  // Wind: filtered noise with slow LFO on gain.
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 400;
  windFilter.Q.value = 0.7;
  noise.connect(windFilter);
  const windGain = ctx.createGain();
  windGain.gain.value = 0.15;
  windFilter.connect(windGain);
  windGain.connect(state.ambientGain);

  // Slow LFO to modulate wind volume (gusts).
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain);
  lfoGain.connect(windGain.gain);

  // Bird chirps: occasional short sine blips.
  const chirpInterval = setInterval(() => {
    if (!state.ctx || !state.ambientGain) return;
    const c = state.ctx;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200 + Math.random() * 800;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.05);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.15);
    osc.connect(g);
    g.connect(state.ambientGain);
    osc.start();
    osc.stop(c.currentTime + 0.2);
  }, 4000 + Math.random() * 6000);

  noise.start();
  lfo.start();
  state.ambientNodes = [noise, lfo, windFilter, windGain, lfoGain];
  // Store interval for cleanup
  (state as unknown as { chirpInterval: ReturnType<typeof setInterval> }).chirpInterval = chirpInterval;
}

export function startMusic(): void {
  if (!state.ctx || !state.musicGain) return;
  const ctx = state.ctx;

  // Drone: two detuned oscillators for a deep, ancient feel.
  const freqs = [110, 110 * 1.5, 165];
  const types: OscillatorType[] = ['sine', 'triangle', 'sine'];
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = types[i];
    osc.frequency.value = freqs[i] * (1 + (Math.random() - 0.5) * 0.005);
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.12 : 0.05;
    osc.connect(g);
    g.connect(state.musicGain);
    osc.start();
    state.musicNodes.push(osc);
  }

  // Slow amplitude swell on the master music gain.
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.05;
  const swellGain = ctx.createGain();
  swellGain.gain.value = 0.05;
  swell.connect(swellGain);
  if (state.musicGain) swellGain.connect(state.musicGain.gain);
  swell.start();
  state.musicNodes.push(swell);
}

export function playSound(type: 'build' | 'click' | 'alert'): void {
  if (!state.ctx || !state.masterGain) return;
  const ctx = state.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const now = ctx.currentTime;
  if (type === 'build') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  } else if (type === 'click') {
    osc.type = 'triangle';
    osc.frequency.value = 600;
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  }
  osc.connect(g);
  g.connect(state.masterGain);
  osc.start(now);
  osc.stop(now + 0.5);
}

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

export function getMusicVolume(): number {
  return state.musicVolume;
}

export function getAmbientVolume(): number {
  return state.ambientVolume;
}

export function stopAllAudio(): void {
  for (const n of state.musicNodes) {
    try { (n as OscillatorNode).stop?.(); } catch { /* ignore */ }
  }
  state.musicNodes = [];
  const ci = (state as unknown as { chirpInterval?: number }).chirpInterval;
  if (ci) clearInterval(ci);
  state.started = false;
}

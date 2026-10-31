import { save } from './save';
let ctx: AudioContext | null = null, sfxGain: GainNode, musicGain: GainNode, noiseBuf: AudioBuffer;
let musicOn = false;
export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  sfxGain = ctx.createGain(); musicGain = ctx.createGain(); sfxGain.connect(ctx.destination); musicGain.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
}
export function applyVolumes() { if (!ctx) return; sfxGain.gain.value = save.sfx * 0.6; musicGain.gain.value = save.music * 0.25; }
function env(g: GainNode, t: number, a: number, peak: number, dec: number) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.3, dest?: AudioNode) {
  if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, vol, dur); o.connect(g).connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, freq: number, q = 1, vol = 0.3, sweepTo?: number) {
  if (!ctx) return; const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); f.Q.value = q;
  env(g, t, 0.004, vol, dur); s.connect(f).connect(g).connect(sfxGain); s.start(t); s.stop(t + dur + 0.05);
}
export const sfx = {
  swing: () => noise(0.12, 900, 2, 0.25, 3000),
  hit: () => { noise(0.1, 500, 1, 0.5); tone('square', 180, 60, 0.1, 0.18); },
  heavy: () => { noise(0.25, 250, 0.7, 0.7); tone('sawtooth', 120, 35, 0.3, 0.3); },
  shoot: () => tone('square', 700, 180, 0.15, 0.12),
  dash: () => noise(0.18, 1500, 1.5, 0.25, 400),
  parry: () => { tone('sawtooth', 1400, 500, 0.12, 0.2); noise(0.08, 3000, 3, 0.4); tone('square', 90, 40, 0.25, 0.3); },
  break: () => { noise(0.4, 180, 0.5, 0.8); tone('sawtooth', 220, 30, 0.5, 0.35); },
  hurt: () => tone('square', 300, 90, 0.2, 0.2),
  swap: () => { tone('triangle', 300, 900, 0.15, 0.2); },
  level: () => { [392, 523, 659].forEach((f, i) => setTimeout(() => tone('triangle', f, f, 0.18, 0.2), i * 90)); },
  ui: () => tone('triangle', 660, 520, 0.06, 0.12),
  boss: () => { tone('sawtooth', 70, 35, 1.4, 0.4); noise(1.2, 120, 0.5, 0.5); },
};
// simple dark synth loop: bass + pad, no bells
export function startMusic() {
  if (!ctx || musicOn) return; musicOn = true;
  const notes = [55, 55, 65.4, 49];
  let step = 0;
  const loop = () => {
    if (!ctx) return;
    const t = ctx.currentTime, root = notes[Math.floor(step / 8) % 4];
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = root * (step % 2 ? 2 : 1); f.type = 'lowpass'; f.frequency.value = 600;
    env(g, t, 0.01, 0.5, 0.22); o.connect(f).connect(g).connect(musicGain); o.start(t); o.stop(t + 0.3);
    if (step % 8 === 0) for (const m of [2, 3, 4.5]) {
      const p = ctx.createOscillator(), pg = ctx.createGain(); p.type = 'triangle'; p.frequency.value = root * m;
      pg.gain.setValueAtTime(0.0001, t); pg.gain.linearRampToValueAtTime(0.08, t + 0.6); pg.gain.linearRampToValueAtTime(0.0001, t + 2.2);
      p.connect(pg).connect(musicGain); p.start(t); p.stop(t + 2.3);
    }
    step++; setTimeout(loop, 250);
  };
  loop();
}

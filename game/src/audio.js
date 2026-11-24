// All sound is synthesized live with WebAudio: engine, guns, sirens, the SKYHAWK rotor,
// blasts and three in-car radio stations driven by a small step sequencer.
import { RADIO } from './config.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.station = 0;
    this.nextBeat = 0;
    this.step = 0;
    this.rotorLevel = 0;
  }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.6 : 0;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = 0.22;
    this.music.connect(this.master);

    // engine: a low-passed sawtooth whose pitch follows speed
    this.engine = ctx.createOscillator();
    this.engine.type = 'sawtooth';
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    this.engine.connect(lp);
    lp.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engine.start();

    // siren: a triangle wave swept up and down
    this.siren = ctx.createOscillator();
    this.siren.type = 'triangle';
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.siren.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.siren.start();

    // rotor: looped low noise, chopped by a square LFO into the familiar "wop-wop"
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'lowpass';
    rf.frequency.value = 280;
    this.rotorGain = ctx.createGain();
    this.rotorGain.gain.value = 0;
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 11;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth);
    lfoDepth.connect(chop.gain);
    noise.connect(rf);
    rf.connect(chop);
    chop.connect(this.rotorGain);
    this.rotorGain.connect(this.master);
    noise.start();
    lfo.start();
    this.nextBeat = ctx.currentTime + 0.1;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.6 : 0;
  }

  noiseBurst(dur, freq, gain) {
    if (!this.ctx) return;
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  gunshot(kind, volume = 1) {
    const dur = kind === 'shotgun' ? 0.35 : 0.14;
    const freq = kind === 'smg' ? 3000 : 2200;
    this.noiseBurst(dur, freq, (kind === 'shotgun' ? 0.9 : 0.55) * volume);
  }
  punch() { this.noiseBurst(0.08, 600, 0.5); }
  crash() { this.noiseBurst(0.3, 900, 0.7); }
  explosion() { this.noiseBurst(1.4, 400, 1.2); }

  // 0..1 loudness of the police helicopter, set by the police every frame
  rotor(level) { this.rotorLevel = level; }

  blip(freq = 880, dur = 0.12) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  missionPassed() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.3), i * 140)); }
  missionFailed() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.35), i * 180)); }

  note(freq, t, dur, type, gain) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  nextStation() {
    this.station = (this.station + 1) % RADIO.length;
    return RADIO[this.station].name;
  }

  // Each frame: engine pitch, siren wail, rotor thump and the radio sequencer while in a car.
  update(state) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(40 + Math.abs(state.speed) * 3.2, t, 0.05);
    this.engineGain.gain.setTargetAtTime(state.inCar ? 0.07 + Math.min(0.08, Math.abs(state.speed) / 400) : 0, t, 0.1);
    this.siren.frequency.setTargetAtTime(700 + Math.sin(t * 5) * 260, t, 0.02);
    // the wail gets louder with every cruiser in earshot, up to a cap
    this.sirenGain.gain.setTargetAtTime(state.sirens ? Math.min(0.06, state.sirens * 0.015) : 0, t, 0.2);
    this.rotorGain.gain.setTargetAtTime(this.rotorLevel * 0.35, t, 0.3);
    const st = RADIO[this.station];
    if (!state.inCar || st.bpm === 0) { this.nextBeat = t + 0.1; return; }
    const spb = 60 / st.bpm / 2;
    const scale = [0, 3, 5, 7, 10, 12];
    const leadSteps = st.mood === 'latin' ? [0, 3, 6, 10, 12] : [0, 6, 8, 14];
    while (this.nextBeat < t + 0.2) {
      const s = this.step++ % 16, nt = this.nextBeat, base = 440 * Math.pow(2, (st.key - 69) / 12);
      const prog = [0, 0, 5, 5, 7, 7, 3, 3][Math.floor(this.step / 16) % 8];
      const root = base * Math.pow(2, prog / 12);
      if (s % 4 === 0) this.note(60, nt, 0.25, 'sine', 0.5);
      if (st.mood !== 'sunset' && s % 4 === 2) this.note(180, nt, 0.06, 'square', 0.05);
      if (s % 2 === 0) this.note(root / 2, nt, spb * 1.8, st.mood === 'synth' ? 'sawtooth' : 'triangle', 0.18);
      if (leadSteps.includes(s)) this.note(root * Math.pow(2, scale[(s + this.step) % 6] / 12), nt, spb * 2, st.mood === 'synth' ? 'square' : 'sine', 0.08);
      this.nextBeat += spb;
    }
  }
}

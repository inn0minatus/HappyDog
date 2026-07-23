import Phaser from 'phaser';
import { AUDIO } from '../config/gameConfig';

/**
 * audio.ts — placeholder SFX + music, 100% static-hostable with NO external
 * files or network. Sounds are SYNTHESIZED at runtime (simple Web Audio-style
 * oscillator maths) into 16-bit PCM WAV blobs, then handed to Phaser's normal
 * loader (`load.audio`). Playback goes through the scene's shared sound manager,
 * so the persisted mute + iOS unlock owned by AudioManager apply automatically —
 * this module never touches mute state itself.
 *
 * Phase 5 can drop in real assets by replacing `registerAudio()` with real
 * `loader.audio(key, ['x.m4a','x.ogg'])` calls under the same keys; nothing else
 * needs to change.
 */

// ── Sound keys ───────────────────────────────────────────────────────────────
export const Sfx = {
  jump: 'sfx_jump',
  hit: 'sfx_hit',
  tablet: 'sfx_tablet',
  armor: 'sfx_armor',
  victory: 'sfx_victory',
  defeat: 'sfx_defeat',
  ui: 'sfx_ui',
} as const;
export type SfxKey = (typeof Sfx)[keyof typeof Sfx];

export const Music = {
  menu: 'music_menu',
  game: 'music_game',
} as const;
export type MusicKey = (typeof Music)[keyof typeof Music];

// ── Note frequencies (Hz) used by the little placeholder tunes/stings ─────────
const C3 = 130.81;
const F3 = 174.61;
const G3 = 196.0;
const A3 = 220.0;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const F4 = 349.23;
const G4 = 392.0;
const A4 = 440.0;
const B4 = 493.88;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const B5 = 987.77;
const C6 = 1046.5;

const SFX_SR = 44100; // short, crisp
const MUSIC_SR = 22050; // longer loops — half rate keeps the blobs small

// ── Oscillators ──────────────────────────────────────────────────────────────
type WaveType = 'sine' | 'square' | 'triangle' | 'saw' | 'noise';

function waveSample(type: WaveType, phase: number): number {
  const p = phase - Math.floor(phase); // wrap to [0,1)
  switch (type) {
    case 'sine':
      return Math.sin(p * Math.PI * 2);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'triangle':
      return 4 * Math.abs(p - 0.5) - 1;
    case 'saw':
      return 2 * p - 1;
    case 'noise':
      return Math.random() * 2 - 1;
    default:
      return 0;
  }
}

/** A percussive tone: fast attack, power-curve decay, optional pitch glide. */
interface ToneOpts {
  start: number;
  dur: number;
  freq: number;
  freqEnd?: number;
  type?: WaveType;
  gain?: number;
  attack?: number;
  decayPow?: number;
}

function addTone(buf: Float32Array, sr: number, o: ToneOpts): void {
  const type = o.type ?? 'sine';
  const gain = o.gain ?? 0.3;
  const attack = o.attack ?? 0.005;
  const decayPow = o.decayPow ?? 2;
  const freqEnd = o.freqEnd ?? o.freq;
  const n0 = Math.max(0, Math.floor(o.start * sr));
  const n1 = Math.min(buf.length, Math.floor((o.start + o.dur) * sr));
  let phase = 0;
  for (let i = n0; i < n1; i++) {
    const t = (i - n0) / sr;
    const u = t / o.dur;
    const f = o.freq + (freqEnd - o.freq) * u;
    phase += f / sr;
    const a = attack > 0 ? Math.min(t / attack, 1) : 1;
    const env = a * Math.pow(1 - u, decayPow);
    buf[i] = (buf[i] ?? 0) + gain * env * waveSample(type, phase);
  }
}

/** A sustained pad: attack/release ramps with an optional gentle vibrato. */
interface PadOpts {
  start: number;
  dur: number;
  freq: number;
  type?: WaveType;
  gain?: number;
  attack?: number;
  release?: number;
  vibratoHz?: number;
  vibratoDepth?: number;
}

function addPad(buf: Float32Array, sr: number, o: PadOpts): void {
  const type = o.type ?? 'sine';
  const gain = o.gain ?? 0.2;
  const attack = o.attack ?? 0.02;
  const release = o.release ?? 0.08;
  const vibratoHz = o.vibratoHz ?? 0;
  const vibratoDepth = o.vibratoDepth ?? 0;
  const n0 = Math.max(0, Math.floor(o.start * sr));
  const n1 = Math.min(buf.length, Math.floor((o.start + o.dur) * sr));
  let phase = 0;
  for (let i = n0; i < n1; i++) {
    const t = (i - n0) / sr;
    const rem = o.dur - t;
    const a = attack > 0 ? Math.min(t / attack, 1) : 1;
    const r = release > 0 ? Math.min(rem / release, 1) : 1;
    const env = Math.max(0, Math.min(a, r));
    const vib = vibratoHz > 0 ? 1 + vibratoDepth * Math.sin(t * vibratoHz * Math.PI * 2) : 1;
    phase += (o.freq * vib) / sr;
    buf[i] = (buf[i] ?? 0) + gain * env * waveSample(type, phase);
  }
}

// ── Sound recipes ────────────────────────────────────────────────────────────
function makeJump(): Float32Array {
  const sr = SFX_SR;
  const buf = new Float32Array(Math.floor(sr * 0.18));
  addTone(buf, sr, { start: 0, dur: 0.16, freq: 470, freqEnd: 900, type: 'square', gain: 0.32, decayPow: 2.4 });
  addTone(buf, sr, { start: 0, dur: 0.16, freq: 470, freqEnd: 900, type: 'sine', gain: 0.18 });
  return buf;
}

function makeHit(): Float32Array {
  const sr = SFX_SR;
  const buf = new Float32Array(Math.floor(sr * 0.22));
  addTone(buf, sr, { start: 0, dur: 0.1, freq: 1, type: 'noise', gain: 0.35, decayPow: 3 });
  addTone(buf, sr, { start: 0, dur: 0.18, freq: 240, freqEnd: 80, type: 'square', gain: 0.3, decayPow: 2 });
  return buf;
}

function makeTablet(): Float32Array {
  const sr = SFX_SR;
  const buf = new Float32Array(Math.floor(sr * 0.2));
  addTone(buf, sr, { start: 0, dur: 0.18, freq: 880, type: 'sine', gain: 0.28, decayPow: 2.4 });
  addTone(buf, sr, { start: 0.0, dur: 0.16, freq: 1320, type: 'sine', gain: 0.16, decayPow: 2.6 });
  addTone(buf, sr, { start: 0.02, dur: 0.14, freq: 1760, type: 'sine', gain: 0.1, decayPow: 3 });
  return buf;
}

function makeArmor(): Float32Array {
  const sr = SFX_SR;
  const buf = new Float32Array(Math.floor(sr * 0.4));
  addTone(buf, sr, { start: 0.0, dur: 0.16, freq: E5, type: 'triangle', gain: 0.22, decayPow: 2 });
  addTone(buf, sr, { start: 0.09, dur: 0.16, freq: G5, type: 'triangle', gain: 0.22, decayPow: 2 });
  addTone(buf, sr, { start: 0.18, dur: 0.2, freq: B5, type: 'triangle', gain: 0.24, decayPow: 1.8 });
  addTone(buf, sr, { start: 0.0, dur: 0.36, freq: 300, freqEnd: 1200, type: 'sine', gain: 0.12, decayPow: 1.4 });
  return buf;
}

function makeVictory(): Float32Array {
  const sr = SFX_SR;
  const buf = new Float32Array(Math.floor(sr * 0.7));
  const seq: Array<[number, number]> = [
    [0.0, C5],
    [0.12, E5],
    [0.24, G5],
    [0.36, C6],
  ];
  for (const [s, f] of seq) {
    addTone(buf, sr, { start: s, dur: 0.3, freq: f, type: 'triangle', gain: 0.24, decayPow: 1.6 });
  }
  addTone(buf, sr, { start: 0.36, dur: 0.32, freq: G5, type: 'sine', gain: 0.12, decayPow: 1.4 });
  return buf;
}

function makeDefeat(): Float32Array {
  const sr = SFX_SR;
  const buf = new Float32Array(Math.floor(sr * 0.7));
  const seq: Array<[number, number]> = [
    [0.0, G4],
    [0.16, E4],
    [0.32, C4],
    [0.48, G3],
  ];
  for (const [s, f] of seq) {
    addTone(buf, sr, { start: s, dur: 0.34, freq: f, type: 'triangle', gain: 0.24, decayPow: 1.5 });
  }
  return buf;
}

function makeUi(): Float32Array {
  const sr = SFX_SR;
  const buf = new Float32Array(Math.floor(sr * 0.07));
  addTone(buf, sr, { start: 0, dur: 0.06, freq: 660, freqEnd: 760, type: 'sine', gain: 0.28, decayPow: 3 });
  return buf;
}

function makeMenuMusic(): Float32Array {
  const sr = MUSIC_SR;
  const step = 0.9;
  const loop = step * 4;
  const buf = new Float32Array(Math.floor(sr * loop));
  // Calm I–V–vi–IV pad progression (C, G, Am, F).
  const chords: Array<[number, number, number]> = [
    [C4, E4, G4],
    [G3, B4, D4],
    [A3, C5, E4],
    [F3, A4, C5],
  ];
  chords.forEach((c, i) => {
    const start = i * step;
    addPad(buf, sr, { start, dur: step * 0.98, freq: c[0], type: 'triangle', gain: 0.13, attack: 0.06, release: 0.22, vibratoHz: 5, vibratoDepth: 0.004 });
    addPad(buf, sr, { start, dur: step * 0.98, freq: c[1], type: 'sine', gain: 0.09, attack: 0.08, release: 0.22 });
    addPad(buf, sr, { start, dur: step * 0.98, freq: c[2], type: 'sine', gain: 0.09, attack: 0.08, release: 0.22 });
  });
  // Light melody over the top.
  const mel: Array<[number, number]> = [
    [0.0, G4],
    [0.9, C5],
    [1.8, A4],
    [2.7, G4],
  ];
  for (const [s, f] of mel) {
    addTone(buf, sr, { start: s, dur: 0.5, freq: f, type: 'sine', gain: 0.11, attack: 0.02, decayPow: 1.2 });
  }
  return buf;
}

function makeGameMusic(): Float32Array {
  const sr = MUSIC_SR;
  const loop = 3.2;
  const buf = new Float32Array(Math.floor(sr * loop));
  // Driving bass pulse.
  const bass = [C3, C3, G3, G3, A3, A3, F3, F3];
  bass.forEach((f, i) => {
    addTone(buf, sr, { start: i * 0.4, dur: 0.36, freq: f, type: 'square', gain: 0.12, decayPow: 1.6 });
  });
  // Upbeat arpeggio lead.
  const arp = [C4, E4, G4, C5, G4, E4, A4, C5, E4, A4, C5, E4, F4, A4, C5, F4];
  arp.forEach((f, i) => {
    addTone(buf, sr, { start: i * 0.2, dur: 0.18, freq: f, type: 'triangle', gain: 0.11, decayPow: 2 });
  });
  return buf;
}

// ── WAV encoding + blob URLs ─────────────────────────────────────────────────
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function wavUrl(samples: Float32Array, sampleRate: number): string {
  const blob = new Blob([encodeWav(samples, sampleRate)], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

interface AudioDef {
  readonly key: string;
  readonly sr: number;
  readonly make: () => Float32Array;
}

const AUDIO_DEFS: readonly AudioDef[] = [
  { key: Sfx.jump, sr: SFX_SR, make: makeJump },
  { key: Sfx.hit, sr: SFX_SR, make: makeHit },
  { key: Sfx.tablet, sr: SFX_SR, make: makeTablet },
  { key: Sfx.armor, sr: SFX_SR, make: makeArmor },
  { key: Sfx.victory, sr: SFX_SR, make: makeVictory },
  { key: Sfx.defeat, sr: SFX_SR, make: makeDefeat },
  { key: Sfx.ui, sr: SFX_SR, make: makeUi },
  { key: Music.menu, sr: MUSIC_SR, make: makeMenuMusic },
  { key: Music.game, sr: MUSIC_SR, make: makeGameMusic },
];

// Generate the blob URLs once (idempotent across scene reloads).
let urlCache: Map<string, string> | undefined;
function audioUrls(): Map<string, string> {
  if (!urlCache) {
    urlCache = new Map();
    for (const def of AUDIO_DEFS) urlCache.set(def.key, wavUrl(def.make(), def.sr));
  }
  return urlCache;
}

/** Queue every placeholder sound onto the scene's loader (call from PreloadScene). */
export function registerAudio(scene: Phaser.Scene): void {
  const urls = audioUrls();
  for (const def of AUDIO_DEFS) {
    const url = urls.get(def.key);
    if (url && !scene.cache.audio.exists(def.key)) scene.load.audio(def.key, url);
  }
}

// ── Playback (mute is enforced globally by the shared sound manager) ──────────
export function playSfx(scene: Phaser.Scene, key: SfxKey): void {
  const volume = key === Sfx.ui ? AUDIO.uiVolume : AUDIO.sfxVolume;
  scene.sound.play(key, { volume });
}

// Single looping music track shared across scenes (the sound manager is global).
let currentMusic: Phaser.Sound.BaseSound | undefined;
let currentMusicKey: MusicKey | undefined;

export function playMusic(scene: Phaser.Scene, key: MusicKey): void {
  if (currentMusicKey === key && currentMusic && (currentMusic.isPlaying || currentMusic.isPaused)) {
    return; // already the active track — don't restart or stack
  }
  stopMusic();
  const music = scene.sound.add(key, { loop: true, volume: AUDIO.musicVolume });
  music.play();
  currentMusic = music;
  currentMusicKey = key;
}

export function stopMusic(): void {
  if (currentMusic) {
    currentMusic.stop();
    currentMusic.destroy();
  }
  currentMusic = undefined;
  currentMusicKey = undefined;
}

export function pauseMusic(): void {
  if (currentMusic && currentMusic.isPlaying) currentMusic.pause();
}

export function resumeMusic(): void {
  if (currentMusic && currentMusic.isPaused) currentMusic.resume();
}

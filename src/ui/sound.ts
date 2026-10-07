import { usePrefs } from '../store/prefs'

/** Tiny synthesised sound effects — no audio files needed. */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (usePrefs.getState().muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.08) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

function clack(start: number) {
  const a = audio()
  if (!a) return
  const len = Math.floor(a.sampleRate * 0.04)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  const src = a.createBufferSource()
  src.buffer = buf
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  const g = a.createGain()
  g.gain.value = 0.35
  src.connect(filter).connect(g).connect(a.destination)
  src.start(a.currentTime + start)
}

export const sfx = {
  dice() {
    for (let i = 0; i < 5; i++) clack(i * 0.08 + Math.random() * 0.03)
  },
  coin() {
    tone(1320, 0, 0.12, 'triangle', 0.06)
    tone(1760, 0.07, 0.18, 'triangle', 0.05)
  },
  pay() {
    tone(520, 0, 0.12, 'triangle', 0.06)
    tone(390, 0.08, 0.18, 'triangle', 0.05)
  },
  card() {
    tone(660, 0, 0.1, 'sine', 0.05)
    tone(880, 0.08, 0.1, 'sine', 0.05)
    tone(990, 0.16, 0.22, 'sine', 0.05)
  },
  turn() {
    tone(587, 0, 0.25, 'sine', 0.05)
    tone(880, 0.12, 0.35, 'sine', 0.04)
  },
  step() {
    tone(300 + Math.random() * 40, 0, 0.05, 'sine', 0.025)
  },
  bad() {
    tone(220, 0, 0.3, 'sawtooth', 0.03)
  },
}

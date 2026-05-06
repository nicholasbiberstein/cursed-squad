// ============================================================
// AUDIO ENGINE
// Synthesised sounds via Web Audio API — no external files.
// Migrated from v0.65 HTML prototype.
// ============================================================

let _ac: AudioContext | null = null

function getAC(): AudioContext | null {
  if (!_ac) {
    try { _ac = new (window.AudioContext || (window as any).webkitAudioContext)() }
    catch { /* unavailable */ }
  }
  return _ac
}

export function unlockAudio(): void {
  const ac = getAC()
  if (ac?.state === 'suspended') ac.resume()
}

function tone(freq: number, type: OscillatorType, dur: number, vol = 0.14, delay = 0): void {
  const ac = getAC(); if (!ac) return
  try {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.connect(g); g.connect(ac.destination)
    o.type = type
    o.frequency.setValueAtTime(freq, ac.currentTime + delay)
    g.gain.setValueAtTime(0, ac.currentTime + delay)
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + delay + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + dur)
    o.start(ac.currentTime + delay)
    o.stop(ac.currentTime + delay + dur + 0.05)
  } catch { /* ignore */ }
}

function noise(dur: number, vol = 0.1, freq = 800): void {
  const ac = getAC(); if (!ac) return
  try {
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src  = ac.createBufferSource()
    const filt = ac.createBiquadFilter()
    filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = 2
    const g = ac.createGain()
    g.gain.setValueAtTime(vol, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur)
    src.buffer = buf; src.connect(filt); filt.connect(g); g.connect(ac.destination)
    src.start(); src.stop(ac.currentTime + dur)
  } catch { /* ignore */ }
}

export const SFX = {
  click:        () => { tone(440, 'square', 0.06, 0.09) },
  move:         () => { tone(300, 'sine', 0.1, 0.08); tone(370, 'sine', 0.07, 0.07, 0.05) },
  punch:        () => { noise(0.13, 0.15, 280); tone(110, 'square', 0.1, 0.12) },
  hit:          () => { noise(0.09, 0.12, 580); tone(190, 'sawtooth', 0.09, 0.1) },
  hit_heavy:    () => { noise(0.18, 0.19, 190); tone(75, 'square', 0.18, 0.16) },
  heal:         () => { tone(523, 'sine', 0.1, 0.1); tone(659, 'sine', 0.09, 0.09, 0.07); tone(784, 'sine', 0.13, 0.09, 0.14) },
  ability:      () => { tone(640, 'sine', 0.07, 0.1); tone(860, 'triangle', 0.09, 0.09, 0.05) },
  aoe:          () => { noise(0.22, 0.17, 140); tone(150, 'sawtooth', 0.22, 0.13) },
  death:        () => { noise(0.38, 0.17, 380); tone(140, 'square', 0.28, 0.13); tone(75, 'square', 0.36, 0.1, 0.09) },
  status_apply: () => { tone(320, 'triangle', 0.1, 0.08); tone(250, 'triangle', 0.1, 0.08, 0.07) },
  miss:         () => { tone(190, 'sine', 0.09, 0.07); tone(150, 'sine', 0.1, 0.05, 0.05) },
  ui_select:    () => { tone(490, 'sine', 0.06, 0.08) },
  turn_start:   () => { tone(430, 'sine', 0.07, 0.1); tone(544, 'sine', 0.09, 0.1, 0.06) },
  victory:      () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 'sine', 0.28, 0.15, i * 0.09)) },
  defeat:       () => { [290, 240, 190, 140].forEach((f, i) => tone(f, 'sawtooth', 0.32, 0.13, i * 0.09)) },
  campaign_win: () => { [523, 659, 784, 1047, 1318].forEach((f, i) => tone(f, 'sine', 0.3, 0.15, i * 0.08)) },
  forge:        () => { tone(660, 'sine', 0.1, 0.13); tone(880, 'sine', 0.12, 0.13, 0.08); tone(1100, 'triangle', 0.15, 0.11, 0.16) },
  reroll:       () => { noise(0.08, 0.1, 400); tone(440, 'square', 0.1, 0.1, 0.05) },
  refine:       () => { tone(550, 'triangle', 0.08, 0.1); tone(770, 'triangle', 0.1, 0.1, 0.07); tone(990, 'sine', 0.12, 0.1, 0.14) },
}

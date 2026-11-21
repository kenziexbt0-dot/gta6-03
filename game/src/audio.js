// Solmarina — all sound is synthesized with WebAudio. No audio files exist.
// Engine hum, sirens, gunshots, punches, pickups and jingles are oscillators and
// filtered noise, built fresh on each call so nothing needs to be loaded.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    muted: false,
    // The audio context only starts after a user gesture; until then calls are no-ops.
    unlocked: false,
  };
}

// Create (or resume) the AudioContext. Call from a user gesture or a shot staging.
export function unlockAudio(audio) {
  try {
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    audio.unlocked = true;
  } catch {
    audio.unlocked = false;
  }
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}

// A short oscillator blip with a pitch slide.
function blip(audio, freqFrom, freqTo, seconds, type, volume) {
  if (!audio.unlocked || audio.muted || !audio.ctx) return;
  try {
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(audio.master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  } catch {
    // Sound is garnish; a failure must never break the game.
  }
}

// A burst of filtered noise, for impacts, gunshots and skids.
function noiseBurst(audio, seconds, filterFreq, volume) {
  if (!audio.unlocked || audio.muted || !audio.ctx) return;
  try {
    const t = audio.ctx.currentTime;
    const length = Math.max(1, Math.floor(audio.ctx.sampleRate * seconds));
    const buffer = audio.ctx.createBuffer(1, length, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audio.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    source.connect(filter).connect(gain).connect(audio.master);
    source.start(t);
  } catch {
    // Sound is garnish; a failure must never break the game.
  }
}

export function playShoot(audio) {
  noiseBurst(audio, 0.14, 2400, 0.5);
  blip(audio, 220, 55, 0.1, 'square', 0.22);
}

export function playPunch(audio) {
  noiseBurst(audio, 0.09, 700, 0.4);
}

export function playCrash(audio) {
  noiseBurst(audio, 0.3, 500, 0.55);
  blip(audio, 90, 40, 0.25, 'sawtooth', 0.25);
}

export function playPickup(audio) {
  blip(audio, 660, 990, 0.12, 'sine', 0.3);
}

export function playMissionComplete(audio) {
  blip(audio, 523, 523, 0.12, 'triangle', 0.3);
  setTimeout(() => blip(audio, 659, 659, 0.12, 'triangle', 0.3), 110);
  setTimeout(() => blip(audio, 784, 784, 0.22, 'triangle', 0.32), 220);
}

export function playWantedUp(audio) {
  blip(audio, 392, 311, 0.18, 'square', 0.2);
  blip(audio, 311, 233, 0.22, 'square', 0.2);
}

export function playBusted(audio) {
  blip(audio, 330, 110, 0.7, 'sawtooth', 0.25);
}

export function playSkid(audio) {
  noiseBurst(audio, 0.18, 1400, 0.12);
}

// Two-tone police siren, called on a timer while police are near.
export function playSiren(audio, high) {
  blip(audio, high ? 880 : 660, high ? 880 : 660, 0.32, 'sine', 0.1);
}

// Continuous engine hum whose pitch follows the car's speed. Call every frame.
export function updateEngineSound(audio, speedRatio, driving) {
  if (!audio.unlocked || !audio.ctx) return;
  try {
    if (!driving || speedRatio <= 0.02) {
      if (audio.engineOsc) {
        audio.engineGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
      }
      return;
    }
    if (!audio.engineOsc) {
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      audio.engineOsc.connect(filter).connect(audio.engineGain).connect(audio.master);
      audio.engineOsc.start();
    }
    const freq = 55 + speedRatio * 165;
    audio.engineOsc.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.06);
    audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : 0.05 + speedRatio * 0.05, audio.ctx.currentTime, 0.08);
  } catch {
    // Sound is garnish; a failure must never break the game.
  }
}

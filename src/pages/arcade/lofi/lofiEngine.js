/**
 * lofiEngine.js
 * Generative lo-fi player built on Web Audio.
 *
 * What keeps it musical:
 * - Every event is scheduled against the audio clock with a lookahead window,
 *   so the groove does not drift with timer jitter.
 * - Harmony is written as chord symbols in a key. Voicings are derived from them
 *   and voice-led, and the bass only ever plays roots and fifths.
 * - The melody is an 8-bar tune per track: a 2-bar motif, its repeat, a contrast
 *   and a return. It moves by step inside the key's pentatonic scale and lands on
 *   chord tones on strong beats. Each pass through the loop thins or rests it.
 */

const QUALITIES = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  69: [0, 4, 7, 9, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  7: [0, 4, 7, 10],
  9: [0, 4, 7, 10, 14],
  13: [0, 4, 10, 14, 21],
  '7b9': [0, 4, 10, 13],
  m7b5: [0, 3, 6, 10],
  sus: [0, 5, 7, 10, 14]
};

const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

// Chord symbol such as "Dm9", "G13", "Bbmaj7", "A7b9", "Em7b5", "C69", "Dsus"
function parseChord(symbol) {
  const match = symbol.match(/^([A-G][b#]?)(.*)$/);
  const root = NOTE_INDEX[match[1]];
  const rest = match[2];
  let quality = rest;
  if (rest === 'm7b5') quality = 'm7b5';
  else if (rest.startsWith('maj')) quality = rest;
  else if (rest.startsWith('m')) quality = rest;
  return { name: symbol, root, tones: QUALITIES[quality] || QUALITIES.maj7 };
}

// One 16-step bar per pattern; values are velocities
const DRUMS = {
  boombap: {
    kick: { 0: 1, 7: 0.55, 10: 0.85 },
    snare: { 4: 0.9, 12: 0.95 },
    hat: { 0: 0.6, 2: 0.4, 4: 0.6, 6: 0.4, 8: 0.6, 10: 0.4, 12: 0.6, 14: 0.45, 15: 0.25 },
    swing: 0.2
  },
  bossa: {
    kick: { 0: 0.8, 6: 0.55, 8: 0.75, 14: 0.55 },
    rim: { 3: 0.6, 6: 0.5, 10: 0.6, 13: 0.5 },
    hat: { 0: 0.5, 2: 0.3, 4: 0.5, 6: 0.3, 8: 0.5, 10: 0.3, 12: 0.5, 14: 0.3 },
    swing: 0.05
  },
  dusty: {
    kick: { 0: 0.95, 8: 0.5, 11: 0.75 },
    snare: { 4: 0.8, 12: 0.85 },
    hat: { 2: 0.45, 6: 0.45, 10: 0.45, 14: 0.5 },
    swing: 0.24
  },
  drift: {
    kick: { 0: 0.6, 10: 0.4 },
    rim: { 4: 0.35, 12: 0.4 },
    hat: {},
    swing: 0.1
  }
};

export const LOFI_TRACKS = [
  {
    id: 'mekong_jazz',
    name: 'แจ๊สริมโขง',
    mood: 'อุ่น นุ่ม เหมาะกับกาแฟแก้วแรก',
    bpm: 78,
    key: 'C',
    chords: ['Dm9', 'G13', 'Cmaj9', 'Am9', 'Dm9', 'G13', 'Em7', 'A7b9'],
    drums: 'boombap',
    ambience: 'river',
    seed: 11
  },
  {
    id: 'morning_cafe',
    name: 'คาเฟ่ยามเช้า',
    mood: 'สดใส โยกเบาๆ แบบบอสซา',
    bpm: 86,
    key: 'F',
    chords: ['Fmaj9', 'Dm9', 'Gm9', 'C13', 'Fmaj9', 'Dm9', 'Bbmaj7', 'C13'],
    drums: 'bossa',
    ambience: 'vinyl',
    seed: 23
  },
  {
    id: 'rainy_window',
    name: 'ฝนริมหน้าต่าง',
    mood: 'เหงานิดๆ ฟังคู่กับเสียงฝน',
    bpm: 70,
    key: 'C',
    chords: ['Am9', 'Fmaj7', 'Cmaj9', 'G69', 'Am9', 'Fmaj7', 'Dm9', 'E7b9'],
    drums: 'dusty',
    ambience: 'rain',
    seed: 37
  },
  {
    id: 'sunset_pier',
    name: 'อาทิตย์ตกที่ท่าน้ำ',
    mood: 'ฟ้าสีส้ม ลมเย็น ผ่อนคลาย',
    bpm: 74,
    key: 'Eb',
    chords: ['Ebmaj9', 'Cm9', 'Abmaj9', 'Bb13', 'Ebmaj9', 'Gm7', 'Abmaj9', 'Bbsus'],
    drums: 'boombap',
    ambience: 'river',
    seed: 41
  },
  {
    id: 'midnight_haus',
    name: 'เที่ยงคืนในบ้าน',
    mood: 'มืด ลึก เงียบสงบ',
    bpm: 66,
    key: 'F',
    chords: ['Dm9', 'Bbmaj9', 'Gm9', 'A7b9', 'Dm9', 'Bbmaj9', 'Em7b5', 'A7b9'],
    drums: 'dusty',
    ambience: 'vinyl',
    seed: 53
  },
  {
    id: 'night_train',
    name: 'รถไฟสายราตรี',
    mood: 'ช้า โล่ง เหมาะกับการนอน',
    bpm: 60,
    key: 'G',
    chords: ['Gmaj9', 'Em9', 'Cmaj9', 'Dsus', 'Gmaj9', 'Bm7', 'Cmaj9', 'Dsus'],
    drums: 'drift',
    ambience: 'river',
    seed: 67
  }
];

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Rootless voicing near middle C, each tone placed as close as possible to the last chord
function voiceChord(chord, previous) {
  const pcs = chord.tones.slice(1).map((t) => (chord.root + t) % 12);
  const centre = previous ? previous.reduce((a, b) => a + b, 0) / previous.length : 62;
  const notes = pcs.map((pc) => {
    let best = pc + 48;
    for (let m = pc + 36; m <= pc + 84; m += 12) {
      if (Math.abs(m - centre) < Math.abs(best - centre)) best = m;
    }
    return best;
  });
  const unique = [...new Set(notes)].sort((a, b) => a - b);
  // Keep the voicing out of the mud and out of the melody's register
  return unique.map((n) => (n < 52 ? n + 12 : n > 74 ? n - 12 : n)).sort((a, b) => a - b);
}

// Eighth-note rhythm cells for one bar (1 = note on)
const RHYTHMS = [
  [1, 0, 1, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 0, 0],
  [1, 0, 0, 1, 0, 1, 0, 0],
  [0, 0, 1, 0, 1, 0, 1, 0],
  [1, 0, 0, 0, 1, 0, 0, 0],
  [1, 1, 0, 1, 0, 0, 0, 0]
];

/**
 * Compose the 8-bar tune for a track. Returns one array per bar of
 * { slot (eighth note 0-7), midi, len (eighths) }.
 */
export function composeMelody(track, chords) {
  const rand = seededRandom(track.seed);
  const tonic = NOTE_INDEX[track.key];
  const scale = [];
  for (let octave = 5; octave <= 7; octave++) {
    [0, 2, 4, 7, 9].forEach((step) => scale.push(tonic + step + octave * 12));
  }
  const inRange = scale.filter((m) => m >= 67 && m <= 86);
  const pick = (list) => list[Math.floor(rand() * list.length)];

  const nearestChordTone = (index, chord) => {
    const pcs = chord.tones.map((t) => (chord.root + t) % 12);
    let best = index;
    let bestDist = 99;
    inRange.forEach((m, i) => {
      if (!pcs.includes(m % 12)) return;
      const dist = Math.abs(i - index);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    return best;
  };

  const writeBar = (rhythm, chord, startIndex) => {
    let index = startIndex;
    const notes = [];
    rhythm.forEach((on, slot) => {
      if (!on) return;
      if (notes.length === 0) index = nearestChordTone(index, chord);
      else index = Math.max(0, Math.min(inRange.length - 1, index + pick([-2, -1, -1, 1, 1, 2, 0])));
      notes.push({ slot, midi: inRange[index], len: 1 });
    });
    notes.forEach((note, i) => {
      const next = notes[i + 1];
      note.len = Math.min(4, (next ? next.slot : 8) - note.slot);
    });
    return { notes, index };
  };

  const motif = [pick(RHYTHMS), pick(RHYTHMS)];
  const contrast = [pick(RHYTHMS), RHYTHMS[4]];
  const plan = [motif[0], motif[1], motif[0], RHYTHMS[4], contrast[0], contrast[1], motif[0], RHYTHMS[4]];

  const bars = [];
  let index = Math.floor(inRange.length / 2);
  plan.forEach((rhythm, bar) => {
    // The motif restarts from the same place so the repeat is recognisable
    if (bar === 2 || bar === 6) index = Math.floor(inRange.length / 2);
    const written = writeBar(rhythm, chords[bar % chords.length], index);
    index = written.index;
    bars.push(written.notes);
  });

  // Close the phrase on the tonic or its third
  const last = bars[7][bars[7].length - 1];
  if (last) {
    const home = inRange.filter((m) => [tonic % 12, (tonic + 4) % 12].includes(m % 12));
    last.midi = home.reduce((a, b) => (Math.abs(b - last.midi) < Math.abs(a - last.midi) ? b : a), home[0]);
    last.len = 4;
  }
  return bars;
}

function makeNoiseBuffer(ctx, seconds, kind) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === 'white') {
      data[i] = white;
      continue;
    }
    // Pink-ish noise
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    let sample = (b0 + b1 + b2 + white * 0.1848) * 0.06;
    if (kind === 'vinyl') {
      sample *= 0.35;
      if (Math.random() < 0.0004) sample += (Math.random() - 0.5) * 0.5;
    }
    data[i] = sample;
  }
  return buffer;
}

function makeImpulse(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 3);
      smooth = smooth * 0.6 + (Math.random() * 2 - 1) * 0.4;
      data[i] = smooth * decay;
    }
  }
  return impulse;
}

export class LofiEngine {
  constructor() {
    this.ctx = null;
    this.timer = null;
    this.playing = false;
    this.volumes = { master: 0.8, keys: 0.8, drums: 0.7, ambience: 0.5 };
    this.onChord = null;
    this.analyser = null;
  }

  ensureContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    this.ctx = ctx;

    this.master = ctx.createGain();
    const tape = ctx.createBiquadFilter();
    tape.type = 'lowpass';
    tape.frequency.value = 8500;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18;
    glue.knee.value = 20;
    glue.ratio.value = 3;
    glue.attack.value = 0.01;
    glue.release.value = 0.25;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;
    this.master.connect(tape);
    tape.connect(glue);
    glue.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // Music bus ducks slightly under each kick
    this.duck = ctx.createGain();
    this.duck.connect(this.master);

    this.keysBus = ctx.createGain();
    const keysTone = ctx.createBiquadFilter();
    keysTone.type = 'lowpass';
    keysTone.frequency.value = 2600;
    this.keysBus.connect(keysTone);
    keysTone.connect(this.duck);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 1.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    keysTone.connect(reverb);
    reverb.connect(wet);
    wet.connect(this.master);

    this.bassBus = ctx.createGain();
    this.bassBus.connect(this.duck);

    this.drumBus = ctx.createGain();
    const drumTone = ctx.createBiquadFilter();
    drumTone.type = 'lowpass';
    drumTone.frequency.value = 6000;
    this.drumBus.connect(drumTone);
    drumTone.connect(this.master);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.connect(this.master);

    // Slow pitch drift shared by every keyboard voice, like a tired tape
    this.wow = ctx.createOscillator();
    this.wow.frequency.value = 0.35;
    this.wowDepth = ctx.createGain();
    this.wowDepth.gain.value = 5;
    this.wow.connect(this.wowDepth);
    this.wow.start();

    this.whiteNoise = makeNoiseBuffer(ctx, 1, 'white');
    this.applyVolumes(0);
  }

  applyVolumes(ramp = 0.05) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const v = this.volumes;
    this.master.gain.setTargetAtTime(v.master, now, ramp || 0.001);
    this.keysBus.gain.setTargetAtTime(v.keys * 0.9, now, ramp || 0.001);
    this.bassBus.gain.setTargetAtTime(v.keys * 0.8, now, ramp || 0.001);
    this.drumBus.gain.setTargetAtTime(v.drums * 0.9, now, ramp || 0.001);
    this.ambienceBus.gain.setTargetAtTime(v.ambience, now, ramp || 0.001);
  }

  setVolume(name, value) {
    this.volumes[name] = value;
    this.applyVolumes();
  }

  start(trackId) {
    this.ensureContext();
    this.stop(true);
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const track = LOFI_TRACKS.find((t) => t.id === trackId) || LOFI_TRACKS[0];
    this.track = track;
    this.chords = track.chords.map(parseChord);
    this.voicings = [];
    let previous = null;
    this.chords.forEach((chord) => {
      previous = voiceChord(chord, previous);
      this.voicings.push(previous);
    });
    this.melody = composeMelody(track, this.chords);
    this.pattern = DRUMS[track.drums] || DRUMS.boombap;
    this.sixteenth = 60 / track.bpm / 4;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.12;
    this.random = seededRandom(track.seed * 7 + 1);

    this.startAmbience(track.ambience);
    this.duck.gain.cancelScheduledValues(ctx.currentTime);
    this.duck.gain.setValueAtTime(1, ctx.currentTime);

    this.playing = true;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop(keepContext = false) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.playing = false;
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
      } catch (e) {
        // already stopped
      }
      this.ambienceSource = null;
    }
    if (!keepContext && this.ctx && this.ctx.state === 'running') {
      // Let tails ring out, then release the audio device
      const ctx = this.ctx;
      setTimeout(() => {
        if (!this.playing && ctx.state === 'running') ctx.suspend();
      }, 2500);
    }
  }

  dispose() {
    this.stop(true);
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {
        // context already closed
      }
      this.ctx = null;
    }
  }

  startAmbience(kind) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx, 4, kind === 'vinyl' ? 'vinyl' : 'pink');
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    const level = ctx.createGain();
    if (kind === 'rain') {
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      filter.Q.value = 0.4;
      level.gain.value = 0.9;
    } else if (kind === 'vinyl') {
      filter.type = 'lowpass';
      filter.frequency.value = 5000;
      level.gain.value = 0.8;
    } else {
      // River: low wash that swells slowly
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      level.gain.value = 0.9;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.12;
      const swellDepth = ctx.createGain();
      swellDepth.gain.value = 0.3;
      swell.connect(swellDepth);
      swellDepth.connect(level.gain);
      swell.start();
      source.onended = () => swell.stop();
    }
    source.connect(filter);
    filter.connect(level);
    level.connect(this.ambienceBus);
    source.start();
    this.ambienceSource = source;
  }

  tick() {
    if (!this.playing || !this.ctx) return;
    // Background tabs throttle timers, so schedule further ahead there
    const horizon = typeof document !== 'undefined' && document.hidden ? 1.8 : 0.2;
    while (this.nextTime < this.ctx.currentTime + horizon) {
      this.scheduleStep(this.step, this.nextTime);
      this.step += 1;
      this.nextTime += this.sixteenth;
    }
  }

  scheduleStep(step, time) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const barInLoop = bar % 8;
    const pass = Math.floor(bar / 8);
    const chord = this.chords[barInLoop];
    const voicing = this.voicings[barInLoop];
    const beat = this.sixteenth * 4;
    const swing = s16 % 2 === 1 ? this.sixteenth * this.pattern.swing : 0;
    const human = (this.random() - 0.5) * 0.008;
    const t = time + swing + human;

    if (s16 === 0) {
      if (this.onChord) {
        const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
        const name = chord.name;
        setTimeout(() => this.playing && this.onChord && this.onChord(name, barInLoop), delay);
      }
      // Chord on the downbeat, rolled like a hand on the keys
      voicing.forEach((midi, i) => this.playKey(midi, time + i * 0.014, beat * 3.6, 0.22));
      this.playBass(chord.root, time, beat * 1.6, 1);
    }
    // Soft comp answer on the "and" of beat 2
    if (s16 === 6 && barInLoop % 2 === 0) {
      voicing.slice(1).forEach((midi, i) => this.playKey(midi, t + i * 0.01, beat * 1.2, 0.11));
    }
    // Bass pickups: fifth before beat 3, root again on the last eighth
    if (s16 === 7) this.playBass(chord.root + 7, t, beat * 0.5, 0.6);
    if (s16 === 10) this.playBass(chord.root, t, beat * 1.2, 0.8);
    if (s16 === 14 && barInLoop % 2 === 1) {
      const next = this.chords[(barInLoop + 1) % 8];
      this.playBass(next.root + 7, t, beat * 0.45, 0.5);
    }

    // Melody: full, thinned, full, rest, so the loop breathes
    const mode = pass % 4;
    if (mode !== 3 && s16 % 2 === 0) {
      const slot = s16 / 2;
      const note = this.melody[barInLoop].find((n) => n.slot === slot);
      if (note && !(mode === 1 && this.random() < 0.35)) {
        const late = slot % 2 === 1 ? this.sixteenth * this.pattern.swing * 2 : 0;
        this.playLead(note.midi, time + late + human, note.len * this.sixteenth * 2, 0.2);
      }
    }

    // Drums sit out the first bar so each track fades in on the chords
    if (bar >= 1) {
      const p = this.pattern;
      if (p.kick && p.kick[s16]) this.playKick(t, p.kick[s16]);
      if (p.snare && p.snare[s16]) this.playSnare(t, p.snare[s16], false);
      if (p.rim && p.rim[s16]) this.playSnare(t, p.rim[s16], true);
      if (p.hat && p.hat[s16]) this.playHat(t, p.hat[s16] * (0.85 + this.random() * 0.3));
    }
  }

  // Electric piano: sine body, soft triangle, and a quick bell partial on the attack
  playKey(midi, time, duration, velocity) {
    const ctx = this.ctx;
    const freq = midiToFreq(midi);
    const body = ctx.createOscillator();
    const warm = ctx.createOscillator();
    const bell = ctx.createOscillator();
    const amp = ctx.createGain();
    const bellAmp = ctx.createGain();
    const warmAmp = ctx.createGain();

    body.type = 'sine';
    warm.type = 'triangle';
    bell.type = 'sine';
    body.frequency.value = freq;
    warm.frequency.value = freq;
    warm.detune.value = 6;
    bell.frequency.value = freq * 4;
    this.wowDepth.connect(body.detune);
    this.wowDepth.connect(warm.detune);

    warmAmp.gain.value = 0.28;
    bellAmp.gain.setValueAtTime(velocity * 0.22, time);
    bellAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

    const end = time + duration;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(velocity, time + 0.008);
    amp.gain.exponentialRampToValueAtTime(velocity * 0.45, time + Math.min(0.5, duration * 0.8));
    amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.7);

    body.connect(amp);
    warm.connect(warmAmp);
    warmAmp.connect(amp);
    bell.connect(bellAmp);
    bellAmp.connect(amp);
    amp.connect(this.keysBus);

    [body, warm, bell].forEach((osc) => {
      osc.start(time);
      osc.stop(end + 0.8);
    });
  }

  // Lead uses the same piano an octave-aware touch brighter, panned off-centre
  playLead(midi, time, duration, velocity) {
    this.playKey(midi, time, Math.max(0.25, duration), velocity);
  }

  playBass(pitchClass, time, duration, velocity) {
    const ctx = this.ctx;
    let midi = 36 + (pitchClass % 12);
    if (midi > 45) midi -= 12;
    const freq = midiToFreq(midi);
    const sub = ctx.createOscillator();
    const growl = ctx.createOscillator();
    const growlAmp = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    sub.type = 'sine';
    growl.type = 'triangle';
    sub.frequency.value = freq;
    growl.frequency.value = freq * 2;
    growlAmp.gain.value = 0.25;
    tone.type = 'lowpass';
    tone.frequency.value = 420;

    const peak = 0.34 * velocity;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(peak, time + 0.015);
    amp.gain.exponentialRampToValueAtTime(peak * 0.6, time + duration * 0.6);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.12);

    sub.connect(tone);
    growl.connect(growlAmp);
    growlAmp.connect(tone);
    tone.connect(amp);
    amp.connect(this.bassBus);
    [sub, growl].forEach((osc) => {
      osc.start(time);
      osc.stop(time + duration + 0.2);
    });
  }

  playKick(time, velocity) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.12);
    amp.gain.setValueAtTime(0.9 * velocity, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(amp);
    amp.connect(this.drumBus);
    osc.start(time);
    osc.stop(time + 0.32);

    // Sidechain pump on the music bus
    this.duck.gain.setValueAtTime(1, time);
    this.duck.gain.linearRampToValueAtTime(1 - 0.22 * velocity, time + 0.02);
    this.duck.gain.linearRampToValueAtTime(1, time + 0.26);
  }

  playSnare(time, velocity, rim) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteNoise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = rim ? 2600 : 1700;
    band.Q.value = rim ? 3 : 0.8;
    const amp = ctx.createGain();
    const length = rim ? 0.05 : 0.16;
    amp.gain.setValueAtTime((rim ? 0.3 : 0.42) * velocity, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + length);
    noise.connect(band);
    band.connect(amp);
    amp.connect(this.drumBus);
    noise.start(time);
    noise.stop(time + length + 0.02);

    if (!rim) {
      const body = ctx.createOscillator();
      const bodyAmp = ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(210, time);
      body.frequency.exponentialRampToValueAtTime(150, time + 0.08);
      bodyAmp.gain.setValueAtTime(0.22 * velocity, time);
      bodyAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
      body.connect(bodyAmp);
      bodyAmp.connect(this.drumBus);
      body.start(time);
      body.stop(time + 0.12);
    }
  }

  playHat(time, velocity) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.whiteNoise;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 7000;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.16 * velocity, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    noise.connect(high);
    high.connect(amp);
    amp.connect(this.drumBus);
    noise.start(time);
    noise.stop(time + 0.06);
  }
}

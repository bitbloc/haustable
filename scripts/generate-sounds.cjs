/**
 * generate-sounds.js
 * Generates retro 8-bit WAV sound effects for the Flappy Cat arcade game.
 * Run: node scripts/generate-sounds.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050; // Low sample rate for retro feel
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'arcade', 'audio');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── WAV File Writer ───────────────────────────────────────────────
function writeWav(filename, samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // 16-bit mono
  const blockAlign = 2;
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;       // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;        // PCM format
  buffer.writeUInt16LE(1, offset); offset += 2;        // mono
  buffer.writeUInt32LE(SAMPLE_RATE, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(16, offset); offset += 2;       // bits per sample

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Write PCM samples (16-bit signed)
  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), offset);
    offset += 2;
  }

  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Created: ${filePath} (${(fileSize / 1024).toFixed(1)} KB)`);
}

// ─── Waveform Generators ───────────────────────────────────────────
function squareWave(freq, t, duty = 0.5) {
  const period = SAMPLE_RATE / freq;
  return ((t % period) / period < duty) ? 1 : -1;
}

function noise() {
  return Math.random() * 2 - 1;
}

// ─── 1. Jump Sound (0.15s) - Quick ascending chirp ─────────────────
function generateJump() {
  const duration = 0.15;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / numSamples;
    // Frequency sweeps from 300Hz to 800Hz
    const freq = 300 + progress * 500;
    const envelope = 1 - progress; // Fade out
    samples[i] = squareWave(freq, i) * envelope * 0.5;
  }

  writeWav('jump.wav', samples);
}

// ─── 2. Point / Coin Sound (0.3s) - Two-tone ding ─────────────────
function generatePoint() {
  const duration = 0.3;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / numSamples;
    // Two notes: E5 (659Hz) then B5 (988Hz)
    const freq = t < 0.1 ? 659 : 988;
    const envelope = Math.max(0, 1 - progress * 2);
    samples[i] = squareWave(freq, i, 0.25) * envelope * 0.4;
  }

  writeWav('point.wav', samples);
}

// ─── 3. Hit / Crash Sound (0.4s) - Noise burst + descending tone ──
function generateHit() {
  const duration = 0.4;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const progress = i / numSamples;
    // Descending frequency from 400Hz to 60Hz
    const freq = 400 - progress * 340;
    const envelope = Math.max(0, 1 - progress * 1.5);
    // Mix square wave + noise for crunchy impact
    const tone = squareWave(freq, i) * 0.4;
    const nz = noise() * 0.3 * Math.max(0, 1 - progress * 3);
    samples[i] = (tone + nz) * envelope;
  }

  writeWav('hit.wav', samples);
}

// ─── 4. Game Over Sound (1.5s) - Sad descending melody ─────────────
function generateGameOver() {
  const notes = [
    { freq: 523, dur: 0.25 },  // C5
    { freq: 494, dur: 0.25 },  // B4
    { freq: 440, dur: 0.25 },  // A4
    { freq: 349, dur: 0.5  },  // F4 (held longer)
    { freq: 262, dur: 0.3  },  // C4 (final low note)
  ];

  let totalDuration = notes.reduce((sum, n) => sum + n.dur, 0);
  const numSamples = Math.floor(SAMPLE_RATE * totalDuration);
  const samples = new Float32Array(numSamples);

  let sampleOffset = 0;
  for (const note of notes) {
    const noteSamples = Math.floor(SAMPLE_RATE * note.dur);
    for (let i = 0; i < noteSamples; i++) {
      const progress = i / noteSamples;
      // Envelope: quick attack, sustain, release at end
      let envelope = 1;
      if (progress < 0.05) envelope = progress / 0.05; // attack
      if (progress > 0.7) envelope = (1 - progress) / 0.3; // release
      
      const idx = sampleOffset + i;
      if (idx < numSamples) {
        samples[idx] = squareWave(note.freq, i, 0.3) * envelope * 0.35;
      }
    }
    sampleOffset += noteSamples;
  }

  writeWav('gameover.wav', samples);
}

// ─── 5. Background Music (30s loop) - Upbeat chiptune ──────────────
function generateBGM() {
  const bpm = 140;
  const beatDur = 60 / bpm; // ~0.43s per beat
  const sixteenth = beatDur / 4;

  // Simple catchy 8-bar melody (notes as [freq, duration_in_16ths])
  // Using pentatonic scale for pleasant retro feel
  const melody = [
    // Bar 1-2: Catchy intro riff
    [523, 2], [659, 2], [784, 2], [659, 2],  // C5 E5 G5 E5
    [523, 2], [784, 2], [659, 4],              // C5 G5 E5(hold)
    // Bar 3-4
    [587, 2], [698, 2], [880, 2], [698, 2],  // D5 F5 A5 F5
    [587, 2], [880, 2], [698, 4],              // D5 A5 F5(hold)
    // Bar 5-6: Variation
    [523, 2], [659, 1], [784, 1], [880, 2], [784, 2],  // C5 E5 G5 A5 G5
    [659, 2], [523, 2], [659, 4],                        // E5 C5 E5(hold)
    // Bar 7-8: Resolution
    [784, 2], [659, 2], [523, 2], [392, 2],  // G5 E5 C5 G4
    [440, 2], [523, 2], [523, 4],              // A4 C5 C5(hold)
  ];

  // Bass line (lower octave, follows root notes)
  const bassLine = [
    [131, 8], [131, 8],  // C3
    [147, 8], [147, 8],  // D3
    [131, 8], [131, 8],  // C3
    [196, 8], [131, 8],  // G3 C3
  ];

  // Calculate total duration
  let totalSixteenths = 0;
  for (const [, dur] of melody) totalSixteenths += dur;
  const totalDuration = totalSixteenths * sixteenth;
  const numSamples = Math.floor(SAMPLE_RATE * totalDuration);
  const samples = new Float32Array(numSamples);

  // Render melody
  let pos = 0;
  for (const [freq, dur] of melody) {
    const noteSamples = Math.floor(SAMPLE_RATE * dur * sixteenth);
    for (let i = 0; i < noteSamples; i++) {
      const progress = i / noteSamples;
      let envelope = 0.8;
      if (progress < 0.02) envelope = (progress / 0.02) * 0.8;
      if (progress > 0.85) envelope = ((1 - progress) / 0.15) * 0.8;
      
      const idx = pos + i;
      if (idx < numSamples) {
        samples[idx] += squareWave(freq, i, 0.25) * envelope * 0.25;
      }
    }
    pos += noteSamples;
  }

  // Render bass
  pos = 0;
  for (const [freq, dur] of bassLine) {
    const noteSamples = Math.floor(SAMPLE_RATE * dur * sixteenth);
    for (let i = 0; i < noteSamples; i++) {
      const progress = i / noteSamples;
      let envelope = 0.6;
      if (progress > 0.9) envelope = ((1 - progress) / 0.1) * 0.6;
      
      const idx = pos + i;
      if (idx < numSamples) {
        samples[idx] += squareWave(freq, i, 0.5) * envelope * 0.2;
      }
    }
    pos += noteSamples;
  }

  // Add a simple hi-hat rhythm (noise on every other 16th)
  const totalSamplesPerSixteenth = Math.floor(SAMPLE_RATE * sixteenth);
  for (let beat = 0; beat < totalSixteenths; beat++) {
    if (beat % 2 === 0) {
      const startSample = beat * totalSamplesPerSixteenth;
      const hihatDuration = Math.floor(SAMPLE_RATE * 0.03);
      for (let i = 0; i < hihatDuration; i++) {
        const idx = startSample + i;
        if (idx < numSamples) {
          const env = 1 - (i / hihatDuration);
          samples[idx] += noise() * env * 0.08;
        }
      }
    }
  }

  writeWav('bgm.wav', samples);
}

// ─── Run All Generators ────────────────────────────────────────────
console.log('🎮 Generating Retro 8-bit Sound Effects...\n');
generateJump();
generatePoint();
generateHit();
generateGameOver();
generateBGM();
console.log('\n🎶 All sound effects generated successfully!');

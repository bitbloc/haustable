/**
 * pixelSoundEngine.js
 * 8-Bit / 16-Bit Pop-Pixel Chiptune Sound Synthesizer & Unified Arcade Rank System
 * Built with Web Audio API for zero-latency retro arcade feedback.
 */

class PixelSoundEngine {
  constructor() {
    this.ctx = null;
    let initialMuted = false;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        initialMuted = window.localStorage.getItem('arcade_sound_muted') === 'true';
      }
    } catch (e) {}
    this.muted = initialMuted;
  }

  getContext() {
    if (this.muted || typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch (e) {
      return null;
    }
  }

  setMuted(isMuted) {
    this.muted = !!isMuted;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('arcade_sound_muted', this.muted ? 'true' : 'false');
      }
    } catch (e) {}
  }

  isMuted() {
    return this.muted;
  }

  isSoundEnabled() {
    return !this.muted;
  }

  setSoundEnabled(enabled) {
    this.setMuted(!enabled);
  }

  toggleSound() {
    this.setMuted(!this.muted);
    return !this.muted;
  }

  // Helper to play a quick note with envelope
  playTone(ctx, { freq, endFreq = null, type = 'square', start = 0, duration = 0.1, vol = 0.12 }) {
    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // Helper to play retro 8-bit noise burst (for explosions, smashes, hits, snare)
  playNoise(ctx, { start = 0, duration = 0.15, vol = 0.14, filterFreq = 1200, filterType = 'bandpass' }) {
    const now = ctx.currentTime + start;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Step-quantized LFSR-like retro crunch noise
    let hold = 0;
    for (let i = 0; i < bufferSize; i++) {
      if (i % 3 === 0) hold = Math.random() * 2 - 1;
      data[i] = hold;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.01);
  }

  play(type) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      switch (type) {
        case 'ui_click': {
          this.playTone(ctx, { freq: 784, endFreq: 1046.5, type: 'square', duration: 0.045, vol: 0.07 });
          break;
        }
        case 'char_select': {
          this.playTone(ctx, { freq: 523.25, type: 'square', start: 0, duration: 0.05, vol: 0.08 });
          this.playTone(ctx, { freq: 659.25, type: 'square', start: 0.045, duration: 0.05, vol: 0.08 });
          this.playTone(ctx, { freq: 1046.5, type: 'triangle', start: 0.09, duration: 0.11, vol: 0.11 });
          break;
        }
        case 'jump':
        case 'flap': {
          // Snappy 8-bit rising pulse jump + soft air pop
          this.playTone(ctx, { freq: 230, endFreq: 640, type: 'square', start: 0, duration: 0.11, vol: 0.09 });
          this.playTone(ctx, { freq: 340, endFreq: 880, type: 'triangle', start: 0.02, duration: 0.09, vol: 0.08 });
          break;
        }
        case 'double_jump': {
          this.playTone(ctx, { freq: 523.25, endFreq: 783.99, type: 'square', start: 0, duration: 0.06, vol: 0.09 });
          this.playTone(ctx, { freq: 783.99, endFreq: 1174.66, type: 'triangle', start: 0.05, duration: 0.10, vol: 0.11 });
          break;
        }
        case 'triple_jump': {
          const notes = [587.33, 880.0, 1174.66, 1567.98];
          notes.forEach((f, idx) => {
            this.playTone(ctx, { freq: f, type: 'triangle', start: idx * 0.035, duration: 0.07, vol: 0.11 });
          });
          break;
        }
        case 'spring': {
          this.playTone(ctx, { freq: 220, endFreq: 587.33, type: 'square', start: 0, duration: 0.08, vol: 0.10 });
          this.playTone(ctx, { freq: 440, endFreq: 1174.66, type: 'triangle', start: 0.06, duration: 0.16, vol: 0.13 });
          break;
        }
        case 'point':
        case 'collect': {
          // Classic Retro Coin Ding (B5 -> E6) with warm triangle shimmer
          this.playTone(ctx, { freq: 987.77, type: 'square', start: 0, duration: 0.065, vol: 0.09 });
          this.playTone(ctx, { freq: 1318.51, type: 'square', start: 0.065, duration: 0.19, vol: 0.10 });
          this.playTone(ctx, { freq: 1975.53, type: 'triangle', start: 0.065, duration: 0.16, vol: 0.06 });
          break;
        }
        case 'pot_complete': {
          // Cooking Master Fanfare (C5 - E5 - G5 - C6 - E6)
          const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
          notes.forEach((f, i) => {
            this.playTone(ctx, { freq: f, type: 'square', start: i * 0.055, duration: i === 4 ? 0.22 : 0.07, vol: 0.11 });
            this.playTone(ctx, { freq: f * 0.5, type: 'triangle', start: i * 0.055, duration: i === 4 ? 0.22 : 0.07, vol: 0.08 });
          });
          break;
        }
        case 'bean_powerup':
        case 'god_mode': {
          // Super Satow Powerup 16-bit ascending arpeggio
          const arp = [329.63, 440.0, 554.37, 659.25, 880.0, 1108.73, 1318.51];
          arp.forEach((f, i) => {
            this.playTone(ctx, { freq: f, type: 'square', start: i * 0.04, duration: 0.08, vol: 0.10 });
          });
          break;
        }
        case 'golden_mortar':
        case 'fever_start': {
          // Sparkling Jackpot Arpeggio
          const chord = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98, 2093.0];
          chord.forEach((f, i) => {
            this.playTone(ctx, { freq: f, type: 'triangle', start: i * 0.042, duration: 0.14, vol: 0.13 });
            if (i % 2 === 0) {
              this.playTone(ctx, { freq: f * 0.5, type: 'square', start: i * 0.042, duration: 0.10, vol: 0.07 });
            }
          });
          break;
        }
        case 'tier_up':
        case 'rank_up': {
          // Royal Arcade Rank-Up Fanfare
          const brass = [
            { f: 440.0, s: 0, d: 0.07 },
            { f: 440.0, s: 0.08, d: 0.07 },
            { f: 440.0, s: 0.16, d: 0.07 },
            { f: 587.33, s: 0.24, d: 0.18 },
            { f: 523.25, s: 0.44, d: 0.08 },
            { f: 659.25, s: 0.53, d: 0.08 },
            { f: 880.0, s: 0.62, d: 0.28 }
          ];
          brass.forEach(n => {
            this.playTone(ctx, { freq: n.f, type: 'square', start: n.s, duration: n.d, vol: 0.10 });
            this.playTone(ctx, { freq: n.f * 0.5, type: 'triangle', start: n.s, duration: n.d, vol: 0.09 });
          });
          break;
        }
        case 'warning': {
          // Retro Incoming Hazard Alert (Beep-Beep!)
          this.playTone(ctx, { freq: 880, endFreq: 987.77, type: 'square', start: 0, duration: 0.06, vol: 0.08 });
          this.playTone(ctx, { freq: 880, endFreq: 987.77, type: 'square', start: 0.09, duration: 0.06, vol: 0.08 });
          break;
        }
        case 'smash': {
          // Crunchy 8-bit obstacle smash in Dash / God Mode
          this.playNoise(ctx, { start: 0, duration: 0.16, vol: 0.16, filterFreq: 950, filterType: 'bandpass' });
          this.playTone(ctx, { freq: 380, endFreq: 75, type: 'sawtooth', start: 0, duration: 0.15, vol: 0.13 });
          this.playTone(ctx, { freq: 587.33, endFreq: 880, type: 'square', start: 0.04, duration: 0.09, vol: 0.08 });
          break;
        }
        case 'mortar_smash': {
          this.playNoise(ctx, { start: 0, duration: 0.24, vol: 0.20, filterFreq: 550, filterType: 'lowpass' });
          this.playTone(ctx, { freq: 180, endFreq: 35, type: 'square', start: 0, duration: 0.24, vol: 0.18 });
          break;
        }
        case 'thunder': {
          this.playNoise(ctx, { start: 0, duration: 0.25, vol: 0.18, filterFreq: 1800, filterType: 'bandpass' });
          this.playTone(ctx, { freq: 240, endFreq: 42, type: 'sawtooth', start: 0, duration: 0.22, vol: 0.14 });
          break;
        }
        case 'meow': {
          this.playTone(ctx, { freq: 660, endFreq: 1120, type: 'triangle', start: 0, duration: 0.09, vol: 0.11 });
          this.playTone(ctx, { freq: 1120, endFreq: 760, type: 'sine', start: 0.08, duration: 0.12, vol: 0.10 });
          break;
        }
        case 'hit': {
          this.playNoise(ctx, { start: 0, duration: 0.22, vol: 0.18, filterFreq: 750, filterType: 'lowpass' });
          this.playTone(ctx, { freq: 280, endFreq: 45, type: 'sawtooth', start: 0, duration: 0.22, vol: 0.15 });
          break;
        }
        case 'gameover': {
          // Classic Retro Arcade Game Over cadence
          const sadNotes = [
            { f: 523.25, s: 0.0, d: 0.14 },
            { f: 493.88, s: 0.15, d: 0.14 },
            { f: 466.16, s: 0.30, d: 0.14 },
            { f: 440.00, s: 0.45, d: 0.36 }
          ];
          sadNotes.forEach(n => {
            this.playTone(ctx, { freq: n.f, endFreq: n.f * 0.96, type: 'square', start: n.s, duration: n.d, vol: 0.10 });
            this.playTone(ctx, { freq: n.f * 0.5, type: 'triangle', start: n.s, duration: n.d, vol: 0.09 });
          });
          break;
        }
        default:
          break;
      }
    } catch (e) {
      // Ignore audio context restrictions
    }
  }
}

export const pixelSound = new PixelSoundEngine();

/**
 * Unified Haus Arcade Rank System
 * Evaluates a player's score according to the game mode ('flappy' | 'tai_pla' | 'leaderboard')
 * and returns complete Rank Badge metadata, Thai/English titles, and reward unlock progress.
 */
export function getArcadeRank(score = 0, mode = 'leaderboard') {
  const numScore = Math.max(0, Number(score) || 0);

  // Thresholds:
  // Flappy Cat (Pipe count): S+ >= 40, S >= 35, A >= 20, B >= 10, C < 10
  // Tai-Pla Run (Runner points): S+ >= 100, S >= 60, A >= 35, B >= 15, C < 15
  // Unified Leaderboard: Uses standard Arcade Reward milestones (40+ = S+, 35+ = S, 20+ = A, 10+ = B, <10 = C)
  const isRunner = mode === 'tai_pla';
  const tSPlus = isRunner ? 100 : 40;
  const tS = isRunner ? 60 : 35;
  const tA = isRunner ? 35 : 20;
  const tB = isRunner ? 15 : 10;

  if (numScore >= tSPlus) {
    return {
      rank: 'S+',
      tier: 'S+',
      code: 'RANK S+',
      badge: '[RANK S+]',
      title: 'ตำนานพญานาคริมโขง',
      titleTh: 'ตำนานพญานาคริมโขง',
      engTitle: 'MEKONG LEGEND',
      hex: '#facc15',
      textHex: '#181615',
      badgeClass: 'bg-[#E9F344] text-[#181615] border-[#181615]',
      darkBadgeClass: 'bg-[#E9F344] text-[#181615] border-[#FAF7F5]',
      badgeBg: 'bg-[#E9F344]',
      badgeText: 'text-[#181615]',
      badgeBorder: 'border-[#181615]',
      rewardText: 'ปลดล็อกครบทุกภารกิจ (+2.00 XH & ตั๋วสุ่ม 50 XH)',
      nextTarget: null,
      nextRank: null,
      nextTier: null
    };
  }

  if (numScore >= tS) {
    return {
      rank: 'S',
      tier: 'S',
      code: 'RANK S',
      badge: '[RANK S]',
      title: 'ยอดฝีมือคนในบ้าน',
      titleTh: 'ยอดฝีมือคนในบ้าน',
      engTitle: 'INNER MASTER',
      hex: '#fb923c',
      textHex: '#181615',
      badgeClass: 'bg-amber-300 text-[#181615] border-[#181615]',
      darkBadgeClass: 'bg-amber-400 text-[#181615] border-[#181615]',
      badgeBg: 'bg-amber-300',
      badgeText: 'text-[#181615]',
      badgeBorder: 'border-[#181615]',
      rewardText: 'ปลดล็อกโบนัส 35P (+2.00 XH สะสมรายวัน)',
      nextTarget: tSPlus,
      nextRank: 'S+',
      nextTier: 'S+'
    };
  }

  if (numScore >= tA) {
    return {
      rank: 'A',
      tier: 'A',
      code: 'RANK A',
      badge: '[RANK A]',
      title: 'จอมยุทธ์เผ็ดปากเปิด',
      titleTh: 'จอมยุทธ์เผ็ดปากเปิด',
      engTitle: 'SPICY VANGUARD',
      hex: '#4ade80',
      textHex: '#181615',
      badgeClass: 'bg-emerald-200 text-emerald-950 border-[#181615]',
      darkBadgeClass: 'bg-emerald-400 text-[#181615] border-[#181615]',
      badgeBg: 'bg-emerald-200',
      badgeText: 'text-emerald-950',
      badgeBorder: 'border-[#181615]',
      rewardText: 'ปลดล็อกโบนัส 20P (+1.00 XH รายวัน)',
      nextTarget: tS,
      nextRank: 'S',
      nextTier: 'S'
    };
  }

  if (numScore >= tB) {
    return {
      rank: 'B',
      tier: 'B',
      code: 'RANK B',
      badge: '[RANK B]',
      title: 'นักวิ่งสายลมโขง',
      titleTh: 'นักวิ่งสายลมโขง',
      engTitle: 'RIVER SPRINTER',
      hex: '#38bdf8',
      textHex: '#181615',
      badgeClass: 'bg-sky-200 text-sky-950 border-[#181615]',
      darkBadgeClass: 'bg-sky-400 text-[#181615] border-[#181615]',
      badgeBg: 'bg-sky-200',
      badgeText: 'text-sky-950',
      badgeBorder: 'border-[#181615]',
      rewardText: `อีก ${tA - numScore} ${isRunner ? 'แต้ม' : 'ท่อ'} ปลดล็อกเหรียญ +1.00 XH`,
      nextTarget: tA,
      nextRank: 'A',
      nextTier: 'A'
    };
  }

  return {
    rank: 'C',
    tier: 'C',
    code: 'RANK C',
    badge: '[RANK C]',
    title: 'น้องใหม่ในบ้าน',
    titleTh: 'น้องใหม่ในบ้าน',
    engTitle: 'HAUS ROOKIE',
    hex: '#a8a29e',
    textHex: '#181615',
    badgeClass: 'bg-stone-200 text-stone-800 border-[#181615]/40',
    darkBadgeClass: 'bg-stone-700 text-stone-200 border-stone-500',
    badgeBg: 'bg-stone-200',
    badgeText: 'text-stone-800',
    badgeBorder: 'border-[#181615]/40',
    rewardText: `สะสมให้ถึง ${tB} ${isRunner ? 'แต้ม' : 'ท่อ'} เพื่อเลื่อนสู่ RANK B`,
    nextTarget: tB,
    nextRank: 'B',
    nextTier: 'B'
  };
}

/**
 * Deduplicates and normalizes Leaderboard entries so each unique player (by profile_id or display_name)
 * only occupies ONE rank slot with their highest recorded score.
 */
export function normalizeLeaderboard(rawEntries = [], localGuestEntries = []) {
  const playerMap = new Map();

  const processEntry = (entry) => {
    if (!entry) return;
    const rawName = (entry.display_name || entry.profiles?.nickname || entry.profiles?.display_name || 'GUEST').trim();
    const displayName = rawName.toUpperCase();
    const score = Math.max(0, parseInt(entry.score || 0, 10));
    const key = entry.profile_id ? `uid_${entry.profile_id}` : `name_${displayName}`;
    const nameKey = `name_${displayName}`;

    // Check if same player exists by key or identical display name
    const existingKey = playerMap.has(key) ? key : (playerMap.has(nameKey) ? nameKey : null);

    if (existingKey) {
      const existing = playerMap.get(existingKey);
      if (score > existing.score) {
        playerMap.set(existingKey, {
          ...existing,
          id: entry.id || existing.id,
          profile_id: entry.profile_id || existing.profile_id,
          display_name: displayName,
          score,
          created_at: entry.created_at || existing.created_at
        });
      }
    } else {
      const record = {
        id: entry.id || `lb_${Date.now()}_${Math.random()}`,
        profile_id: entry.profile_id || null,
        display_name: displayName,
        score,
        created_at: entry.created_at || new Date().toISOString()
      };
      playerMap.set(nameKey, record);
    }
  };

  (rawEntries || []).forEach(processEntry);
  (localGuestEntries || []).forEach(processEntry);

  return Array.from(playerMap.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
}

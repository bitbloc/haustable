/* Hallmark · component: TaiPlaMiniGame · genre: modern-minimal · theme: Atelier (128-Bit Pixel Neo-Arcade)
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 * contrast: pass (APCA / WCAG compliant)
 */
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { taiPlaRenderer } from './renderers/TaiPla128Renderer';
import { pixelSound, getArcadeRank } from './utils/pixelSoundEngine';

function PixelCharAvatar({ charId, size = 36, animate = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let animId = null;
    let tick = 0;

    const draw = () => {
      ctx.clearRect(0, 0, 48, 48);
      const sheet = taiPlaRenderer.sprites[charId] || taiPlaRenderer.sprites.tai_pla;
      if (sheet) {
        const frameIdx = animate ? Math.floor((tick / 8) % 4) : 0;
        ctx.drawImage(sheet, frameIdx * 48, 0, 48, 48, 0, 0, 48, 48);
      }
      if (animate) {
        tick++;
        animId = requestAnimationFrame(draw);
      }
    };
    draw();
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [charId, animate]);

  return (
    <canvas
      ref={ref}
      width={48}
      height={48}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      className="shrink-0 block"
    />
  );
}

const CHARACTERS = {
  tai_pla: {
    id: 'tai_pla',
    name: 'น้องไตปลามอน (Tai-Plamon)',
    title: 'WATER / SPICE CREATURE',
    desc: 'สิ่งมีชีวิตธาตุวารีและเครื่องแกงริมโขง • หางปลายาวประดับทับทิมแกงไตปลา คล่องแคล่วว่องไวพร้อมก้าวกระโดด 2 จังหวะ',
    trait: 'DOUBLE JUMP (วารีกระโดด 2 จังหวะ)',
    badgeColor: 'bg-sky-50 text-sky-900 border-sky-300',
    color: '#0284c7',
    maxJumps: 2,
    godModeBonus: 0,
    magnetRadius: 65,
    jumpPower: -17.2,
    doubleJumpPower: -15.2
  },
  som_satow: {
    id: 'som_satow',
    name: 'พี่ส้มสะตอกง (Satow-Beast)',
    title: 'FIRE / FLORA BEAST',
    desc: 'อสูรพืชพันธุ์และเปลวเพลิง • เขาฝักสะตอมรกตคู่โต ทรงพลัง แปลงร่างสะตอเพลิงได้นาน 3.5 วินาที (+1.0s)',
    trait: 'SOLAR GOD MODE (ร่างสะตอเพลิง 3.5 วิ)',
    badgeColor: 'bg-amber-50 text-amber-900 border-amber-300',
    color: '#ea580c',
    maxJumps: 1,
    godModeBonus: 1.0,
    magnetRadius: 65,
    jumpPower: -17.5
  },
  khao_lam: {
    id: 'khao_lam',
    name: 'เจ้าตูบข้าวหลาม (Bamboopup)',
    title: 'GRASS / EARTH PUPPY',
    desc: 'สิ่งมีชีวิตสายพืชและผืนดิน • ปลอกคอกระบอกไม้ไผ่พร้อมกระพรวนทองเหลืองโบราณ ดึงดูดอาหารและวัตถุระยะไกลพิเศษ',
    trait: 'SUPER MAGNET (กระพรวนดูดอาหารระยะไกล)',
    badgeColor: 'bg-stone-50 text-stone-900 border-stone-300',
    color: '#78716c',
    maxJumps: 1,
    godModeBonus: 0,
    magnetRadius: 105,
    jumpPower: -17.0
  },
  barista_cat: {
    id: 'barista_cat',
    name: 'บาริสต้าเหมียว (Barista Cat)',
    title: 'COFFEE / WIND FELINE',
    desc: 'แมวทักซิโด้บาริสต้าประจำร้านในบ้าน • สวมผ้ากันเปื้อนลินินและหมวกเบเร่ต์ ทะยานตัวด้วยสปริงฟองนมและดึงดูดเมล็ดกาแฟ',
    trait: 'STEAM LAUNCH (สปริงฟองนมดีดตัวสูง)',
    badgeColor: 'bg-amber-50 text-amber-900 border-amber-300',
    color: '#b45309',
    maxJumps: 2,
    godModeBonus: 0.5,
    magnetRadius: 80,
    jumpPower: -18.2,
    doubleJumpPower: -16.0
  },
  baby_naga: {
    id: 'baby_naga',
    name: 'พญานาคาน้อย (Baby Nakkhi)',
    title: 'SPIRIT / WATER SERPENT',
    desc: 'นาคาน้อยผู้พิทักษ์สายน้ำโขง • ลอยละล่องบนเมฆหมอกมรกต มีเศียรทองคำ 3 เศียร ร่อนเหินเวหา 3 จังหวะพร้อมรัศมีคุ้มภัย',
    trait: 'TRIPLE JUMP (ร่อนเหิน 3 จังหวะ)',
    badgeColor: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    color: '#059669',
    maxJumps: 3,
    godModeBonus: 1.0,
    magnetRadius: 95,
    jumpPower: -16.5,
    doubleJumpPower: -14.5
  }
};

const BGM_TRACKS = [
  { id: 'swing_jazz', name: 'SWING JAZZ', title: 'สวิงแจ๊สริมโขง (Mekong Swing)', bpm: 122 },
  { id: 'indie_rock', name: 'INDIE ROCK', title: 'ร็อกอินดี้ในบ้าน (Haus Rock)', bpm: 132 },
  { id: 'mekong_funk', name: 'SURF FUNK', title: 'ฟังก์หมอลำริมโขง (Surf Funk)', bpm: 112 },
  { id: 'sunset_lofi', name: 'SUNSET LO-FI', title: 'พระอาทิตย์อัสดง (Sunset Chords)', bpm: 86 }
];

export default function TaiPlaMiniGame({ session, onClaimScore, onRequireLogin, onCoinEarned, isDedicated = false, onBackToHub = null }) {
  const [selectedCharId, setSelectedCharId] = useState('tai_pla');
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'playing' | 'gameover'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('tai_pla_high_score') || '0', 10);
  });
  const [potIngredients, setPotIngredients] = useState({ fish: 0, satow: 0, bamboo: 0 });
  const [completedPots, setCompletedPots] = useState(0);
  const [earnedXhaus, setEarnedXhaus] = useState(0);
  const [godModeRemaining, setGodModeRemaining] = useState(0);
  const [happiness, setHappiness] = useState(0); // 0 to 100%
  const [isFeverActive, setIsFeverActive] = useState(false);
  const [feverRemaining, setFeverRemaining] = useState(0);
  const [currentSpicyTier, setCurrentSpicyTier] = useState(1); // 1: เผ็ดอนุบาล, 2: เผ็ดปากเปิด, 3: เผ็ดหูดับตับไหม้, 4: เผ็ดนรกแตก
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentBgmTrack, setCurrentBgmTrack] = useState('swing_jazz');
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canRestart, setCanRestart] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 640 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Vertical Portrait Ground Plane (Height 700, ground at 550)
  const defaultGroundY = 550;

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioCtxRef = useRef(null);
  const bgmIntervalRef = useRef(null);
  const bgmGainRef = useRef(null);

  const activeChar = CHARACTERS[selectedCharId] || CHARACTERS.tai_pla;

  // Mobile Tactile Haptic Trigger
  const triggerHaptic = (type) => {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      if (type === 'jump') navigator.vibrate(10);
      else if (type === 'double_jump') navigator.vibrate([10, 10]);
      else if (type === 'collect') navigator.vibrate(15);
      else if (type === 'pot_complete') navigator.vibrate([25, 35, 25]);
      else if (type === 'god_mode') navigator.vibrate([30, 40, 50]);
      else if (type === 'fever_start') navigator.vibrate([35, 45, 55]);
      else if (type === 'smash') navigator.vibrate([20, 30]);
      else if (type === 'hit') navigator.vibrate([40, 50, 40]);
      else if (type === 'spring') navigator.vibrate([15, 25]);
      else if (type === 'thunder') navigator.vibrate([30, 20, 40]);
      else if (type === 'mortar_smash') navigator.vibrate([50, 40, 60]);
      else if (type === 'tier_up') navigator.vibrate([20, 30, 40]);
    } catch (e) {}
  };

  // Smooth Game Physics & Engine References
  const gameRef = useRef({
    charId: 'tai_pla',
    catX: 75,
    catY: defaultGroundY,
    catVy: 0,
    isGrounded: true,
    jumpCount: 0,
    maxJumps: 2,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    godModeTimer: 0,
    godModeDuration: 2.5,
    feverTimer: 0,
    happiness: 0,
    score: 0,
    distanceRun: 0,
    lastDistanceScore: 0,
    potIngredients: { fish: 0, satow: 0, bamboo: 0 },
    items: [],
    monsters: [],
    elements: [],
    particles: [],
    floatingTexts: [],
    lastSpawn: 0,
    groundY: defaultGroundY,
    speed: 4.8,
    frame: 0,
    scaleX: 1.0,
    scaleY: 1.0,
    magnetRadius: 65,
    spicyTier: 1,
    lastUiSync: 0,
    hitShakeTimer: 0,
    tierAnnounceTimer: 0,
    tierAnnounceTitle: '',
    tierAnnounceSubtitle: ''
  });

  useEffect(() => {
    if (gameState !== 'idle') return;
    const gy = 550;
    gameRef.current.groundY = gy;
    gameRef.current.catY = gy;
    gameRef.current.catX = 75;

    // Render live animated Pop-Pixel preview on canvas while idle
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let previewAnim = null;
    let pFrame = 0;

    const renderIdlePreview = () => {
      pFrame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      taiPlaRenderer.drawBackground(ctx, canvas.width, canvas.height, gy, pFrame * 1.4, pFrame, 1, 0);
      taiPlaRenderer.drawCharacter(ctx, selectedCharId, 75, gy, pFrame, true, 0, 0, 1.0, 1.0, gy);
      previewAnim = requestAnimationFrame(renderIdlePreview);
    };
    previewAnim = requestAnimationFrame(renderIdlePreview);

    return () => {
      if (previewAnim) cancelAnimationFrame(previewAnim);
    };
  }, [gameState, selectedCharId]);

  // 8-Bit / 16-Bit Pop-Pixel Chiptune Synthesizer
  const playRetroSound = (type) => {
    if (!soundEnabled) return;
    pixelSound.setMuted(false);
    pixelSound.play(type);
    triggerHaptic(type);
  };

  // =========================================================================
  // 🎶 MULTI-GENRE WEB AUDIO BGM SYNTHESIZER (SWING JAZZ / ROCK / FUNK / LO-FI)
  // =========================================================================
  const stopBgm = () => {
    if (bgmIntervalRef.current) {
      clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
    if (bgmGainRef.current) {
      try {
        bgmGainRef.current.gain.linearRampToValueAtTime(0.0001, (audioCtxRef.current?.currentTime || 0) + 0.12);
      } catch (e) {}
    }
    setIsBgmPlaying(false);
  };

  const startBgm = (trackId = currentBgmTrack) => {
    stopBgm();
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const track = BGM_TRACKS.find(t => t.id === trackId) || BGM_TRACKS[0];
      const effectiveBpm = isFeverActive ? track.bpm * 1.2 : track.bpm;
      const stepTimeMs = (60000 / effectiveBpm) / 4; // 16th note in ms
      let step = 0;

      // Master BGM gain with warm low-pass filter so BGM sits smoothly under SFX
      const bgmFilter = ctx.createBiquadFilter();
      bgmFilter.type = 'lowpass';
      bgmFilter.frequency.setValueAtTime(3200, ctx.currentTime);

      const bgmGain = ctx.createGain();
      bgmGain.gain.setValueAtTime(0.18, ctx.currentTime);
      bgmFilter.connect(bgmGain);
      bgmGain.connect(ctx.destination);
      bgmGainRef.current = bgmGain;

      // Pre-generate crisp percussion noise buffer for hi-hats & snares
      const noiseLen = Math.floor(ctx.sampleRate * 0.12);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }

      const playDrumNoise = (now, freq, dur, vol, type = 'highpass') => {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const flt = ctx.createBiquadFilter();
        flt.type = type;
        flt.frequency.setValueAtTime(freq, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        src.connect(flt);
        flt.connect(g);
        g.connect(bgmFilter);
        src.start(now);
        src.stop(now + dur + 0.01);
      };

      const playKick = (now, startFreq = 135, vol = 0.16) => {
        const kick = ctx.createOscillator();
        const kg = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(startFreq, now);
        kick.frequency.exponentialRampToValueAtTime(36, now + 0.09);
        kg.gain.setValueAtTime(vol, now);
        kg.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
        kick.connect(kg);
        kg.connect(bgmFilter);
        kick.start(now);
        kick.stop(now + 0.11);
      };

      // Warm overdrive distortion curve for Indie Rock
      let distortionCurve = null;
      if (track.id === 'indie_rock') {
        const n = 256;
        const curve = new Float32Array(n);
        const deg = Math.PI / 180;
        const k = 32;
        for (let i = 0; i < n; i++) {
          const x = (i * 2) / n - 1;
          curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        distortionCurve = curve;
      }

      const scheduleStep = () => {
        if (!audioCtxRef.current || !soundEnabled) return;
        const now = ctx.currentTime;
        const s = step % 16;
        const bar = Math.floor(step / 16) % 8;

        // 1. Crisp Chiptune Drum & Rhythm Percussion
        if (track.id === 'swing_jazz') {
          // Swung Jazz Ride / Hi-Hat on 0, 4, 7, 8, 12, 15
          if (s === 0 || s === 4 || s === 7 || s === 8 || s === 12 || s === 15) {
            playDrumNoise(now, s === 7 || s === 15 ? 6800 : 8200, 0.045, s === 7 || s === 15 ? 0.035 : 0.06, 'highpass');
          }
          if (s === 0 || s === 8) playKick(now, 115, 0.13);
          if (s === 4 || s === 12) playDrumNoise(now, 1800, 0.07, 0.05, 'bandpass');
        } else if (track.id === 'indie_rock') {
          if (s === 0 || s === 8 || s === 10) playKick(now, 145, 0.18);
          if (s === 4 || s === 12) {
            playDrumNoise(now, 1400, 0.10, 0.11, 'bandpass');
            playKick(now, 190, 0.09);
          }
          if (s % 2 === 0) playDrumNoise(now, 7500, 0.035, 0.04, 'highpass');
        } else if (track.id === 'mekong_funk') {
          if (s === 0 || s === 6 || s === 10) playKick(now, 135, 0.17);
          if (s === 4 || s === 12) playDrumNoise(now, 1650, 0.085, 0.10, 'bandpass');
          if (s % 2 === 0) playDrumNoise(now, 8000, 0.03, s % 4 === 2 ? 0.055 : 0.03, 'highpass');
        } else if (track.id === 'sunset_lofi') {
          if (s === 0 || s === 10) playKick(now, 110, 0.14);
          if (s === 4 || s === 12) playDrumNoise(now, 1200, 0.08, 0.06, 'bandpass');
          if (s % 4 === 2) playDrumNoise(now, 6000, 0.04, 0.03, 'highpass');
        }

        // 2. Bass, Chords & Catchy Chiptune Lead Melodies
        if (track.id === 'swing_jazz') {
          // Walking Upright Bass on quarter beats (0, 4, 8, 12)
          if (s % 4 === 0) {
            const jazzWalking = [
              [73.42, 98.00, 110.00, 123.47],
              [98.00, 123.47, 130.81, 146.83],
              [130.81, 164.81, 146.83, 123.47],
              [110.00, 138.59, 146.83, 164.81],
              [92.50, 110.00, 130.81, 146.83],
              [123.47, 155.56, 174.61, 196.00],
              [82.41, 123.47, 146.83, 164.81],
              [69.30, 103.83, 123.47, 138.59]
            ];
            const quarter = Math.floor(s / 4);
            const freq = jazzWalking[bar][quarter];
            const bass = ctx.createOscillator();
            const bg = ctx.createGain();
            bass.type = 'triangle';
            bass.frequency.setValueAtTime(freq, now);
            bg.gain.setValueAtTime(0.15, now);
            bg.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
            bass.connect(bg);
            bg.connect(bgmFilter);
            bass.start(now);
            bass.stop(now + 0.25);
          }

          // Comping piano chords on syncopated off-beats (2, 7, 11)
          if (s === 2 || s === 7 || s === 11) {
            const jazzChords = [
              [293.66, 349.23, 440.00, 523.25],
              [246.94, 329.63, 349.23, 440.00],
              [261.63, 329.63, 392.00, 493.88],
              [220.00, 277.18, 349.23, 415.30],
              [349.23, 440.00, 523.25, 659.25],
              [311.13, 392.00, 493.88, 622.25],
              [329.63, 392.00, 493.88, 587.33],
              [277.18, 349.23, 415.30, 493.88]
            ];
            jazzChords[bar].forEach((f, idx) => {
              const pOsc = ctx.createOscillator();
              const pGain = ctx.createGain();
              pOsc.type = 'triangle';
              pOsc.frequency.setValueAtTime(f, now + idx * 0.01);
              pGain.gain.setValueAtTime(0.055, now + idx * 0.01);
              pGain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.01 + 0.24);
              pOsc.connect(pGain);
              pGain.connect(bgmFilter);
              pOsc.start(now + idx * 0.01);
              pOsc.stop(now + idx * 0.01 + 0.25);
            });
          }

          // Playful Jazz Vibraphone / Chiptune Lead Hook
          if (s === 0 || s === 3 || s === 6 || s === 10 || s === 14) {
            const jazzLead = [
              [587.33, 659.25, 783.99, 880.00, 659.25],
              [587.33, 493.88, 587.33, 659.25, 783.99],
              [523.25, 587.33, 659.25, 783.99, 987.77],
              [880.00, 783.99, 698.46, 659.25, 554.37],
              [659.25, 783.99, 880.00, 1046.50, 880.00],
              [783.99, 698.46, 622.25, 587.33, 493.88],
              [659.25, 587.33, 493.88, 587.33, 659.25],
              [554.37, 659.25, 783.99, 659.25, 587.33]
            ];
            const noteIdx = [0, 3, 6, 10, 14].indexOf(s);
            const lFreq = jazzLead[bar][noteIdx];
            if (lFreq) {
              const lOsc = ctx.createOscillator();
              const lGain = ctx.createGain();
              lOsc.type = 'sine';
              lOsc.frequency.setValueAtTime(lFreq, now);
              lGain.gain.setValueAtTime(0.075, now);
              lGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
              lOsc.connect(lGain);
              lGain.connect(bgmFilter);
              lOsc.start(now);
              lOsc.stop(now + 0.23);
            }
          }
        } else if (track.id === 'indie_rock') {
          if (s % 2 === 0) {
            const rockRoots = [110.00, 87.31, 130.81, 98.00, 73.42, 82.41, 92.50, 82.41];
            const bass = ctx.createOscillator();
            const bg = ctx.createGain();
            bass.type = 'sawtooth';
            bass.frequency.setValueAtTime(rockRoots[bar], now);
            bg.gain.setValueAtTime(0.10, now);
            bg.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
            bass.connect(bg);
            bg.connect(bgmFilter);
            bass.start(now);
            bass.stop(now + 0.14);
          }

          if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) {
            const guitarMelody = [
              [440.00, 523.25, 659.25, 523.25, 440.00, 392.00],
              [349.23, 440.00, 523.25, 440.00, 349.23, 329.63],
              [523.25, 659.25, 783.99, 659.25, 523.25, 440.00],
              [392.00, 493.88, 587.33, 493.88, 392.00, 349.23],
              [587.33, 659.25, 783.99, 880.00, 783.99, 659.25],
              [659.25, 783.99, 880.00, 987.77, 880.00, 783.99],
              [739.99, 880.00, 987.77, 1108.73, 987.77, 880.00],
              [659.25, 783.99, 880.00, 783.99, 659.25, 587.33]
            ];
            const noteIdx = [0, 3, 6, 8, 11, 14].indexOf(s);
            const freq = guitarMelody[bar][noteIdx];
            const gOsc = ctx.createOscillator();
            const gGain = ctx.createGain();
            gOsc.type = 'square';
            gOsc.frequency.setValueAtTime(freq, now);

            if (distortionCurve) {
              const shaper = ctx.createWaveShaper();
              shaper.curve = distortionCurve;
              gOsc.connect(shaper);
              shaper.connect(gGain);
            } else {
              gOsc.connect(gGain);
            }

            gGain.gain.setValueAtTime(0.065, now);
            gGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            gGain.connect(bgmFilter);
            gOsc.start(now);
            gOsc.stop(now + 0.20);
          }
        } else if (track.id === 'mekong_funk') {
          // Funky Slap Bassline
          if (s === 0 || s === 3 || s === 8 || s === 10 || s === 14) {
            const funkBass = [82.41, 110.00, 98.00, 123.47, 110.00, 146.83, 98.00, 123.47];
            const bOsc = ctx.createOscillator();
            const bGain = ctx.createGain();
            bOsc.type = 'triangle';
            bOsc.frequency.setValueAtTime(funkBass[bar] * (s === 3 || s === 14 ? 2 : 1), now);
            bGain.gain.setValueAtTime(0.14, now);
            bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
            bOsc.connect(bGain);
            bGain.connect(bgmFilter);
            bOsc.start(now);
            bOsc.stop(now + 0.15);
          }
          // Isan Phin / Surf Pentatonic Lead Riffs
          if (s === 0 || s === 2 || s === 6 || s === 9 || s === 12 || s === 14) {
            const funkScale = bar < 4
              ? [329.63, 392.00, 440.00, 523.25, 587.33, 659.25]
              : [440.00, 493.88, 587.33, 659.25, 783.99, 880.00];
            const fNote = funkScale[(s + bar * 2) % funkScale.length];
            const fOsc = ctx.createOscillator();
            const fg = ctx.createGain();
            fOsc.type = 'square';
            fOsc.frequency.setValueAtTime(fNote, now);
            fg.gain.setValueAtTime(0.06, now);
            fg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            fOsc.connect(fg);
            fg.connect(bgmFilter);
            fOsc.start(now);
            fOsc.stop(now + 0.16);
          }
        } else if (track.id === 'sunset_lofi') {
          // Warm Rhodes Lo-Fi Chords + Gentle Bell Top Melody
          if (s === 0 || s === 8) {
            const lofiChords = [
              [174.61, 261.63, 329.63, 392.00, 440.00],
              [164.81, 246.94, 293.66, 349.23, 392.00],
              [146.83, 293.66, 349.23, 440.00, 523.25],
              [130.81, 261.63, 329.63, 392.00, 493.88],
              [116.54, 233.08, 293.66, 349.23, 440.00],
              [110.00, 220.00, 261.63, 329.63, 392.00],
              [98.00, 196.00, 293.66, 349.23, 440.00],
              [130.81, 261.63, 349.23, 392.00, 523.25]
            ];
            const notes = lofiChords[bar];
            notes.forEach((f, idx) => {
              const lOsc = ctx.createOscillator();
              const lg = ctx.createGain();
              lOsc.type = idx === 0 ? 'triangle' : 'sine';
              lOsc.frequency.setValueAtTime(f, now + idx * 0.025);
              lg.gain.setValueAtTime(idx === 0 ? 0.11 : 0.065, now + idx * 0.025);
              lg.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.025 + 0.65);
              lOsc.connect(lg);
              lg.connect(bgmFilter);
              lOsc.start(now + idx * 0.025);
              lOsc.stop(now + idx * 0.025 + 0.70);
            });
          }
          if (s === 4 || s === 11 || s === 14) {
            const bellNotes = [523.25, 659.25, 783.99, 880.00, 1046.50, 783.99, 659.25, 587.33];
            const bf = bellNotes[(bar + s) % bellNotes.length];
            const bOsc = ctx.createOscillator();
            const bg = ctx.createGain();
            bOsc.type = 'sine';
            bOsc.frequency.setValueAtTime(bf, now);
            bg.gain.setValueAtTime(0.055, now);
            bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            bOsc.connect(bg);
            bg.connect(bgmFilter);
            bOsc.start(now);
            bOsc.stop(now + 0.38);
          }
        }

        step++;
      };

      bgmIntervalRef.current = setInterval(scheduleStep, stepTimeMs);
      setIsBgmPlaying(true);
    } catch (e) {
      console.error('Failed to start in-game BGM:', e);
    }
  };

  const cycleBgmTrack = () => {
    const currIdx = BGM_TRACKS.findIndex(t => t.id === currentBgmTrack);
    const nextTrack = BGM_TRACKS[(currIdx + 1) % BGM_TRACKS.length];
    setCurrentBgmTrack(nextTrack.id);
    playRetroSound('ui_click');
    if (gameState === 'playing' && soundEnabled) {
      startBgm(nextTrack.id);
    }
  };

  const startGame = () => {
    const char = CHARACTERS[selectedCharId] || CHARACTERS.tai_pla;
    setGameState('playing');
    setScore(0);
    setPotIngredients({ fish: 0, satow: 0, bamboo: 0 });
    setCompletedPots(0);
    setEarnedXhaus(0);
    setGodModeRemaining(0);
    setHappiness(0);
    setIsFeverActive(false);
    setFeverRemaining(0);
    setCurrentSpicyTier(1);
    setCanRestart(true);
    setIsClaiming(false);

    const startGroundY = 550;
    gameRef.current = {
      charId: char.id,
      catX: 75,
      catY: startGroundY,
      catVy: 0,
      isGrounded: true,
      jumpCount: 0,
      maxJumps: char.maxJumps,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      godModeTimer: 0,
      godModeDuration: 2.5 + (char.godModeBonus || 0),
      feverTimer: 0,
      happiness: 0,
      score: 0,
      distanceRun: 0,
      lastDistanceScore: 0,
      potIngredients: { fish: 0, satow: 0, bamboo: 0 },
      items: [],
      monsters: [],
      elements: [],
      particles: [],
      floatingTexts: [],
      lastSpawn: Date.now(),
      groundY: startGroundY,
      speed: 4.8,
      frame: 0,
      scaleX: 1.0,
      scaleY: 1.0,
      magnetRadius: char.magnetRadius,
      spicyTier: 1,
      lastUiSync: performance.now(),
      hitShakeTimer: 0,
      tierAnnounceTimer: 0,
      tierAnnounceTitle: '',
      tierAnnounceSubtitle: ''
    };

    playRetroSound('meow');
    startBgm(currentBgmTrack);
  };

  // Ultra-Snappy Jump with Double / Triple Jump & Coyote Time
  const handleJumpPress = () => {
    if (gameState !== 'playing') {
      if (gameState === 'idle') {
        startGame();
      }
      return;
    }

    const g = gameRef.current;
    const char = CHARACTERS[g.charId] || CHARACTERS.tai_pla;

    // Ground jump
    if (g.isGrounded || g.coyoteTimer > 0) {
      g.catVy = char.jumpPower || -17.2;
      g.isGrounded = false;
      g.jumpCount = 1;
      g.coyoteTimer = 0;
      g.scaleX = 0.85;
      g.scaleY = 1.25;
      playRetroSound('jump');

      // Sparkle / Dust particles on jump
      for (let i = 0; i < 6; i++) {
        g.particles.push({
          x: g.catX + 18 + (Math.random() * 12 - 6),
          y: g.groundY - 2,
          vx: (Math.random() - 0.7) * 2.5,
          vy: -Math.random() * 2.5,
          size: Math.random() * 4 + 2,
          color: g.feverTimer > 0 ? '#fde047' : (g.godModeTimer > 0 ? '#eab308' : '#fbbf24'),
          life: 0.75
        });
      }
    }
    // Mid-air Double / Triple Jump
    else if (g.jumpCount < g.maxJumps) {
      g.catVy = char.doubleJumpPower || -15.2;
      g.jumpCount += 1;
      const isTriple = g.jumpCount >= 3;
      g.scaleX = 0.78;
      g.scaleY = 1.32;
      playRetroSound(isTriple ? 'triple_jump' : 'double_jump');

      g.floatingTexts.push({
        x: g.catX + 4,
        y: g.catY - 46,
        text: isTriple ? 'TRIPLE NAGA GLIDE!' : 'DOUBLE JUMP!',
        color: isTriple ? '#facc15' : '#38bdf8',
        life: 0.95
      });

      // Ring of spin sparkles for mid-air flip
      for (let i = 0; i < (isTriple ? 12 : 8); i++) {
        const angle = (i / (isTriple ? 12 : 8)) * Math.PI * 2;
        g.particles.push({
          x: g.catX + 20 + Math.cos(angle) * 14,
          y: g.catY - 22 + Math.sin(angle) * 14,
          vx: Math.cos(angle) * 3.2,
          vy: Math.sin(angle) * 3.2,
          size: isTriple ? 4 : 3,
          color: isTriple ? '#facc15' : '#38bdf8',
          life: 0.65
        });
      }
    } else {
      g.jumpBufferTimer = 0.16;
    }
  };

  // BGM Life-cycle & Mute Synchronization
  useEffect(() => {
    if (!soundEnabled || gameState !== 'playing') {
      stopBgm();
    }
  }, [soundEnabled, gameState]);

  useEffect(() => {
    if (gameState === 'playing' && soundEnabled) {
      startBgm(currentBgmTrack);
    }
  }, [isFeverActive]);

  useEffect(() => {
    return () => {
      stopBgm();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'gameover') {
          if (canRestart && !isClaiming) startGame();
        } else {
          handleJumpPress();
        }
      } else if (e.code === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isFullscreen, selectedCharId, canRestart, isClaiming]);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const dt = Math.min(0.035, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const g = gameRef.current;
      g.frame++;
      g.distanceRun += g.speed * 1.0;

      // 1. God Mode Timer
      if (g.godModeTimer > 0) {
        g.godModeTimer = Math.max(0, g.godModeTimer - dt);
      }

      // 2. Happy Fever Mode Timer (8 seconds of 2x Multiplier + Golden Joy)
      if (g.feverTimer > 0) {
        g.feverTimer = Math.max(0, g.feverTimer - dt);
      }

      // 3. Distance Milestone Score (+1 point every 140px run, 2x in Fever)
      if (g.distanceRun - g.lastDistanceScore >= 140) {
        g.lastDistanceScore = g.distanceRun;
        const addPts = g.feverTimer > 0 ? 2 : 1;
        g.score += addPts;

        // Slowly build happiness while running smoothly
        g.happiness = Math.min(100, g.happiness + 1.5);
      }

      // Check Happiness Meter Trigger for Happy Fever Mode
      if (g.happiness >= 100 && g.feverTimer <= 0) {
        g.happiness = 0;
        g.feverTimer = 8.0;
        playRetroSound('fever_start');

        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.5 },
          colors: ['#fde047', '#f97316', '#22c55e', '#38bdf8']
        });

        g.floatingTexts.push({
          x: g.catX + 10,
          y: g.catY - 48,
          text: 'HAPPY FEVER! 2X PTS',
          color: '#f59e0b',
          life: 2.0
        });
      }

      // 4. Progressive Difficulty & 4 Spicy Tiers Scaling (Snappy & Challenging)
      let tier = 1;
      if (g.score >= 100) {
        tier = 4; // เผ็ดนรกแตก EXTREME (100+ PTS)
        g.speed = Math.min(14.0, 11.0 + Math.floor((g.score - 100) / 10) * 0.4);
      } else if (g.score >= 60) {
        tier = 3; // เผ็ดหูดับตับไหม้ (60-99 PTS)
        g.speed = Math.min(10.8, 8.5 + Math.floor((g.score - 60) / 6) * 0.35);
      } else if (g.score >= 25) {
        tier = 2; // เผ็ดปากเปิด (25-59 PTS)
        g.speed = Math.min(8.2, 6.2 + Math.floor((g.score - 25) / 5) * 0.28);
      } else {
        tier = 1; // เผ็ดอนุบาล (0-24 PTS)
        g.speed = Math.min(5.8, 4.5 + Math.floor(g.score / 4) * 0.22);
      }

      if (tier !== g.spicyTier) {
        g.spicyTier = tier;
        playRetroSound('tier_up');

        const tierMeta = {
          2: { title: '[ TIER 2 // 25+ PTS ] เผ็ดปากเปิด', sub: 'สปีดเร็วขึ้น • เพิ่มเหยี่ยวโขง, ผีหม้อดิน & ท่อไอน้ำเดือด' },
          3: { title: '[ TIER 3 // 60+ PTS ] เผ็ดหูดับตับไหม้', sub: 'คนหัวร้อน & สายฟ้าพญานาค • สปีดจัดจ้าน ใช้สปริงสะตอกระโดดหลบ!' },
          4: { title: '[ TIER 4 // 100+ PTS ] เผ็ดนรกแตก EXTREME', sub: 'สปีดสูงสุด 14.0+ • ครกหินยักษ์ถล่ม • เก็บครกหินทองคำลอยฟ้า +15 PTS!' }
        };
        const info = tierMeta[tier] || { title: `TIER ${tier}`, sub: '' };
        g.tierAnnounceTimer = 2.5;
        g.tierAnnounceTitle = info.title;
        g.tierAnnounceSubtitle = info.sub;

        g.floatingTexts.push({
          x: canvas.width / 2 - 80,
          y: 65,
          text: info.title,
          color: tier === 4 ? '#ef4444' : (tier === 3 ? '#f97316' : '#eab308'),
          life: 2.2
        });
      }

      // Throttled UI state sync: update React state every 200ms (5fps instead of 60fps)
      if (currentTime - g.lastUiSync >= 200) {
        g.lastUiSync = currentTime;
        setScore(g.score);
        setHappiness(Math.floor(g.happiness));
        setGodModeRemaining(Math.ceil(g.godModeTimer));
        setIsFeverActive(g.feverTimer > 0);
        setFeverRemaining(Math.ceil(g.feverTimer));
        setCurrentSpicyTier(g.spicyTier);
      }

      // 5. Platformer Physics (Crisp & Snappy Arcade Drop)
      if (g.isGrounded) {
        g.coyoteTimer = 0.08;
        g.jumpCount = 0;
      } else {
        g.coyoteTimer = Math.max(0, g.coyoteTimer - dt);
      }

      g.jumpBufferTimer = Math.max(0, g.jumpBufferTimer - dt);

      const gravity = g.catVy > 0 ? 46 : 38; // Snappy, decisive gravity for 700px height
      g.catVy += gravity * dt;
      g.catY += g.catVy;

      g.scaleX += (1.0 - g.scaleX) * 0.2;
      g.scaleY += (1.0 - g.scaleY) * 0.2;

      // Ground Collision
      if (g.catY >= g.groundY) {
        if (!g.isGrounded) {
          g.scaleX = 1.25;
          g.scaleY = 0.75;
          if (g.jumpBufferTimer > 0) {
            handleJumpPress();
          }
        }
        if (g.isGrounded || g.catVy >= 0) {
          g.catY = g.groundY;
          g.catVy = 0;
          g.isGrounded = true;
          g.jumpCount = 0;
        }
      }

      // 6. Spawn Director (Enemies, Elements, Ingredients based on Tier)
      const nowMs = Date.now();
      let spawnInterval = 1100 - g.score * 12;
      if (g.spicyTier === 2) spawnInterval = 850 - (g.score - 25) * 6;
      else if (g.spicyTier === 3) spawnInterval = 650 - (g.score - 60) * 4;
      else if (g.spicyTier === 4) spawnInterval = 480;
      spawnInterval = Math.max(450, spawnInterval);

      if (nowMs - g.lastSpawn > spawnInterval) {
        g.lastSpawn = nowMs;

        // A. Chance to spawn an Interactive Element (Satow Spring in Tier 3+, Steam Jet in Tier 2+)
        const hasSpring = g.elements.some(e => e.type === 'satow_spring');
        const hasSteam = g.elements.some(e => e.type === 'steam_jet');

        if (g.spicyTier >= 3 && !hasSpring && Math.random() < 0.20) {
          g.elements.push({
            type: 'satow_spring',
            x: canvas.width + 40,
            width: 36,
            isCompressed: false,
            compressTimer: 0
          });
        } else if (g.spicyTier >= 2 && !hasSteam && Math.random() < 0.22) {
          g.elements.push({
            type: 'steam_jet',
            x: canvas.width + 40,
            width: 28,
            cycleTimer: 0,
            isBursting: false
          });
        } 
        // B. Spawn Hazard Monster or Food Item
        else {
          // In high tiers or God Mode, heavily bias towards monsters
          const monsterChance = g.godModeTimer > 0 ? 0.90 : (g.spicyTier >= 3 ? 0.72 : (g.spicyTier >= 2 ? 0.58 : 0.45));
          const isMonster = Math.random() < monsterChance;

          if (isMonster) {
            const r = Math.random();
            let monsterType = 'hop_chili';

            if (g.spicyTier === 4) {
              // Tier 4: Giant Mortar, Naga Thunder, Hot Runner, Hawk
              if (r > 0.65) monsterType = 'giant_mortar';
              else if (r > 0.42) monsterType = 'naga_thunder';
              else if (r > 0.20) monsterType = 'hot_runner';
              else monsterType = 'hawk';
            } else if (g.spicyTier === 3) {
              // Tier 3: Hot Runner, Naga Thunder, Hawk, Pot Ghost, Hop Chili
              if (r > 0.68) monsterType = 'hot_runner';
              else if (r > 0.44) monsterType = 'naga_thunder';
              else if (r > 0.25) monsterType = 'hawk';
              else if (r > 0.12) monsterType = 'pot_ghost';
              else monsterType = 'hop_chili';
            } else if (g.spicyTier === 2) {
              // Tier 2: Hawk, Pot Ghost, Coconut, Hop Chili
              if (r > 0.65) monsterType = 'hawk';
              else if (r > 0.40) monsterType = 'pot_ghost';
              else if (r > 0.20) monsterType = 'coconut';
              else monsterType = 'hop_chili';
            } else {
              // Tier 1: Hop Chili, Coconut
              if (r > 0.45) monsterType = 'hop_chili';
              else monsterType = 'coconut';
            }

            const isFlying = monsterType === 'hawk';
            const isSkyFalling = monsterType === 'giant_mortar';
            const isThunder = monsterType === 'naga_thunder';

            const monY = isFlying ? g.groundY - 130 : (isSkyFalling ? -40 : g.groundY);
            const monW = isSkyFalling ? 52 : (isThunder ? 24 : (monsterType === 'hawk' ? 38 : (monsterType === 'hot_runner' ? 36 : (monsterType === 'coconut' ? 28 : 36))));
            const monH = isSkyFalling ? 52 : (isThunder ? g.groundY : (monsterType === 'hawk' ? 34 : (monsterType === 'hot_runner' ? 40 : (monsterType === 'coconut' ? 28 : 36))));
            const speedMul = monsterType === 'hot_runner' ? 1.45 : (monsterType === 'coconut' ? 1.35 : (monsterType === 'hawk' ? 1.2 : 1.0));

            g.monsters.push({
              x: canvas.width + 30,
              y: monY,
              vy: isSkyFalling ? 4.0 : 0,
              type: monsterType,
              width: monW,
              height: monH,
              speedMultiplier: speedMul,
              animPhase: Math.random() * Math.PI * 2,
              timer: 0,
              isTelegraph: isThunder
            });

            // Combo spawn in Tier 3 & 4: Ground obstacle followed closely by an aerial hawk
            if (g.spicyTier >= 3 && !isFlying && !isSkyFalling && !isThunder && Math.random() < 0.28) {
              g.monsters.push({
                x: canvas.width + 150,
                y: g.groundY - 130,
                vy: 0,
                type: 'hawk',
                width: 38,
                height: 34,
                speedMultiplier: 1.2,
                animPhase: Math.random() * Math.PI * 2,
                timer: 0,
                isTelegraph: false
              });
            }
          } else {
            // Food / Power-up Item
            // Recipe-gated satow: Only spawn satow if the player hasn't already collected one for the current pot!
            const needSatow = !g.potIngredients.satow;
            const r = Math.random();
            let foodType = 'fish';
            if (g.spicyTier === 4 && r > 0.88) {
              foodType = 'golden_mortar';
            } else if (needSatow && r > 0.55) {
              foodType = 'satow';
            } else if (r > 0.28) {
              foodType = 'fish';
            } else {
              foodType = 'bamboo';
            }

            // Multi-altitude vertical spawning (Low / Mid / High altitudes)
            const randH = Math.random();
            const itemY = foodType === 'golden_mortar' 
              ? g.groundY - 210 
              : (randH > 0.65 ? g.groundY - 170 : (randH > 0.35 ? g.groundY - 80 : g.groundY - 18));

            g.items.push({
              x: canvas.width + 20,
              y: itemY,
              type: foodType,
              bobOffset: Math.random() * Math.PI * 2,
              size: foodType === 'golden_mortar' ? 36 : 28
            });
          }
        }
      }

      // 7. Update Interactive Elements (Satow Spring, Steam Jet)
      for (let idx = g.elements.length - 1; idx >= 0; idx--) {
        const elem = g.elements[idx];
        elem.x -= g.speed;

        if (elem.type === 'satow_spring') {
          if (elem.isCompressed) {
            elem.compressTimer -= dt;
            if (elem.compressTimer <= 0) elem.isCompressed = false;
          }

          // Cat lands on spring from above
          const catBottom = g.catY;
          const springTop = g.groundY - 24;
          if (
            g.catX + 24 > elem.x &&
            g.catX + 8 < elem.x + elem.width &&
            catBottom >= springTop &&
            catBottom <= g.groundY + 8 &&
            g.catVy >= 0
          ) {
            g.catVy = -22.5; // Mega spring launch high into the upper vertical sky!
            g.isGrounded = false;
            g.jumpCount = 1;
            elem.isCompressed = true;
            elem.compressTimer = 0.25;
            g.scaleX = 0.7;
            g.scaleY = 1.4;
            playRetroSound('spring');

            const springPts = g.feverTimer > 0 ? 6 : 3;
            g.score += springPts;
            setScore(g.score);

            g.floatingTexts.push({
              x: elem.x,
              y: springTop - 15,
              text: `🟢 SPRING LAUNCH! +${springPts}`,
              color: '#22c55e',
              life: 1.2
            });

            for (let p = 0; p < 8; p++) {
              g.particles.push({
                x: elem.x + 18,
                y: springTop + 4,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 4 - 1,
                size: 3,
                color: '#86efac',
                life: 0.6
              });
            }
          }
        } else if (elem.type === 'steam_jet') {
          elem.cycleTimer = (elem.cycleTimer || 0) + dt;
          const cycle = elem.cycleTimer % 3.0;
          elem.isBursting = cycle > 1.8;

          // Steam hazard collision
          if (elem.isBursting) {
            const catBox = { left: g.catX + 8, right: g.catX + 24, top: g.catY - 24, bottom: g.catY };
            const steamBox = { left: elem.x + 6, right: elem.x + 22, top: g.groundY - 75, bottom: g.groundY };

            if (
              catBox.right > steamBox.left &&
              catBox.left < steamBox.right &&
              catBox.bottom > steamBox.top &&
              catBox.top < steamBox.bottom
            ) {
              if (g.godModeTimer > 0) {
                // Dissipate steam safely in God Mode
                elem.isBursting = false;
                g.score += 2;
                g.floatingTexts.push({
                  x: elem.x,
                  y: g.groundY - 40,
                  text: 'STEAM DEFLECTED! +2',
                  color: '#38bdf8',
                  life: 1.0
                });
              } else {
                // Scalded by steam -> Game Over
                triggerGameOver('hit');
                return;
              }
            }
          }
        }
      }
      g.elements = g.elements.filter(e => e.x > -50);

      // 8. Update Collectible Items (With Magnetic Pull)
      for (let idx = g.items.length - 1; idx >= 0; idx--) {
        const item = g.items[idx];
        item.x -= g.speed;
        const bob = Math.sin(g.frame * 0.1 + (item.bobOffset || 0)) * 4;
        const currentItemY = item.y + bob;

        const distCatX = g.catX + 16 - (item.x + item.size / 2);
        const distCatY = g.catY - 14 - (currentItemY + item.size / 2);
        const dist = Math.hypot(distCatX, distCatY);
        if (dist < g.magnetRadius) {
          const pullSpeed = g.charId === 'khao_lam' ? 0.38 : 0.24;
          item.x += distCatX * pullSpeed;
          item.y += distCatY * pullSpeed;
        }

        const catBox = { left: g.catX + 4, right: g.catX + 28, top: g.catY - 24, bottom: g.catY };
        const itemBox = { left: item.x, right: item.x + item.size, top: currentItemY, bottom: currentItemY + item.size };

        if (
          catBox.right > itemBox.left &&
          catBox.left < itemBox.right &&
          catBox.bottom > itemBox.top &&
          catBox.top < itemBox.bottom
        ) {
          g.items.splice(idx, 1);

          // Secret Item: Golden Mortar
          if (item.type === 'golden_mortar') {
            g.score += 15;
            setScore(g.score);
            g.happiness = 100;
            setHappiness(100);
            g.feverTimer = 10.0;
            setIsFeverActive(true);
            setFeverRemaining(10);
            setEarnedXhaus(ex => {
              const updated = +(ex + 0.25).toFixed(2);
              if (onCoinEarned) onCoinEarned(0.25);
              return updated;
            });
            playRetroSound('golden_mortar');
            confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });

            g.floatingTexts.push({
              x: g.catX + 10,
              y: g.catY - 48,
              text: 'GOLDEN MORTAR! +15 PTS // +0.25 XH!',
              color: '#facc15',
              life: 2.2
            });
            continue;
          }

          const basePts = item.type === 'satow' ? 3 : (item.type === 'fish' ? 1 : 2);
          const pts = g.feverTimer > 0 ? basePts * 2 : basePts;
          g.score += pts;
          setScore(g.score);

          const happyAdd = item.type === 'satow' ? 25 : (item.type === 'fish' ? 12 : 16);
          g.happiness = Math.min(100, g.happiness + happyAdd);
          setHappiness(Math.floor(g.happiness));

          if (item.type === 'satow') {
            g.godModeTimer = g.godModeDuration;
            playRetroSound('god_mode');
            g.floatingTexts.push({
              x: g.catX + 10,
              y: g.catY - 42,
              text: `SOLAR GOD MODE! (${g.godModeDuration.toFixed(1)}s)`,
              color: '#16a34a',
              life: 1.5
            });
          } else {
            playRetroSound('collect');
          }

          // Synchronous engine-side pot ingredient update
          g.potIngredients[item.type] = (g.potIngredients[item.type] || 0) + 1;
          let potCompleted = false;
          if (g.potIngredients.fish >= 1 && g.potIngredients.satow >= 1 && g.potIngredients.bamboo >= 1) {
            g.potIngredients.fish -= 1;
            g.potIngredients.satow -= 1;
            g.potIngredients.bamboo -= 1;
            potCompleted = true;
          }

          setPotIngredients({ ...g.potIngredients });

          if (potCompleted) {
            setCompletedPots(cp => cp + 1);

            const potBonus = g.feverTimer > 0 ? 10 : 6;
            g.score += potBonus;
            setScore(g.score);

            g.happiness = Math.min(100, g.happiness + 35);
            setHappiness(Math.floor(g.happiness));

            setEarnedXhaus(ex => {
              const bonusCoin = g.feverTimer > 0 ? 0.15 : 0.10;
              const updated = +(ex + bonusCoin).toFixed(2);
              if (onCoinEarned) onCoinEarned(bonusCoin);
              return updated;
            });
            playRetroSound('pot_complete');
            triggerHaptic('pot_complete');

            g.floatingTexts.push({
              x: g.catX + 16,
              y: g.catY - 32,
              text: `+${potBonus} PTS // +0.10 XH // POT COMPLETED!`,
              color: '#ea580c',
              life: 1.5
            });
          }

          for (let p = 0; p < 6; p++) {
            g.particles.push({
              x: item.x + 14,
              y: currentItemY + 14,
              vx: (Math.random() - 0.5) * 3.5,
              vy: (Math.random() - 0.5) * 3.5,
              size: Math.random() * 4 + 2,
              color: item.type === 'satow' ? '#22c55e' : (item.type === 'fish' ? '#38bdf8' : '#f59e0b'),
              life: 0.8
            });
          }
        }
      }
      g.items = g.items.filter(i => i.x > -40);

      // Helper for Game Over Trigger
      function triggerGameOver(soundType = 'hit') {
        stopBgm();
        playRetroSound(soundType);
        triggerHaptic('hit');
        g.hitShakeTimer = 0.28;

        for (let p = 0; p < 20; p++) {
          g.particles.push({
            x: g.catX + 16,
            y: g.catY - 12,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 5 + 3,
            color: Math.random() > 0.5 ? '#ef4444' : '#ea580c',
            life: 0.9
          });
        }

        setScore(g.score);
        setHappiness(Math.floor(g.happiness));
        setCanRestart(false);
        setIsClaiming(false);

        setTimeout(() => {
          setGameState('gameover');
          setTimeout(() => {
            setCanRestart(true);
          }, 750);
        }, 80);

        if (g.score > highScore) {
          setHighScore(g.score);
          localStorage.setItem('tai_pla_high_score', g.score.toString());
          confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
        }
      }

      // 9. Update Enemy Hazards (7 Types)
      for (let idx = g.monsters.length - 1; idx >= 0; idx--) {
        const mon = g.monsters[idx];
        mon.x -= g.speed * (mon.speedMultiplier || 1.0);
        mon.timer = (mon.timer || 0) + dt;

        let monY = mon.y;
        if (mon.type === 'hop_chili') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.12 + (mon.animPhase || 0))) * 24;
        } else if (mon.type === 'hawk') {
          monY = mon.y + Math.sin(g.frame * 0.09 + (mon.animPhase || 0)) * 10;
        } else if (mon.type === 'giant_mortar') {
          if (mon.y < g.groundY) {
            mon.vy += 35 * dt;
            mon.y += mon.vy;
            if (mon.y >= g.groundY) {
              mon.y = g.groundY;
              mon.vy = 0;
              g.hitShakeTimer = 0.2;
              playRetroSound('mortar_smash');
              // Ground shock dust
              for (let p = 0; p < 10; p++) {
                g.particles.push({
                  x: mon.x + 26 + (Math.random() - 0.5) * 30,
                  y: g.groundY + 2,
                  vx: (Math.random() - 0.5) * 4,
                  vy: -Math.random() * 2,
                  size: 3,
                  color: '#94a3b8',
                  life: 0.6
                });
              }
            }
          }
          monY = mon.y;
        } else if (mon.type === 'naga_thunder') {
          if (mon.timer >= 0.8 && mon.isTelegraph) {
            mon.isTelegraph = false;
            playRetroSound('thunder');
          }
          if (mon.timer > 1.1) {
            g.monsters.splice(idx, 1);
            continue;
          }
        }

        // Ember smoke behind hot runner
        if (mon.type === 'hot_runner' && Math.random() > 0.4) {
          g.particles.push({
            x: mon.x + 22,
            y: monY - 24,
            vx: Math.random() * 2 + 1,
            vy: -Math.random() * 2 - 0.5,
            size: Math.random() * 3 + 2,
            color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
            life: 0.6
          });
        }

        // Spicy chili fire embers trailing behind Ground & Aerial Chili Devils
        if ((mon.type === 'hop_chili' || mon.type === 'hawk') && Math.random() > 0.48) {
          const tailX = mon.x + (mon.type === 'hawk' ? 6 : 8);
          const tailY = monY - (mon.type === 'hawk' ? 14 : 10);
          g.particles.push({
            x: tailX + (Math.random() - 0.5) * 4,
            y: tailY + (Math.random() - 0.5) * 4,
            vx: Math.random() * 1.5 + 0.8,
            vy: -Math.random() * 1.2 - 0.3,
            size: Math.random() * 2.5 + 1.5,
            color: Math.random() > 0.4 ? '#ef4444' : (Math.random() > 0.5 ? '#f97316' : '#facc15'),
            life: 0.55
          });
        }

        // Collision Check
        const catBox = { left: g.catX + 8, right: g.catX + 24, top: g.catY - 22, bottom: g.catY - 2 };
        let monBox = { 
          left: mon.x + 4, 
          right: mon.x + mon.width - 4, 
          top: monY - mon.height + 4, 
          bottom: monY 
        };

        if (mon.type === 'naga_thunder') {
          if (mon.isTelegraph) continue; // Safe during warning telegraph
          monBox = { left: mon.x - 12, right: mon.x + 12, top: 0, bottom: g.groundY };
        }

        if (
          catBox.right > monBox.left &&
          catBox.left < monBox.right &&
          catBox.bottom > monBox.top &&
          catBox.top < monBox.bottom
        ) {
          // IF IN GOD MODE: SMASH ENEMY!
          if (g.godModeTimer > 0) {
            const isGiant = mon.type === 'giant_mortar';
            playRetroSound(isGiant ? 'mortar_smash' : 'smash');
            g.monsters.splice(idx, 1);
            const smashPts = isGiant ? 8 : (g.feverTimer > 0 ? 4 : 2);
            g.score += smashPts;
            setScore(g.score);

            g.floatingTexts.push({
              x: mon.x,
              y: monY - 30,
              text: isGiant ? `MORTAR SMASHED! +${smashPts}` : `SMASH! +${smashPts}`,
              color: '#facc15',
              life: 1.4
            });

            const isChili = mon.type === 'hop_chili' || mon.type === 'hawk';
            for (let p = 0; p < (isGiant ? 20 : 14); p++) {
              g.particles.push({
                x: mon.x + mon.width / 2,
                y: monY - mon.height / 2,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                size: Math.random() * 4 + 2,
                color: isChili 
                  ? (p % 3 === 0 ? '#16a34a' : (p % 2 === 0 ? '#ef4444' : '#facc15'))
                  : (isGiant ? '#64748b' : '#facc15'),
                life: 0.8
              });
            }
            continue;
          }

          // Otherwise: Player is hit -> Game Over
          triggerGameOver('hit');
          return;
        }
      }
      g.monsters = g.monsters.filter(m => m.x > -60);

      // 10. Update Particles & Floating Texts
      g.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt * 1.5;
      });
      g.particles = g.particles.filter(p => p.life > 0);

      g.floatingTexts.forEach(ft => {
        ft.y -= 20 * dt;
        ft.life -= dt * 1.0;
      });
      g.floatingTexts = g.floatingTexts.filter(ft => ft.life > 0);

      // ============================================================
      // 🎨 128-BIT NEO-ARCADE PIXEL ART RENDERING (VIA TaiPla128Renderer)
      // ============================================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Screen shake on hit / mortar slam
      if (g.hitShakeTimer > 0) {
        g.hitShakeTimer = Math.max(0, g.hitShakeTimer - dt);
        const shakeMag = g.hitShakeTimer * 16;
        ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
      }

      // 1. 5-Layer Parallax Background
      taiPlaRenderer.drawBackground(ctx, canvas.width, canvas.height, g.groundY, g.distanceRun, g.frame, g.spicyTier, g.feverTimer);

      // 2. Interactive Stage Elements (Satow Spring Pad, Steam Jet)
      g.elements.forEach(elem => {
        taiPlaRenderer.drawElement(ctx, elem, g.frame, g.groundY);
      });

      // 3. Collectible Ingredients & Golden Mortar
      g.items.forEach(item => {
        taiPlaRenderer.drawItem(ctx, item, g.frame);
      });

      // 4. Enemy Hazards (7 Types)
      g.monsters.forEach(mon => {
        taiPlaRenderer.drawEnemy(ctx, mon, g.frame, g.groundY);
      });

      // 5. Hero Character
      taiPlaRenderer.drawCharacter(
        ctx,
        g.charId,
        g.catX,
        g.catY,
        g.frame,
        g.isGrounded,
        g.godModeTimer,
        g.feverTimer,
        g.scaleX,
        g.scaleY,
        g.groundY
      );

      // 6. Particles
      g.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size * p.life, p.size * p.life);
      });

      // 7. Floating Texts
      g.floatingTexts.forEach(ft => {
        ctx.font = 'bold 12px Space Mono, monospace';
        ctx.fillStyle = '#1c1917';
        ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      });

      // 8. Tier Transition Big Announcement Banner
      if (g.tierAnnounceTimer > 0) {
        g.tierAnnounceTimer = Math.max(0, g.tierAnnounceTimer - dt);
        const alpha = Math.min(1.0, g.tierAnnounceTimer * 1.5);
        ctx.save();
        ctx.fillStyle = `rgba(24, 22, 21, ${alpha * 0.88})`;
        ctx.fillRect(20, 60, canvas.width - 40, 56);
        ctx.strokeStyle = g.spicyTier === 4 ? '#ef4444' : (g.spicyTier === 3 ? '#f97316' : '#facc15');
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 60, canvas.width - 40, 56);

        ctx.font = 'bold 14px Space Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = g.spicyTier === 4 ? '#fca5a5' : '#fef08a';
        ctx.fillText(g.tierAnnounceTitle, canvas.width / 2, 84);

        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#f5f5f4';
        ctx.fillText(g.tierAnnounceSubtitle, canvas.width / 2, 102);
        ctx.restore();
      }

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, soundEnabled, highScore, selectedCharId]);

  const handleClaim = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsClaiming(true);
    triggerHaptic('collect');
    playRetroSound('tier_up');
    const finalScore = gameRef.current.score || score;
    if (onClaimScore) {
      onClaimScore(finalScore);
    }
  };

  const currentRank = getArcadeRank(score, 'tai_pla');

  const handleSelectCharacter = (charId) => {
    setSelectedCharId(charId);
    playRetroSound('char_select');
  };

  if (isDedicated || isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#FAF7F2] flex flex-col justify-between select-none overflow-hidden touch-none font-sans">
        {/* Top Navigation & Status Bar */}
        <header className="w-full bg-[#FAF7F2] border-b-2 border-[#181615] px-3 sm:px-6 py-2.5 flex items-center justify-between z-20 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onBackToHub || (() => setIsFullscreen(false))}
              className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#E9F344] text-[#181615] rounded-xl border-2 border-[#181615] font-mono font-bold text-xs shadow-xs active:scale-95 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>[ ← กลับโถงเกม ]</span>
            </button>
            <div className="flex items-center gap-1.5">
              <img src="/logo.png" alt="ในบ้าน" className="w-4 h-4 object-contain" />
              <span className="font-pixel text-xs sm:text-sm font-bold text-[#181615] uppercase tracking-wider">
                TAI-PLA RUN // 128-BIT
              </span>
            </div>
          </div>

          {/* Right score, rank, music and sound controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs">
            <span className={`hidden sm:inline-block px-2 py-1 rounded-lg border text-[10px] font-bold uppercase ${currentRank.badgeClass}`}>
              {currentRank.badge}
            </span>
            <div className="bg-[#181615] text-[#FAF7F5] px-2.5 py-1 rounded-lg border border-[#3D3835] text-[11px] font-bold">
              <span>{score} PTS</span>
            </div>
            {earnedXhaus > 0 && (
              <div className="bg-[#E9F344] text-[#181615] px-2 py-1 rounded-lg border-2 border-[#181615] text-[10px] font-bold">
                +{earnedXhaus.toFixed(2)} XH
              </div>
            )}
            <button
              onClick={cycleBgmTrack}
              className="px-2 py-1 bg-[#FAF7F2] hover:bg-[#E9F344] text-[#181615] rounded-lg border border-[#181615] text-[10px] font-bold cursor-pointer transition-colors uppercase"
              title="เปลี่ยนแนวเพลง Lo-Fi"
            >
              [ ♫ {currentBgmTrack.replace('_', ' ')} ]
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="px-2 py-1 bg-[#FAF7F2] hover:bg-[#F2ECE4] text-[#181615] rounded-lg border border-[#181615] text-[10px] font-bold cursor-pointer transition-colors"
            >
              {soundEnabled ? '[ SND: ON ]' : '[ SND: OFF ]'}
            </button>
          </div>
        </header>

        {/* Central Game Arena - Vertical Portrait (Flappy Cat style 480x700) */}
        <main className="flex-1 w-full flex flex-col justify-center items-center px-2 sm:px-4 min-h-0 relative py-1 sm:py-2">
          <div 
            onClick={handleJumpPress}
            onTouchStart={(e) => { e.preventDefault(); handleJumpPress(); }}
            className="relative w-full max-w-[420px] aspect-[9/16] max-h-[72vh] sm:max-h-[76vh] bg-[#faf6ed] rounded-2xl overflow-hidden border-2 border-[#181615] cursor-pointer select-none shadow-md transition-transform duration-100 ease-out"
          >
            <canvas 
              ref={canvasRef} 
              width={480} 
              height={700} 
              className="w-full h-full block"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* In The Haus Badge & Spicy Tier Indicator Overlay */}
            {gameState === 'playing' && (
              <div className="absolute top-2.5 left-3.5 z-10 flex items-center gap-1.5 font-mono text-[9px] flex-wrap">
                <div className="flex items-center gap-1.5 bg-[#181615]/90 text-[#FAF7F5] px-2.5 py-1 rounded border border-[#3D3835] backdrop-blur-[2px] shadow-xs">
                  <img src="/logo.png" alt="ในบ้าน" className="w-3.5 h-3.5 object-contain" />
                  <span className="font-bold text-[#fef08a] tracking-wider uppercase font-pixel">HAUS 128-BIT</span>
                </div>

                <div className="flex items-center gap-1.5 bg-[#181615]/90 text-[#FAF7F5] px-2.5 py-1 rounded border border-[#3D3835] backdrop-blur-[2px] shadow-xs">
                  <span className="font-bold tracking-wider uppercase text-[10px]">
                    {currentSpicyTier === 4 ? '[ TIER 4 // HELL EXTREME ]' : (currentSpicyTier === 3 ? '[ TIER 3 // ULTRA SPICY ]' : (currentSpicyTier === 2 ? '[ TIER 2 // SPICY UP ]' : '[ TIER 1 // CHILL RUN ]'))}
                  </span>
                </div>

                <div className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${currentRank.badgeClass}`}>
                  {currentRank.badge}
                </div>
              </div>
            )}

            {/* Start Overlay */}
            {gameState === 'idle' && (
              <div 
                onClick={(e) => { e.stopPropagation(); startGame(); }}
                className="absolute inset-0 bg-[#FAF7F5]/82 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 text-center p-4 sm:p-6 cursor-pointer select-none"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div className="bg-[#181615] px-3.5 py-1 rounded border border-[#3D3835] flex items-center gap-2 shadow-xs">
                    <img src="/logo.png" alt="ในบ้าน" className="w-3.5 h-3.5 object-contain" />
                    <img src="/logo-secondary.png" alt="In The Haus" className="h-5 object-contain" />
                  </div>
                  <div className="font-mono text-[9px] text-[oklch(52%_0.16_28)] font-bold tracking-widest uppercase">
                    [ MEKONG SPEED RUNNER // CREATURE COMPENDIUM ]
                  </div>
                </div>

                {/* Pop-Pixel Companion Portrait Box */}
                <div className="bg-[#FAF7F2] border-2 border-[#181615] rounded-2xl px-4 py-2.5 shadow-[3px_3px_0px_#181615] flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#F4EFE6] border border-[#181615] flex items-center justify-center shrink-0">
                    <PixelCharAvatar charId={activeChar.id} size={44} animated={true} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-pixel text-base sm:text-lg font-bold text-[#181615] uppercase tracking-wider leading-tight">
                      {activeChar.name}
                    </h4>
                    <p className="font-mono text-[9px] text-[oklch(45%_0.010_28)] uppercase tracking-wider mt-0.5">
                      {activeChar.title}
                    </p>
                    <span className={`inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded font-mono font-bold border ${activeChar.badgeColor}`}>
                      {activeChar.trait}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#181615] font-sans max-w-sm leading-relaxed bg-[#FAF7F2]/90 px-3 py-1.5 rounded-lg border border-[#181615]/20 hidden sm:block">
                  แตะหน้าจอเพื่อกระโดดหลบสิ่งกีดขวางริมแม่น้ำโขงนครพนม<br/>
                  สะสมวัตถุดิบครบหม้อรับเหรียญ XHAUS และปลดล็อก Rank S+!
                </p>

                <button
                  onClick={(e) => { e.stopPropagation(); startGame(); }}
                  className="btn-action mt-1 px-8 py-3 bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] font-mono text-xs font-bold uppercase rounded-xl border-2 border-[#181615] cursor-pointer shadow-[3px_3px_0px_#181615] active:scale-95 transition-transform duration-100 ease-out"
                >
                  [ ▶ START RUN // แตะเพื่อเริ่มวิ่ง ]
                </button>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameState === 'gameover' && (
              <div 
                onClick={(e) => e.stopPropagation()} 
                className="absolute inset-0 bg-[#181615]/95 backdrop-blur-[3px] flex flex-col items-center justify-center gap-2.5 text-center p-4 sm:p-6 animate-[fadeIn_0.15s_ease-out] select-none"
              >
                <div className="flex items-center gap-2 bg-[#252220] px-3.5 py-1 rounded border border-[#3D3835]">
                  <img src="/logo.png" alt="ในบ้าน" className="w-3.5 h-3.5 object-contain" />
                  <span className="font-mono text-[9px] text-[#D9D2CB] font-bold uppercase tracking-wider">HAUS ARCADE SYSTEM</span>
                </div>

                <div>
                  <h4 className="font-pixel text-xl sm:text-2xl font-bold text-[#BD4924] uppercase tracking-widest">
                    RUN TERMINATED
                  </h4>
                  <p className="text-xs text-[#D9D2CB] font-mono mt-1">
                    FINAL SCORE: <strong className="text-[#FAF7F5] text-base">{score} PTS</strong> // ปรุงสำเร็จ {completedPots} หม้อ
                  </p>
                </div>

                {/* Earned Rank Evaluation Card */}
                <div className="bg-[#252220] border border-[#3D3835] rounded-xl px-4 py-2.5 w-full max-w-xs flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded border font-mono text-[11px] font-bold uppercase ${currentRank.badgeClass}`}>
                      {currentRank.badge}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#FAF7F5]">
                      {currentRank.titleTh}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#E9F344] font-bold">
                    {currentRank.rewardText}
                  </span>
                  {currentRank.nextTarget && (
                    <span className="font-mono text-[9px] text-[#A8A29E]">
                      อีก {Math.max(0, currentRank.nextTarget - score)} PTS เพื่อเลื่อนขั้นสู่ [RANK {currentRank.nextTier}]
                    </span>
                  )}
                </div>

                {earnedXhaus > 0 && (
                  <div className="bg-[#181615] border border-[#526A3B] text-[#86efac] px-3 py-1 rounded font-mono text-xs font-bold">
                    + {earnedXhaus.toFixed(2)} XHAUS COIN RECORDED
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-center font-mono text-xs mt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canRestart) return;
                      startGame();
                    }}
                    disabled={!canRestart}
                    className={`px-5 py-2.5 font-bold uppercase rounded-xl cursor-pointer shadow-sm active:scale-95 transition-transform duration-100 ease-out ${
                      canRestart 
                        ? 'bg-[#E9F344] text-[#181615] border-2 border-[#181615]' 
                        : 'bg-[#181615] text-[#69635D] border border-[#2B2725] cursor-not-allowed'
                    }`}
                  >
                    {canRestart ? '[ ▶ เล่นอีกครั้ง ]' : '[ INITIALIZING… ]'}
                  </button>

                  {score > 0 && (
                    <button
                      onClick={handleClaim}
                      className="px-5 py-2.5 bg-[#BD4924] hover:bg-[#A33C1B] text-[#FAF7F5] font-bold uppercase rounded-xl border border-[#E05A36] cursor-pointer shadow-sm active:scale-95 transition-colors"
                    >
                      {isClaiming ? '[ SAVED ]' : '[ บันทึกคะแนน ]'}
                    </button>
                  )}

                  {onBackToHub && (
                    <button
                      onClick={onBackToHub}
                      className="px-4 py-2.5 bg-[#FAF7F2] text-[#181615] font-bold uppercase rounded-xl border-2 border-[#181615] cursor-pointer shadow-sm active:scale-95"
                    >
                      [ กลับโถงเกม ]
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Bottom Mobile Action Deck (Giant Touch Zone & Controls) */}
        <footer className="w-full bg-[#FAF7F2] border-t-2 border-[#181615] p-3 sm:p-4 flex flex-col items-center gap-2.5 shrink-0 select-none shadow-2xs">
          {/* Ingredient & Happy Vibes telemetry strip */}
          <div className="flex items-center justify-between w-full max-w-md px-1 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#181615] uppercase">[ VIBES: {happiness}% ]</span>
              <div className="w-16 sm:w-24 h-2 bg-neutral-200 rounded-full overflow-hidden border border-neutral-300">
                <div 
                  className={`h-full ${isFeverActive ? 'bg-amber-400 animate-pulse' : 'bg-[#181615]'}`}
                  style={{ width: `${isFeverActive ? 100 : happiness}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-[#181615]">
              <span className="bg-sky-100 px-1.5 py-0.5 rounded border border-sky-300">ปลา {potIngredients.fish}/1</span>
              <span className="bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">สะตอ {potIngredients.satow}/1</span>
              <span className="bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">หน่อไม้ {potIngredients.bamboo}/1</span>
            </div>
          </div>

          {/* Giant Mobile Touch Jump Zone */}
          <div 
            onClick={handleJumpPress}
            onTouchStart={(e) => { e.preventDefault(); handleJumpPress(); }}
            className="w-full max-w-md py-3 sm:py-3.5 px-4 bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] font-mono font-bold text-sm sm:text-base rounded-2xl border-2 border-[#181615] shadow-xs active:scale-[0.98] transition-transform text-center flex flex-col items-center justify-center cursor-pointer select-none"
          >
            <span className="tracking-wide uppercase">[ แตะตรงไหนก็ได้เพื่อกระโดด // TAP TO JUMP ]</span>
            <span className="text-[10px] font-normal text-[#181615]/80 mt-0.5">
              {selectedCharId === 'naga' ? 'พญานาคน้อยกระโดดได้ 3 จังหวะ (Triple Naga Glide)!' : 'แตะ 2 ครั้งเพื่อกระโดด 2 จังหวะ (Double Jump)'}
            </span>
          </div>

          {/* Companion character switcher when idle */}
          {gameState !== 'playing' && (
            <div className="flex items-center gap-1.5 w-full max-w-md overflow-x-auto pb-0.5 text-[10px] font-mono">
              {Object.values(CHARACTERS).map((char) => (
                <button
                  key={char.id}
                  onClick={() => handleSelectCharacter(char.id)}
                  className={`flex-1 py-1 px-2 rounded-xl border-2 font-bold uppercase truncate transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    selectedCharId === char.id
                      ? 'bg-[#181615] text-[#FAF7F5] border-[#181615] shadow-[2px_2px_0px_#BD4924]'
                      : 'bg-[#FAF7F2] text-[#181615] border-[#181615]/30 hover:bg-[#F2ECE4]'
                  }`}
                >
                  <PixelCharAvatar charId={char.id} size={18} animated={selectedCharId === char.id} />
                  <span>{char.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </footer>
      </div>
    );
  }

  // Standard inline frame fallback
  return (
    <div className="w-full bg-[var(--color-paper)] rounded-2xl border-2 border-[#181615] p-4 sm:p-6 shadow-sm flex flex-col gap-4 font-sans">
      {/* Clean Header Bar & Character Selector */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-rule)] pb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#FAF7F5] flex items-center justify-center border-2 border-[#181615] shrink-0 overflow-hidden relative shadow-2xs p-0.5">
            <PixelCharAvatar charId={activeChar.id} size={38} animated={true} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-mono text-sm font-bold text-[#181615] uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[#bd4924]">ในบ้าน</span>
                <span className="text-zinc-400">•</span>
                <span>{activeChar.name}</span>
                <span className="text-[11px] font-normal text-[oklch(45%_0.010_28)]">({activeChar.title})</span>
              </h3>
              <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold border whitespace-nowrap ${activeChar.badgeColor}`}>
                {activeChar.trait}
              </span>
            </div>
            <p className="text-[11px] text-[oklch(45%_0.010_28)] font-sans truncate sm:whitespace-normal">
              {activeChar.desc}
            </p>
          </div>
        </div>

        {/* Status Score & LCD Coins Deck */}
        <div className="flex items-center gap-2 font-mono text-xs self-end sm:self-auto flex-wrap">
          <span className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold uppercase ${currentRank.badgeClass}`}>
            {currentRank.badge}
          </span>
          {earnedXhaus > 0 && (
            <div className="bg-[#E9F344] border-2 border-[#181615] px-2.5 py-1 rounded-xl text-[#181615] font-bold text-[11px]">
              +{earnedXhaus.toFixed(2)} XH
            </div>
          )}
          <div className="bg-[#181615] text-[#FAF7F5] border border-[#3D3835] px-3 py-1 rounded-xl">
            <span className="text-[8px] text-[#A8A29E] block">SCORE</span>
            <span className="font-bold text-sm">{score}</span>
          </div>
          <button
            onClick={cycleBgmTrack}
            className="px-2.5 py-1.5 bg-[#FAF7F2] hover:bg-[#E9F344] rounded-xl border-2 border-[#181615] text-[10px] font-mono font-bold text-[#181615] cursor-pointer transition-colors uppercase"
            title="เปลี่ยนแนวเพลง Lo-Fi"
          >
            [ ♫ {currentBgmTrack.replace('_', ' ')} ]
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="px-2.5 py-1.5 bg-[#FAF7F2] hover:bg-[#F2ECE4] rounded-xl border-2 border-[#181615] text-[10px] font-mono font-bold text-[#181615] cursor-pointer transition-colors"
          >
            {soundEnabled ? '[ SND: ON ]' : '[ SND: OFF ]'}
          </button>
          <button
            onClick={() => setIsFullscreen(true)}
            className="px-3 py-1.5 bg-[#E9F344] hover:bg-[#d9e334] rounded-xl border-2 border-[#181615] text-[10px] font-mono font-bold text-[#181615] cursor-pointer"
          >
            [ เต็มจอ / FULL ]
          </button>
        </div>
      </div>

      {/* Companion character switcher when idle in inline mode */}
      {gameState !== 'playing' && (
        <div className="flex items-center gap-1.5 w-full max-w-md mx-auto overflow-x-auto pb-1 text-[10px] font-mono">
          {Object.values(CHARACTERS).map((char) => (
            <button
              key={char.id}
              onClick={() => handleSelectCharacter(char.id)}
              className={`flex-1 py-1.5 px-2 rounded-xl border-2 font-bold uppercase truncate transition-all cursor-pointer flex items-center justify-center gap-1 ${
                selectedCharId === char.id
                  ? 'bg-[#181615] text-[#FAF7F5] border-[#181615] shadow-[2px_2px_0px_#BD4924]'
                  : 'bg-[#FAF7F2] text-[#181615] border-[#181615]/30 hover:bg-[#F2ECE4]'
              }`}
            >
              <PixelCharAvatar charId={char.id} size={18} animated={selectedCharId === char.id} />
              <span>{char.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Canvas Container - Vertical 9:16 Portrait */}
      <div 
        onClick={handleJumpPress}
        onTouchStart={(e) => { e.preventDefault(); handleJumpPress(); }}
        className="relative w-full max-w-[420px] aspect-[9/16] max-h-[72vh] mx-auto bg-[#faf6ed] rounded-2xl overflow-hidden border-2 border-[#181615] cursor-pointer select-none shadow-md transition-transform duration-100 ease-out"
      >
        <canvas 
          ref={canvasRef} 
          width={480} 
          height={700} 
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />

        {gameState === 'idle' && (
          <div 
            onClick={(e) => { e.stopPropagation(); startGame(); }}
            className="absolute inset-0 bg-[#FAF7F5]/82 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 text-center p-6 cursor-pointer select-none"
          >
            <div className="bg-[#FAF7F2] border-2 border-[#181615] rounded-2xl px-4 py-2.5 shadow-[3px_3px_0px_#181615] flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#F4EFE6] border border-[#181615] flex items-center justify-center shrink-0">
                <PixelCharAvatar charId={activeChar.id} size={44} animated={true} />
              </div>
              <div className="text-left">
                <h4 className="font-pixel text-lg font-bold text-[#181615] uppercase tracking-wider">
                  {activeChar.name}
                </h4>
                <p className="font-mono text-[9px] text-[oklch(45%_0.010_28)] uppercase tracking-wider">
                  {activeChar.title} // {activeChar.trait}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); startGame(); }}
              className="px-8 py-3 bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] font-mono text-xs font-bold uppercase rounded-xl border-2 border-[#181615] cursor-pointer shadow-[3px_3px_0px_#181615] active:scale-95"
            >
              [ START RUN // เริ่มออกวิ่ง ]
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="absolute inset-0 bg-[#181615]/95 backdrop-blur-[3px] flex flex-col items-center justify-center gap-3 text-center p-6 select-none"
          >
            <h4 className="font-pixel text-2xl font-bold text-[#BD4924] uppercase tracking-widest">
              RUN TERMINATED
            </h4>
            <p className="text-xs text-[#D9D2CB] font-mono mt-1">
              FINAL SCORE: <strong className="text-[#FAF7F5] text-base">{score} PTS</strong> // ปรุงสำเร็จ {completedPots} หม้อ
            </p>
            <div className="bg-[#252220] border border-[#3D3835] rounded-xl px-4 py-2 w-full max-w-xs flex flex-col items-center gap-1">
              <span className={`px-2.5 py-0.5 rounded border font-mono text-[11px] font-bold uppercase ${currentRank.badgeClass}`}>
                {currentRank.badge} — {currentRank.titleTh}
              </span>
              <span className="font-mono text-[10px] text-[#E9F344] font-bold">
                {currentRank.rewardText}
              </span>
            </div>
            <div className="flex gap-3 font-mono text-xs mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); startGame(); }}
                className="px-6 py-2.5 bg-[#E9F344] text-[#181615] font-bold uppercase rounded-xl border-2 border-[#181615] cursor-pointer shadow-xs active:scale-95"
              >
                [ RESTART RUN ]
              </button>
              {score > 0 && (
                <button
                  onClick={handleClaim}
                  className="px-6 py-2.5 bg-[#BD4924] text-[#FAF7F5] font-bold uppercase rounded-xl border border-[#E05A36] cursor-pointer shadow-sm active:scale-95"
                >
                  [ CLAIM REWARD ]
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progressive Tiers Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF7F2] border-2 border-[#181615] p-3 rounded-xl text-xs font-mono">
        <span className="font-bold text-[#181615]">[ 4 TIERS ]: (1) ชิลล์ → (2) ปากเปิด → (3) หูดับ → (4) นรกแตก 100+p</span>
        <div className="flex items-center gap-2">
          <span>ปลา: {potIngredients.fish}/1</span>
          <span>สะตอ: {potIngredients.satow}/1</span>
          <span>หน่อไม้: {potIngredients.bamboo}/1</span>
        </div>
      </div>
    </div>
  );
}

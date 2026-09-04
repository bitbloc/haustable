/* Hallmark · component: TaiPlaMiniGame · genre: 128-Bit Neo-Arcade Pixel Runner · theme: Nakhon Phanom Riverfront x Progressive Difficulty */
import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Maximize2, Minimize2, Coins, Zap, Flame, Heart, ChevronRight, User, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';
import { taiPlaRenderer } from './renderers/TaiPla128Renderer';

const CHARACTERS = {
  tai_pla: {
    id: 'tai_pla',
    name: 'น้องไตปลา',
    title: 'แมวเปรอะริมโขง',
    icon: '🐱',
    desc: 'คล่องแคล่วว่องไว • มีสกิล Double Jump กระโดด 2 จังหวะ',
    trait: 'DOUBLE JUMP (กระโดด 2 จังหวะ)',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
    color: '#f97316',
    maxJumps: 2,
    godModeBonus: 0,
    magnetRadius: 50,
    jumpPower: -11.0
  },
  som_satow: {
    id: 'som_satow',
    name: 'พี่ส้มสตอ',
    title: 'แมวส้มจอมพลัง',
    icon: '🐈',
    desc: 'สายพลังหรอยแรง • แปลงร่างเทพสะตอได้นาน 5 วินาที (+2s)',
    trait: 'EXTENDED GOD MODE (เทพสะตอ 5 วิ)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    color: '#ea580c',
    maxJumps: 1,
    godModeBonus: 2.0,
    magnetRadius: 50,
    jumpPower: -11.5
  },
  khao_lam: {
    id: 'khao_lam',
    name: 'เจ้าตูบข้าวหลาม',
    title: 'หมาน้อยนครพนม',
    icon: '🐶',
    desc: 'อารมณ์ดีใจดี • รัศมีแม่เหล็กดูดวัตถุดิบกว้างพิเศษ (Super Magnet)',
    trait: 'SUPER MAGNET (ดูดอาหารระยะไกล)',
    badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    color: '#854d0e',
    maxJumps: 1,
    godModeBonus: 0,
    magnetRadius: 82,
    jumpPower: -10.8
  }
};

export default function TaiPlaMiniGame({ session, onClaimScore, onRequireLogin, onCoinEarned }) {
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canRestart, setCanRestart] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

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
    catY: 185,
    catVy: 0,
    isGrounded: true,
    jumpCount: 0,
    maxJumps: 2,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    godModeTimer: 0,
    godModeDuration: 3.0,
    feverTimer: 0,
    happiness: 0,
    score: 0,
    distanceRun: 0,
    lastDistanceScore: 0,
    items: [],
    monsters: [],
    elements: [],
    particles: [],
    floatingTexts: [],
    lastSpawn: 0,
    groundY: 185,
    speed: 3.8,
    frame: 0,
    scaleX: 1.0,
    scaleY: 1.0,
    magnetRadius: 50,
    spicyTier: 1,
    lastUiSync: 0,
    hitShakeTimer: 0,
    tierAnnounceTimer: 0,
    tierAnnounceTitle: '',
    tierAnnounceSubtitle: ''
  });

  // 8-Bit / 128-Bit Retro Synthesizer
  const playRetroSound = (type) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'jump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (type === 'double_jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(1040, now + 0.14);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'spring') {
        // High bouncy spring launch
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'collect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.04); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.08); // D6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'golden_mortar') {
        // Sparkly golden fanfare
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.setValueAtTime(880.00, now + 0.06); // A5
        osc.frequency.setValueAtTime(1046.50, now + 0.12); // C6
        osc.frequency.setValueAtTime(1318.51, now + 0.18); // E6
        osc.frequency.setValueAtTime(1760.00, now + 0.24); // A6
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.46);
      } else if (type === 'god_mode') {
        // Super Saiyan Satow Powerup Fanfare
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.06);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(880, now + 0.18);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'fever_start') {
        // Happy Fever Time Arpeggio
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.18); // C6
        osc.frequency.setValueAtTime(1318.51, now + 0.24); // E6
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'smash') {
        // Enemy smash hit in God Mode
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'mortar_smash') {
        // Heavy bass explosion for giant mortar
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gain.gain.setValueAtTime(0.20, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'thunder') {
        // Crackling lightning
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.30);
      } else if (type === 'tier_up') {
        // Ascending Tier Brass Fanfare
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(392.00, now); // G4
        osc.frequency.setValueAtTime(523.25, now + 0.08); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.16); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.40);
      } else if (type === 'pot_complete') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.18); // C6
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.30);
      } else if (type === 'meow') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.18);
        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.26);
      }
      triggerHaptic(type);
    } catch (e) {}
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

    gameRef.current = {
      charId: char.id,
      catX: 75,
      catY: 185,
      catVy: 0,
      isGrounded: true,
      jumpCount: 0,
      maxJumps: char.maxJumps,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      godModeTimer: 0,
      godModeDuration: 3.0 + (char.godModeBonus || 0),
      feverTimer: 0,
      happiness: 0,
      score: 0,
      distanceRun: 0,
      lastDistanceScore: 0,
      items: [],
      monsters: [],
      elements: [],
      particles: [],
      floatingTexts: [],
      lastSpawn: Date.now(),
      groundY: 185,
      speed: 3.8,
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
  };

  // Ultra-Smooth Jump with Double Jump & Coyote Time
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
      g.catVy = char.jumpPower || -11.0;
      g.isGrounded = false;
      g.jumpCount = 1;
      g.coyoteTimer = 0;
      g.scaleX = 0.85;
      g.scaleY = 1.25;
      playRetroSound('jump');

      // Sparkle / Dust particles on jump
      for (let i = 0; i < 5; i++) {
        g.particles.push({
          x: g.catX + 14 + (Math.random() * 10 - 5),
          y: g.groundY + 2,
          vx: (Math.random() - 0.7) * 2,
          vy: -Math.random() * 2,
          size: Math.random() * 4 + 2,
          color: g.feverTimer > 0 ? '#fde047' : (g.godModeTimer > 0 ? '#eab308' : '#fbbf24'),
          life: 0.7
        });
      }
    } 
    // Double jump in mid-air (if character supports maxJumps >= 2)
    else if (g.jumpCount < g.maxJumps) {
      g.catVy = -9.8;
      g.jumpCount += 1;
      g.scaleX = 0.8;
      g.scaleY = 1.3;
      playRetroSound('double_jump');

      g.floatingTexts.push({
        x: g.catX + 8,
        y: g.catY - 26,
        text: '✨ DOUBLE JUMP!',
        color: '#38bdf8',
        life: 0.9
      });

      // Ring of spin sparkles for mid-air flip
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        g.particles.push({
          x: g.catX + 16 + Math.cos(angle) * 12,
          y: g.catY - 10 + Math.sin(angle) * 12,
          vx: Math.cos(angle) * 3,
          vy: Math.sin(angle) * 3,
          size: 3,
          color: '#38bdf8',
          life: 0.6
        });
      }
    } else {
      g.jumpBufferTimer = 0.16;
    }
  };

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

      // 4. Progressive Difficulty & 4 Spicy Tiers Scaling
      let tier = 1;
      if (g.score >= 60) {
        tier = 4; // เผ็ดนรกแตก EXTREME
        g.speed = Math.min(9.4, 8.0 + Math.floor((g.score - 60) / 8) * 0.2);
      } else if (g.score >= 35) {
        tier = 3; // เผ็ดหูดับตับไหม้
        g.speed = Math.min(7.8, 6.4 + Math.floor((g.score - 35) / 5) * 0.25);
      } else if (g.score >= 15) {
        tier = 2; // เผ็ดปากเปิด
        g.speed = Math.min(6.2, 4.8 + Math.floor((g.score - 15) / 4) * 0.25);
      } else {
        tier = 1; // เผ็ดอนุบาล
        g.speed = Math.min(4.6, 3.8 + Math.floor(g.score / 3) * 0.2);
      }

      if (tier !== g.spicyTier) {
        g.spicyTier = tier;
        playRetroSound('tier_up');

        const tierMeta = {
          2: { title: '🌶️ TIER 2: เผ็ดปากเปิด', sub: 'ความเร็วเพิ่มขึ้น • เพิ่มเหยี่ยวโขง 🦅, ผีหม้อดิน & ท่อไอน้ำเดือด' },
          3: { title: '🔥⚡ TIER 3: เผ็ดหูดับตับไหม้', sub: 'กุ๊กกระทะร้อน 🔥 & สายฟ้าพญานาค ⚡ • ใช้สปริงสะตอกระโดดหลบ!' },
          4: { title: '💀🔥⚡ TIER 4: เผ็ดนรกแตก EXTREME', sub: 'ครกหินยักษ์ทุบพื้น 💥 • เก็บครกหินทองคำลอยฟ้า 🏆 +15 PTS!' }
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

      // 5. Platformer Physics
      if (g.isGrounded) {
        g.coyoteTimer = 0.08;
        g.jumpCount = 0;
      } else {
        g.coyoteTimer = Math.max(0, g.coyoteTimer - dt);
      }

      g.jumpBufferTimer = Math.max(0, g.jumpBufferTimer - dt);

      const gravity = g.catVy > 0 ? 28 : 23;
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
      let spawnInterval = 1400 - g.score * 20;
      if (g.spicyTier === 2) spawnInterval = 1100 - (g.score - 15) * 15;
      else if (g.spicyTier === 3) spawnInterval = 900 - (g.score - 35) * 10;
      else if (g.spicyTier === 4) spawnInterval = 720;
      spawnInterval = Math.max(680, spawnInterval);

      if (nowMs - g.lastSpawn > spawnInterval) {
        g.lastSpawn = nowMs;

        // A. Chance to spawn an Interactive Element (Satow Spring in Tier 3+, Steam Jet in Tier 2+)
        const hasSpring = g.elements.some(e => e.type === 'satow_spring');
        const hasSteam = g.elements.some(e => e.type === 'steam_jet');

        if (g.spicyTier >= 3 && !hasSpring && Math.random() < 0.22) {
          g.elements.push({
            type: 'satow_spring',
            x: canvas.width + 40,
            width: 36,
            isCompressed: false,
            compressTimer: 0
          });
        } else if (g.spicyTier >= 2 && !hasSteam && Math.random() < 0.20) {
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
          const isMonster = Math.random() > (g.feverTimer > 0 ? 0.65 : 0.40);

          if (isMonster) {
            const r = Math.random();
            let monsterType = 'hop_chili';

            if (g.spicyTier === 4) {
              // Tier 4: Giant Mortar, Naga Thunder, Hot Runner, Hawk
              if (r > 0.70) monsterType = 'giant_mortar';
              else if (r > 0.45) monsterType = 'naga_thunder';
              else if (r > 0.22) monsterType = 'hot_runner';
              else monsterType = 'hawk';
            } else if (g.spicyTier === 3) {
              // Tier 3: Hot Runner, Naga Thunder, Hawk, Pot Ghost, Hop Chili
              if (r > 0.72) monsterType = 'hot_runner';
              else if (r > 0.48) monsterType = 'naga_thunder';
              else if (r > 0.28) monsterType = 'hawk';
              else if (r > 0.14) monsterType = 'pot_ghost';
              else monsterType = 'hop_chili';
            } else if (g.spicyTier === 2) {
              // Tier 2: Hawk, Pot Ghost, Coconut, Hop Chili
              if (r > 0.70) monsterType = 'hawk';
              else if (r > 0.45) monsterType = 'pot_ghost';
              else if (r > 0.22) monsterType = 'coconut';
              else monsterType = 'hop_chili';
            } else {
              // Tier 1: Hop Chili, Coconut
              if (r > 0.40) monsterType = 'hop_chili';
              else monsterType = 'coconut';
            }

            const isFlying = monsterType === 'hawk';
            const isSkyFalling = monsterType === 'giant_mortar';
            const isThunder = monsterType === 'naga_thunder';

            const monY = isFlying ? g.groundY - 55 : (isSkyFalling ? -40 : g.groundY);
            const monW = isSkyFalling ? 52 : (isThunder ? 24 : (monsterType === 'hawk' ? 36 : (monsterType === 'hot_runner' ? 36 : (monsterType === 'coconut' ? 28 : 32))));
            const monH = isSkyFalling ? 52 : (isThunder ? g.groundY : (monsterType === 'hawk' ? 30 : (monsterType === 'hot_runner' ? 40 : (monsterType === 'coconut' ? 28 : 32))));
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
          } else {
            // Food / Power-up Item
            const r = Math.random();
            // In Tier 4, chance to spawn rare Golden Mortar!
            let foodType = 'fish';
            if (g.spicyTier === 4 && r > 0.88) {
              foodType = 'golden_mortar';
            } else if (r > 0.62) {
              foodType = 'satow';
            } else if (r > 0.30) {
              foodType = 'fish';
            } else {
              foodType = 'bamboo';
            }

            const itemY = foodType === 'golden_mortar' ? g.groundY - 60 : (g.groundY - (Math.random() > 0.5 ? 42 : 14));
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
            g.catVy = -15.5; // Mega spring launch!
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
                  text: '💨 STEAM DEFLECTED! +2',
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
              text: '🏆 ครกหินทองคำ! +15 PTS // +0.25 XH!',
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
              text: `⚡ เทพสะตอ! (${Math.round(g.godModeDuration)}s GOD MODE)`,
              color: '#16a34a',
              life: 1.5
            });
          } else {
            playRetroSound('collect');
          }

          setPotIngredients(prev => {
            const next = { ...prev, [item.type]: prev[item.type] + 1 };
            if (next.fish >= 1 && next.satow >= 1 && next.bamboo >= 1) {
              next.fish -= 1;
              next.satow -= 1;
              next.bamboo -= 1;
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
                text: `+${potBonus} PTS // +0.10 XH 🥘 หรอยจังฮู้!`,
                color: '#ea580c',
                life: 1.5
              });
            }
            return next;
          });

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
              text: isGiant ? `💥 MORTAR SMASHED! +${smashPts}` : `💥 SMASH! +${smashPts}`,
              color: '#facc15',
              life: 1.4
            });

            for (let p = 0; p < (isGiant ? 20 : 12); p++) {
              g.particles.push({
                x: mon.x + mon.width / 2,
                y: monY - mon.height / 2,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                size: Math.random() * 5 + 2,
                color: isGiant ? '#64748b' : '#facc15',
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
        g.scaleY
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
    const finalScore = gameRef.current.score || score;
    if (onClaimScore) {
      onClaimScore(finalScore);
    }
  };

  return (
    <div className={`${
      isFullscreen 
        ? 'fixed inset-0 z-[9999] bg-[#fbf8eb] p-4 sm:p-8 flex flex-col justify-center items-center overflow-auto' 
        : 'w-full bg-white rounded-lg border border-[var(--color-rule)] p-5 sm:p-6 shadow-sm flex flex-col gap-5'
    }`}>
      
      {/* Clean Header Bar & Character Selector */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-rule)] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#fef3c7] text-2xl flex items-center justify-center border border-[#fde68a] shrink-0">
            {activeChar.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                {activeChar.name} // {activeChar.title}
              </h3>
              <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold border ${activeChar.badgeColor}`}>
                {activeChar.trait}
              </span>
            </div>
            <p className="text-[11px] text-[oklch(45%_0.010_28)] font-sans">
              {activeChar.desc}
            </p>
          </div>
        </div>

        {/* Status Score & LCD Coins Deck */}
        <div className="flex items-center gap-2 font-mono text-xs self-end sm:self-auto">
          {/* God Mode Active Banner */}
          {godModeRemaining > 0 && (
            <div className="bg-amber-400 text-black px-2.5 py-1.5 rounded-[4px] font-bold flex items-center gap-1 animate-pulse border border-amber-500 shadow-sm text-[10px]">
              <Zap size={12} className="text-black fill-black" />
              <span>เทพสะตอ {godModeRemaining}s</span>
            </div>
          )}

          {/* Happy Fever Mode Active Banner */}
          {isFeverActive && (
            <div className="bg-yellow-300 text-amber-950 px-2.5 py-1.5 rounded-[4px] font-bold flex items-center gap-1 animate-bounce border border-yellow-400 shadow-sm text-[10px]">
              <Heart size={12} className="text-red-500 fill-red-500" />
              <span>FEVER 2X ({feverRemaining}s)</span>
            </div>
          )}

          {/* Earned xhaus Coin display */}
          <div className="bg-[#fef9c3] border border-[#fde047] px-2.5 py-1.5 rounded-[4px] flex items-center gap-1 text-amber-950 shadow-2xs text-[11px]">
            <Coins size={13} className="text-amber-600" />
            <span className="font-bold">+{earnedXhaus.toFixed(2)} XH</span>
          </div>

          <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] px-2.5 py-1.5 rounded-[4px] text-[oklch(18%_0.012_28)]">
            <span className="text-[8px] text-[oklch(45%_0.010_28)] block">SCORE</span>
            <span className="font-bold text-sm">{score}</span>
          </div>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] rounded-[4px] border border-[var(--color-rule)] cursor-pointer text-[oklch(18%_0.012_28)]"
            title={soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} className="text-neutral-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] rounded-[4px] border border-[var(--color-rule)] cursor-pointer text-[oklch(18%_0.012_28)]"
            title={isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นเต็มจอ'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Character Switcher Selector Tabs (Available in Idle / Game Over) */}
      {gameState !== 'playing' && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold uppercase text-[oklch(45%_0.010_28)] flex items-center gap-1">
            <User size={12} className="text-[oklch(52%_0.16_28)]" />
            <span>เลือกตัวละครของคุณ (SELECT CHARACTER):</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
            {Object.values(CHARACTERS).map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedCharId(char.id)}
                className={`p-3 rounded-md border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  selectedCharId === char.id
                    ? 'bg-amber-50/80 border-[oklch(52%_0.16_28)] shadow-2xs ring-1 ring-[oklch(52%_0.16_28)]'
                    : 'bg-[var(--color-paper-2)] border-[var(--color-rule)] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{char.icon}</span>
                    <strong className="text-[oklch(18%_0.012_28)]">{char.name}</strong>
                  </div>
                  {selectedCharId === char.id && (
                    <span className="text-[9px] bg-[oklch(52%_0.16_28)] text-white px-1.5 py-0.5 rounded font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-600 font-sans leading-tight mt-0.5">
                  {char.trait}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Happiness (Happy Vibes) Meter */}
      <div className="flex flex-col gap-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2.5 rounded-md">
        <div className="flex justify-between items-center text-[10px] font-mono">
          <div className="flex items-center gap-1.5 font-bold text-[oklch(18%_0.012_28)]">
            <Heart size={12} className={isFeverActive ? 'text-red-500 fill-red-500 animate-ping' : 'text-amber-600'} />
            <span>ความสุขริมโขง (HAPPY VIBES):</span>
            <span className="text-amber-700">{happiness}%</span>
          </div>
          <span className="text-[9px] text-[oklch(45%_0.010_28)]">
            {isFeverActive ? '🌟 HAPPY FEVER 2X ACTIVE!' : 'สะสมครบ 100% ปลดล็อค FEVER 2X'}
          </span>
        </div>
        <div className="w-full h-2.5 bg-neutral-200 rounded-full overflow-hidden p-0.5 border border-neutral-300">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${
              isFeverActive 
                ? 'bg-gradient-to-r from-amber-400 via-rose-400 to-amber-300 animate-pulse' 
                : 'bg-gradient-to-r from-amber-500 to-emerald-500'
            }`}
            style={{ width: `${isFeverActive ? 100 : happiness}%` }}
          />
        </div>
      </div>

      {/* Clean Frame Canvas Container */}
      <div 
        onClick={handleJumpPress}
        className={`relative w-full ${isFullscreen ? 'max-w-4xl aspect-[16/8]' : 'max-w-[560px] aspect-[16/8]'} mx-auto bg-[#fef8e7] rounded-lg overflow-hidden border-2 border-[#181615] cursor-pointer select-none shadow-md transition-all`}
      >
        <canvas 
          ref={canvasRef} 
          width={560} 
          height={240} 
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Spicy Tier Indicator Overlay */}
        {gameState === 'playing' && (
          <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5 font-mono text-[9px] bg-[#181615]/85 text-[#FAF7F5] px-2.5 py-1 rounded border border-[#3D3835] backdrop-blur-[2px]">
            <Flame size={11} className={currentSpicyTier >= 3 ? 'text-red-400' : 'text-amber-400'} />
            <span className="font-bold tracking-wide">
              {currentSpicyTier === 4 ? 'เผ็ดนรกแตก (TIER 4) 💀⚡' : (currentSpicyTier === 3 ? 'เผ็ดหูดับตับไหม้ (TIER 3) 🔥' : (currentSpicyTier === 2 ? 'เผ็ดปากเปิด (TIER 2) 🌶️' : 'เผ็ดอนุบาล (TIER 1)'))}
            </span>
          </div>
        )}

        {/* Start Overlay */}
        {gameState === 'idle' && (
          <div 
            onClick={(e) => { e.stopPropagation(); startGame(); }}
            className="absolute inset-0 bg-[#FAF7F5]/94 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-5 cursor-pointer"
          >
            <span className="text-4xl animate-bounce">{activeChar.icon}</span>
            <h4 className="font-mono text-base font-bold text-[#181615] uppercase tracking-widest">
              {activeChar.name} ตะลุยเมืองนครพนม
            </h4>
            <p className="text-xs text-[#69635D] font-sans max-w-md leading-relaxed">
              แตะหน้าจอ หรือกด Spacebar เพื่อกระโดดหลบ <strong>ปีศาจพริก, เหยี่ยวโขง 🦅, ผีหม้อดิน, คนหัวร้อน 🔥 และครกหินยักษ์ 💥</strong><br/>
              ใช้ <strong>กระดานสปริงฝักสะตอ 🟢</strong> ดีดตัวขึ้นฟ้า • เก็บ <strong>🌿 สะตอ</strong> แปลงร่างเป็นเทพสะตอทุบศัตรูแหลก!
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); startGame(); }}
              className="btn-action mt-2 px-6 py-2.5 bg-[#BD4924] hover:bg-[#A33C1B] text-[#FAF7F5] font-mono text-xs font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>เริ่มวิ่ง ({activeChar.name})</span>
            </button>
          </div>
        )}

        {/* Game Over Overlay with 750ms Lockout Cooldown */}
        {gameState === 'gameover' && (
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="absolute inset-0 bg-[#181615]/90 backdrop-blur-[3px] flex flex-col items-center justify-center gap-3 text-center p-6 animate-[fadeIn_0.15s_ease-out]"
          >
            <span className="text-3xl">🌶️💥</span>
            <div>
              <h4 className="font-mono text-sm font-bold text-[#BD4924] uppercase tracking-widest mb-1">
                GAME OVER // โดนชนจนหมดพลัง
              </h4>
              <p className="text-xs text-[#D9D2CB] font-mono">
                FINAL SCORE: <strong className="text-[#FAF7F5] text-base">{score} PTS</strong> // ปรุงสำเร็จ {completedPots} หม้อ
              </p>
            </div>

            {/* xhaus Reward Pill */}
            {earnedXhaus > 0 && (
              <div className="bg-[#181615] border border-[#526A3B] text-[#86efac] px-4 py-1.5 rounded-full font-mono text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                <Sparkles size={14} className="text-[#22c55e]" />
                <span>คุณได้รับ +{earnedXhaus.toFixed(2)} XHAUS COIN!</span>
              </div>
            )}

            <div className="flex gap-3 font-mono text-xs mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canRestart) return;
                  startGame();
                }}
                disabled={!canRestart}
                className={`px-5 py-2.5 font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5 ${
                  canRestart 
                    ? 'bg-[#2B2725] hover:bg-[#3D3835] text-[#FAF7F5] border border-[#5C544D]' 
                    : 'bg-[#181615] text-[#69635D] border border-[#2B2725] cursor-not-allowed'
                }`}
              >
                <RotateCcw size={13} />
                <span>{canRestart ? 'วิ่งใหม่อีกครั้ง' : 'โปรดรอสักครู่...'}</span>
              </button>

              {score > 0 && (
                <button
                  onClick={handleClaim}
                  className="px-5 py-2.5 bg-[#BD4924] hover:bg-[#A33C1B] text-[#FAF7F5] font-bold uppercase rounded-[4px] border border-[#E05A36] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Trophy size={13} />
                  <span>{isClaiming ? 'เปิดหน้าต่างบันทึกแล้ว ✓' : 'บันทึกแต้มลงบอร์ด'}</span>
                </button>
              )}
            </div>

            <p className="text-[10px] text-[#89827B] font-mono mt-0.5">
              {canRestart ? '[ แตะปุ่มวิ่งใหม่ • หรือกด SPACE ]' : '[ กำลังบันทึกผลคะแนน... ]'}
            </p>
          </div>
        )}
      </div>

      {/* Progressive Tiers & Guidelines Dashboard */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-3.5 rounded-md text-xs font-mono gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[var(--color-ink)]">
            <span className="font-bold">ระดับความยาก 4 Tiers:</span>
            <span className="text-[10px] text-[oklch(45%_0.010_28)] font-sans">
              (1) อนุบาล 0-14p → (2) ปากเปิด 15-34p → (3) หูดับ 35-59p → (4) นรกแตก 60+p
            </span>
          </div>
          <div className="text-[10px] text-zinc-600 font-sans">
            🟢 <strong>สปริงฝักสะตอ</strong>: ดีดตัวสูงข้ามสิ่งกีดขวาง • 🏆 <strong>ครกทองคำ (Tier 4)</strong>: +15 PTS & +0.25 XH!
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-bold shrink-0">
          <span className="text-[var(--color-ink)] bg-sky-500/10 px-2.5 py-1 rounded border border-sky-300/60">
            ปลาทู (+1 pt): {potIngredients.fish}/1
          </span>
          <span className="text-[var(--color-ink)] bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-300/60">
            สะตอ (เทพ 3-5s & +3 pts): {potIngredients.satow}/1
          </span>
          <span className="text-[var(--color-ink)] bg-amber-500/10 px-2.5 py-1 rounded border border-amber-300/60">
            หน่อไม้ (+2 pts): {potIngredients.bamboo}/1
          </span>
        </div>
      </div>
    </div>
  );
}

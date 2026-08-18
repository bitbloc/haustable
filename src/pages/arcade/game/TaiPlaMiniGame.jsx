/* Hallmark · component: TaiPlaMiniGame · genre: Retro Chunky Pixel Arcade · theme: Cute Nakhon Phanom x Happiness Fever & Multi-Character */
import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Maximize2, Minimize2, Coins, Zap, Flame, Heart, ChevronRight, User, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';

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
  const [currentSpicyTier, setCurrentSpicyTier] = useState(1); // 1: เผ็ดอนุบาล, 2: เผ็ดปากเปิด, 3: เผ็ดหูดับตับไหม้
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  const activeChar = CHARACTERS[selectedCharId] || CHARACTERS.tai_pla;

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
    particles: [],
    floatingTexts: [],
    lastSpawn: 0,
    groundY: 185,
    speed: 3.6,
    frame: 0,
    scaleX: 1.0,
    scaleY: 1.0,
    magnetRadius: 50,
    spicyTier: 1
  });

  // 8-Bit / Retro Chiptune Synthesizer
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
      } else if (type === 'collect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.04); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.08); // D6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
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
      particles: [],
      floatingTexts: [],
      lastSpawn: Date.now(),
      groundY: 185,
      speed: 3.6,
      frame: 0,
      scaleX: 1.0,
      scaleY: 1.0,
      magnetRadius: char.magnetRadius,
      spicyTier: 1
    };

    playRetroSound('meow');
  };

  // Ultra-Smooth Jump with Double Jump & Coyote Time
  const handleJumpPress = () => {
    if (gameState !== 'playing') {
      if (gameState === 'idle' || gameState === 'gameover') {
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
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJumpPress();
      } else if (e.code === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isFullscreen, selectedCharId]);

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
        setGodModeRemaining(Math.ceil(g.godModeTimer));
      } else if (godModeRemaining > 0) {
        setGodModeRemaining(0);
      }

      // 2. Happy Fever Mode Timer (8 seconds of 2x Multiplier + Golden Joy)
      if (g.feverTimer > 0) {
        g.feverTimer = Math.max(0, g.feverTimer - dt);
        setIsFeverActive(true);
        setFeverRemaining(Math.ceil(g.feverTimer));
      } else if (isFeverActive) {
        setIsFeverActive(false);
        setFeverRemaining(0);
      }

      // 3. Distance Milestone Score (+1 point every 140px run, 2x in Fever)
      if (g.distanceRun - g.lastDistanceScore >= 140) {
        g.lastDistanceScore = g.distanceRun;
        const addPts = g.feverTimer > 0 ? 2 : 1;
        g.score += addPts;
        setScore(g.score);

        // Slowly build happiness while running smoothly
        g.happiness = Math.min(100, g.happiness + 1.5);
        setHappiness(Math.floor(g.happiness));
      }

      // Check Happiness Meter Trigger for Happy Fever Mode
      if (g.happiness >= 100 && g.feverTimer <= 0) {
        g.happiness = 0;
        g.feverTimer = 8.0;
        setHappiness(0);
        setIsFeverActive(true);
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
          text: '🎉 HAPPY FEVER! 2X PTS',
          color: '#f59e0b',
          life: 2.0
        });
      }

      // 4. Progressive Difficulty & Spicy Tiers Scaling
      let tier = 1;
      if (g.score >= 25) {
        tier = 3;
        g.speed = Math.min(7.6, 5.8 + Math.floor((g.score - 25) / 6) * 0.3);
      } else if (g.score >= 10) {
        tier = 2;
        g.speed = Math.min(5.6, 4.4 + Math.floor((g.score - 10) / 4) * 0.25);
      } else {
        tier = 1;
        g.speed = Math.min(4.3, 3.6 + Math.floor(g.score / 3) * 0.2);
      }
      if (tier !== g.spicyTier) {
        g.spicyTier = tier;
        setCurrentSpicyTier(tier);
        g.floatingTexts.push({
          x: canvas.width / 2 - 60,
          y: 60,
          text: tier === 3 ? '🔥 เผ็ดหูดับตับไหม้! (TIER 3)' : (tier === 2 ? '🌶️ เผ็ดปากเปิด! (TIER 2)' : '🌱 เผ็ดอนุบาล'),
          color: tier === 3 ? '#ef4444' : '#f97316',
          life: 1.8
        });
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

      // 6. Spawn Items & Enemies
      const nowMs = Date.now();
      const spawnInterval = Math.max(750, 1450 - g.score * 20);
      if (nowMs - g.lastSpawn > spawnInterval) {
        g.lastSpawn = nowMs;
        const isMonster = Math.random() > (g.feverTimer > 0 ? 0.65 : 0.42);

        if (isMonster) {
          const r = Math.random();
          let monsterType = 'hop_chili';

          if (g.spicyTier >= 2 && r > 0.7) {
            monsterType = 'hawk'; // 🦅 Flying Hawk
          } else if (g.spicyTier >= 2 && r > 0.45) {
            monsterType = 'coconut'; // 🥥 Fast rolling coconut
          } else if (g.score >= 5 && r > 0.25) {
            monsterType = 'hot_runner'; // 🔥 Charging flaming man
          } else if (r > 0.12) {
            monsterType = 'hop_chili'; // 🌶️ Hopping chili
          } else {
            monsterType = 'run_chili';
          }

          const monY = monsterType === 'hawk' ? g.groundY - 55 : g.groundY;
          const monW = monsterType === 'hawk' ? 28 : (monsterType === 'hot_runner' ? 26 : (monsterType === 'coconut' ? 20 : 24));
          const monH = monsterType === 'hawk' ? 20 : (monsterType === 'hot_runner' ? 34 : (monsterType === 'coconut' ? 20 : 28));
          const speedMul = monsterType === 'hot_runner' ? 1.45 : (monsterType === 'coconut' ? 1.35 : (monsterType === 'hawk' ? 1.2 : 1.0));

          g.monsters.push({
            x: canvas.width + 30,
            y: monY,
            type: monsterType,
            width: monW,
            height: monH,
            speedMultiplier: speedMul,
            animPhase: Math.random() * Math.PI * 2
          });
        } else {
          const r = Math.random();
          const foodType = r > 0.65 ? 'satow' : (r > 0.3 ? 'fish' : 'bamboo');
          g.items.push({
            x: canvas.width + 20,
            y: g.groundY - (Math.random() > 0.5 ? 42 : 14),
            type: foodType,
            bobOffset: Math.random() * Math.PI * 2,
            size: 22
          });
        }
      }

      // 7. Update Collectible Items (With Magnetic Pull)
      g.items.forEach((item, idx) => {
        item.x -= g.speed;
        const bob = Math.sin(g.frame * 0.09 + item.bobOffset) * 3.5;
        const currentItemY = item.y + bob;

        const distCatX = g.catX + 14 - (item.x + 11);
        const distCatY = g.catY - 14 - (currentItemY + 11);
        const dist = Math.hypot(distCatX, distCatY);
        if (dist < g.magnetRadius) {
          const pullSpeed = g.charId === 'khao_lam' ? 0.35 : 0.24;
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
              x: item.x + 11,
              y: currentItemY + 11,
              vx: (Math.random() - 0.5) * 3.5,
              vy: (Math.random() - 0.5) * 3.5,
              size: Math.random() * 4 + 2,
              color: item.type === 'satow' ? '#22c55e' : (item.type === 'fish' ? '#38bdf8' : '#f59e0b'),
              life: 0.8
            });
          }
        }
      });
      g.items = g.items.filter(i => i.x > -40);

      // 8. Update Enemies Physics & Collision
      for (let idx = g.monsters.length - 1; idx >= 0; idx--) {
        const mon = g.monsters[idx];
        mon.x -= g.speed * (mon.speedMultiplier || 1.0);

        let monY = mon.y;
        if (mon.type === 'hop_chili') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.09 + mon.animPhase)) * 22;
        } else if (mon.type === 'hawk') {
          monY = mon.y + Math.sin(g.frame * 0.08 + mon.animPhase) * 8;
        }

        // Ember smoke behind flamer
        if (mon.type === 'hot_runner' && Math.random() > 0.5) {
          g.particles.push({
            x: mon.x + 18,
            y: monY - 24,
            vx: Math.random() * 2 + 1,
            vy: -Math.random() * 2 - 0.5,
            size: Math.random() * 3 + 2,
            color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
            life: 0.6
          });
        }

        const catBox = { left: g.catX + 8, right: g.catX + 24, top: g.catY - 20, bottom: g.catY - 2 };
        const monBox = { 
          left: mon.x + 4, 
          right: mon.x + mon.width - 4, 
          top: monY - mon.height + 4, 
          bottom: monY 
        };

        if (
          catBox.right > monBox.left &&
          catBox.left < monBox.right &&
          catBox.bottom > monBox.top &&
          catBox.top < monBox.bottom
        ) {
          // IF IN GOD MODE: SMASH ENEMY!
          if (g.godModeTimer > 0) {
            playRetroSound('smash');
            g.monsters.splice(idx, 1);
            const smashPts = g.feverTimer > 0 ? 4 : 2;
            g.score += smashPts;
            setScore(g.score);

            g.floatingTexts.push({
              x: mon.x,
              y: monY - 30,
              text: `💥 SMASH! +${smashPts}`,
              color: '#facc15',
              life: 1.2
            });

            for (let p = 0; p < 12; p++) {
              g.particles.push({
                x: mon.x + 12,
                y: monY - 15,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                size: Math.random() * 4 + 2,
                color: '#facc15',
                life: 0.8
              });
            }
            continue;
          }

          // Otherwise: Player is hit -> Game Over
          playRetroSound('hit');
          setGameState('gameover');

          if (g.score > highScore) {
            setHighScore(g.score);
            localStorage.setItem('tai_pla_high_score', g.score.toString());
            confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
          }
          return;
        }
      }
      g.monsters = g.monsters.filter(m => m.x > -50);

      // 9. Update Particles & Floating Texts
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
      // 🎨 RETRO CHUNKY PIXEL ART RENDERING
      // ============================================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Sky Background according to Spicy Tier and Fever Mode
      if (g.feverTimer > 0) {
        ctx.fillStyle = '#fefce8';
      } else if (g.spicyTier === 3) {
        ctx.fillStyle = '#1e1b4b';
      } else if (g.spicyTier === 2) {
        ctx.fillStyle = '#fde68a';
      } else {
        ctx.fillStyle = '#fef8e7';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Sun / Moon Display
      const sunX = canvas.width - 65;
      const sunY = 38;
      if (g.spicyTier === 3) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(sunX + 6, sunY - 4, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = g.spicyTier === 2 ? '#ea580c' : '#f59e0b';
        ctx.fillRect(sunX - 16, sunY - 4, 32, 8);
        ctx.fillRect(sunX - 4, sunY - 16, 8, 32);
        ctx.fillRect(sunX - 12, sunY - 12, 24, 24);
        ctx.fillStyle = g.spicyTier === 2 ? '#fbbf24' : '#fde047';
        ctx.fillRect(sunX - 10, sunY - 10, 20, 20);
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(sunX - 5, sunY - 3, 2, 4);
        ctx.fillRect(sunX + 3, sunY - 3, 2, 4);
        ctx.fillRect(sunX - 1, sunY + 2, 2, 2);
      }

      // Clouds
      const drawCuteCloud = (cx, cy) => {
        const cloudTint = g.spicyTier === 3 ? '#4338ca' : (g.spicyTier === 2 ? '#fdba74' : '#93c5fd');
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cx, cy + 6, 44, 16);
        ctx.fillRect(cx + 8, cy, 28, 24);
        ctx.fillRect(cx + 14, cy - 4, 16, 30);

        ctx.fillStyle = cloudTint;
        ctx.fillRect(cx + 2, cy + 8, 40, 12);
        ctx.fillRect(cx + 10, cy + 2, 24, 20);
        ctx.fillRect(cx + 16, cy - 2, 12, 24);

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cx + 12, cy + 8, 3, 3);
        ctx.fillRect(cx + 26, cy + 8, 3, 3);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(cx + 8, cy + 12, 4, 2);
        ctx.fillRect(cx + 30, cy + 12, 4, 2);
      };

      const cloud1X = (canvas.width - ((g.distanceRun * 0.2) % (canvas.width + 120)) + canvas.width + 120) % (canvas.width + 120) - 60;
      const cloud2X = (canvas.width - (((g.distanceRun * 0.2) + 260) % (canvas.width + 120)) + canvas.width + 120) % (canvas.width + 120) - 60;
      drawCuteCloud(cloud1X, 26);
      drawCuteCloud(cloud2X, 46);

      // Distant Lao Mountains Silhouette
      ctx.fillStyle = g.spicyTier === 3 ? '#312e81' : (g.spicyTier === 2 ? '#d97706' : '#ebd5b3');
      ctx.beginPath();
      ctx.moveTo(0, 145);
      for (let mx = 0; mx <= canvas.width; mx += 20) {
        const peak = Math.sin((mx + g.distanceRun * 0.15) * 0.02) * 14;
        ctx.lineTo(mx, 135 + peak);
      }
      ctx.lineTo(canvas.width, 155);
      ctx.lineTo(0, 155);
      ctx.closePath();
      ctx.fill();

      // Mekong River Shimmer Band
      ctx.fillStyle = g.spicyTier === 3 ? '#0284c7' : '#38bdf8';
      ctx.fillRect(0, 146, canvas.width, 14);
      ctx.fillStyle = g.spicyTier === 3 ? '#38bdf8' : '#bae6fd';
      const waveShift = (g.frame * 2) % 28;
      for (let wx = -28; wx < canvas.width; wx += 28) {
        ctx.fillRect(wx + waveShift, 150, 14, 2);
      }

      // Continuous Scenery & Landmarks
      const totalLoop = 1800;
      const getSceneX = (baseX) => {
        const scrolled = (baseX - (g.distanceRun * 0.85)) % totalLoop;
        return ((scrolled % totalLoop) + totalLoop) % totalLoop - 100;
      };

      // 1. วัดมหาธาตุ
      const watX = getSceneX(200);
      if (watX > -120 && watX < canvas.width + 80) {
        const gy = g.groundY;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(watX, gy - 46, 44, 46);
        ctx.fillRect(watX + 6, gy - 66, 32, 20);
        ctx.fillRect(watX + 12, gy - 86, 20, 20);
        ctx.fillRect(watX + 18, gy - 110, 8, 24);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(watX + 3, gy - 43, 38, 43);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(watX + 9, gy - 63, 26, 17);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(watX + 15, gy - 83, 14, 17);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(watX + 20, gy - 108, 4, 22);
      }

      // 2. รถเข็นผลไม้ไทย
      const cartX = getSceneX(650);
      if (cartX > -120 && cartX < canvas.width + 80) {
        const gy = g.groundY;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cartX, gy - 44, 44, 34);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(cartX + 2, gy - 42, 40, 30);

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cartX + 5, gy - 38, 9, 9);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(cartX + 16, gy - 38, 9, 9);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(cartX + 27, gy - 38, 9, 9);

        ctx.fillStyle = '#1f1d24';
        ctx.beginPath();
        ctx.arc(cartX + 14, gy - 8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(cartX + 14, gy - 8, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cartX + 46, gy - 24, 18, 24);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(cartX + 48, gy - 22, 14, 22);
      }

      // 3. พญาศรีสัตตนาคราช
      const nagaX = getSceneX(1450);
      if (nagaX > -120 && nagaX < canvas.width + 80) {
        const gy = g.groundY;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(nagaX, gy - 36, 52, 36);
        ctx.fillStyle = '#334155';
        ctx.fillRect(nagaX + 3, gy - 33, 46, 33);

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(nagaX + 8, gy - 66, 34, 32);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(nagaX + 11, gy - 63, 28, 26);

        const headColors = ['#fde047', '#facc15', '#eab308'];
        const heads = [4, 11, 18, 25, 32, 39, 46];
        heads.forEach((hx, i) => {
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(nagaX + hx - 3, gy - 86 - (i === 3 ? 10 : (i === 2 || i === 4 ? 5 : 0)), 8, 18);
          ctx.fillStyle = headColors[i % 3];
          ctx.fillRect(nagaX + hx - 1, gy - 84 - (i === 3 ? 10 : (i === 2 || i === 4 ? 5 : 0)), 4, 14);
        });

        ctx.fillStyle = '#38bdf8';
        const waterSpurt = (g.frame * 3) % 20;
        ctx.fillRect(nagaX - 8 - waterSpurt, gy - 80 + waterSpurt * 1.5, 4, 4);
      }

      // Solid Ground Line & Checkered Grass
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(0, g.groundY, canvas.width, 3);
      ctx.fillStyle = g.spicyTier === 3 ? '#166534' : '#65a30d';
      ctx.fillRect(0, g.groundY + 3, canvas.width, canvas.height - (g.groundY + 3));

      ctx.fillStyle = g.spicyTier === 3 ? '#14532d' : '#4d7c0f';
      const tileShift = (g.distanceRun * 2.4) % 24;
      for (let tx = -24; tx < canvas.width; tx += 24) {
        ctx.fillRect(tx + tileShift, g.groundY + 3, 12, 10);
        ctx.fillRect(tx + tileShift + 12, g.groundY + 13, 12, 18);
      }

      // ============================================================
      // 🌶️ 🔥 🦅 🥥 DRAW ENEMIES
      // ============================================================
      g.monsters.forEach(mon => {
        ctx.save();
        let monY = mon.y;
        if (mon.type === 'hop_chili') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.09 + mon.animPhase)) * 22;
        } else if (mon.type === 'hawk') {
          monY = mon.y + Math.sin(g.frame * 0.08 + mon.animPhase) * 8;
        }

        const mx = mon.x;

        if (mon.type !== 'hawk') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.beginPath();
          ctx.ellipse(mx + (mon.type === 'hot_runner' ? 13 : 10), g.groundY + 2, 10, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        if (mon.type === 'hawk') {
          // 🦅 Flying Hawk
          const flap = Math.sin(g.frame * 0.25) * 6;
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(mx + 6, monY - 14, 16, 12);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(mx + 8, monY - 12, 12, 8);

          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(mx + 2, monY - 16, 8, 8);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(mx - 2, monY - 14, 5, 4);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(mx + 3, monY - 14, 3, 3);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(mx + 4, monY - 13, 2, 2);

          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.moveTo(mx + 8, monY - 10);
          ctx.lineTo(mx + 16, monY - 22 - flap);
          ctx.lineTo(mx + 22, monY - 8);
          ctx.closePath();
          ctx.fill();
        } else if (mon.type === 'coconut') {
          // 🥥 Rolling Coconut
          const rot = g.frame * 0.2;
          ctx.save();
          ctx.translate(mx + 10, monY - 10);
          ctx.rotate(rot);
          ctx.fillStyle = '#1f1d24';
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-3, -4, 2, 2);
          ctx.fillRect(2, -4, 2, 2);
          ctx.fillRect(0, 2, 3, 2);
          ctx.restore();
        } else if (mon.type === 'hot_runner') {
          // 🔥 Hot Runner
          const runCycle = Math.floor((g.frame / 4) % 4);
          const flamePulse = Math.sin(g.frame * 0.3) * 3;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(mx + 6, monY - 26);
          ctx.lineTo(mx + 13, monY - 38 - flamePulse);
          ctx.lineTo(mx + 20, monY - 26);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.fillRect(mx + 10, monY - 34 - flamePulse * 0.6, 6, 8);

          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(mx + 4, monY - 28, 18, 16);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(mx + 6, monY - 26, 14, 12);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(mx + 7, monY - 22, 3, 3);
          ctx.fillRect(mx + 15, monY - 22, 3, 3);
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(mx + 8, monY - 21, 2, 2);
          ctx.fillRect(mx + 15, monY - 21, 2, 2);

          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(mx + 6, monY - 12, 14, 10);
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(mx + 8, monY - 10, 10, 8);

          ctx.fillStyle = '#1f1d24';
          if (runCycle === 0) {
            ctx.fillRect(mx + 4, monY - 2, 5, 4);
            ctx.fillRect(mx + 16, monY - 2, 5, 4);
          } else {
            ctx.fillRect(mx + 8, monY - 2, 5, 4);
            ctx.fillRect(mx + 12, monY - 2, 5, 4);
          }
        } else {
          // 🌶️ Chili Demon
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(mx + 3, monY - 24, 18, 22);
          ctx.fillRect(mx + 6, monY - 28, 12, 26);
          ctx.fillRect(mx + 1, monY - 16, 22, 12);

          ctx.fillStyle = '#ef4444';
          ctx.fillRect(mx + 5, monY - 22, 14, 18);
          ctx.fillRect(mx + 8, monY - 26, 8, 22);
          ctx.fillRect(mx + 3, monY - 14, 18, 8);

          ctx.fillStyle = '#22c55e';
          ctx.fillRect(mx + 10, monY - 30, 4, 4);

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(mx + 6, monY - 16, 4, 4);
          ctx.fillRect(mx + 14, monY - 16, 4, 4);
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(mx + 8, monY - 15, 2, 3);
          ctx.fillRect(mx + 16, monY - 15, 2, 3);

          const walkCycle = Math.sin(g.frame * 0.25) * 3;
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(mx + 5 + walkCycle, monY - 3, 4, 3);
          ctx.fillRect(mx + 15 - walkCycle, monY - 3, 4, 3);
        }

        ctx.restore();
      });

      // ============================================================
      // 🐟 🌿 🎋 DRAW INGREDIENTS
      // ============================================================
      g.items.forEach(item => {
        ctx.save();
        const bob = Math.sin(g.frame * 0.09 + item.bobOffset) * 3.5;
        const ix = item.x;
        const iy = item.y + bob;

        if (item.type === 'satow') {
          const satowGlow = Math.sin(g.frame * 0.2) * 2;
          ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
          ctx.beginPath();
          ctx.arc(ix + 11, iy + 10, 14 + satowGlow, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 2, iy + 2, 18, 16);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(ix + 4, iy + 4, 14, 12);
          ctx.fillStyle = '#86efac';
          ctx.fillRect(ix + 6, iy + 6, 4, 4);
          ctx.fillRect(ix + 12, iy + 9, 4, 4);
        } else if (item.type === 'fish') {
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 2, iy + 4, 18, 12);
          ctx.fillRect(ix + 18, iy + 2, 4, 16);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(ix + 4, iy + 6, 14, 8);
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 6, iy + 8, 2, 2);
        } else {
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 4, iy + 2, 14, 18);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(ix + 6, iy + 4, 10, 14);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(ix + 6, iy + 10, 10, 2);
        }
        ctx.restore();
      });

      // ============================================================
      // 🐱 🐕 DRAW HERO SPRITES
      // ============================================================
      ctx.save();
      const catX = g.catX;
      const catY = g.catY;
      const legRun = Math.floor((g.frame / 5) % 4);

      // Ground Shadow
      const shadowScale = Math.max(0.4, 1.0 - (g.groundY - catY) / 100);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.beginPath();
      ctx.ellipse(catX + 16, g.groundY + 2, 13 * shadowScale, 3.5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // GOD MODE / FEVER AURA
      if (g.feverTimer > 0) {
        const auraPulse = Math.sin(g.frame * 0.35) * 5;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.beginPath();
        ctx.arc(catX + 16, catY - 14, 26 + auraPulse, 0, Math.PI * 2);
        ctx.fill();

        if (Math.random() > 0.4) {
          g.particles.push({
            x: catX + (Math.random() * 24 - 4),
            y: catY - (Math.random() * 28 + 4),
            vx: (Math.random() - 0.5) * 1.5,
            vy: -Math.random() * 2.5,
            size: Math.random() * 4 + 2,
            color: Math.random() > 0.5 ? '#f43f5e' : '#facc15',
            life: 0.7
          });
        }
      } else if (g.godModeTimer > 0) {
        const auraPulse = Math.sin(g.frame * 0.3) * 4;
        ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
        ctx.beginPath();
        ctx.arc(catX + 16, catY - 14, 24 + auraPulse, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.translate(catX + 16, catY);
      ctx.scale(g.scaleX, g.scaleY);
      ctx.translate(-(catX + 16), -catY);

      if (g.charId === 'som_satow') {
        // พี่ส้มสตอ
        const tailWag = Math.sin(g.frame * 0.2) * 3;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 2 + tailWag, catY - 14, 4, 4);
        ctx.fillRect(catX - 2 + tailWag, catY - 18, 4, 6);

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 4, catY - 22, 24, 18);
        ctx.fillRect(catX + 8, catY - 26, 16, 22);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(catX + 6, catY - 20, 20, 14);

        ctx.fillStyle = '#c2410c';
        ctx.fillRect(catX + 10, catY - 20, 3, 10);
        ctx.fillRect(catX + 16, catY - 20, 3, 10);

        ctx.fillStyle = '#16a34a';
        ctx.fillRect(catX + 18, catY - 14, 5, 8);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(catX + 19, catY - 12, 3, 6);

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 18, catY - 28, 16, 16);
        ctx.fillRect(catX + 20, catY - 34, 4, 6);
        ctx.fillRect(catX + 28, catY - 34, 4, 6);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(catX + 20, catY - 26, 12, 12);
      } else if (g.charId === 'khao_lam') {
        // เจ้าตูบข้าวหลาม
        const tailWag = Math.sin(g.frame * 0.3) * 4;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 1 + tailWag, catY - 18, 5, 5);
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(catX + 2 + tailWag, catY - 17, 3, 3);

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 4, catY - 22, 24, 18);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(catX + 6, catY - 20, 20, 14);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(catX + 10, catY - 12, 10, 6);

        ctx.fillStyle = '#dc2626';
        ctx.fillRect(catX + 18, catY - 14, 4, 5);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(catX + 19, catY - 10, 2, 2);

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 18, catY - 28, 16, 16);
        ctx.fillRect(catX + 18, catY - 32, 5, 6);
        ctx.fillRect(catX + 29, catY - 32, 5, 6);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(catX + 19, catY - 31, 3, 4);
        ctx.fillRect(catX + 30, catY - 31, 3, 4);

        ctx.fillStyle = '#d97706';
        ctx.fillRect(catX + 20, catY - 26, 12, 12);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(catX + 26, catY - 20, 6, 6);
      } else {
        // น้องไตปลา
        const tailWag = Math.sin(g.frame * 0.2) * 3;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 2 + tailWag, catY - 14, 4, 4);
        ctx.fillRect(catX - 2 + tailWag, catY - 18, 4, 6);

        ctx.fillStyle = g.godModeTimer > 0 ? '#ca8a04' : '#1f1d24';
        ctx.fillRect(catX + 4, catY - 22, 24, 18);
        ctx.fillRect(catX + 8, catY - 26, 16, 22);

        ctx.fillStyle = g.godModeTimer > 0 ? '#fef08a' : '#fef3c7';
        ctx.fillRect(catX + 6, catY - 20, 20, 14);

        ctx.fillStyle = '#f97316';
        ctx.fillRect(catX + 8, catY - 20, 8, 8);
        ctx.fillRect(catX + 18, catY - 14, 6, 6);
        ctx.fillStyle = g.godModeTimer > 0 ? '#eab308' : '#1f1d24';
        ctx.fillRect(catX + 18, catY - 20, 6, 6);

        ctx.fillStyle = g.godModeTimer > 0 ? '#ca8a04' : '#1f1d24';
        ctx.fillRect(catX + 18, catY - 28, 16, 16);
        ctx.fillRect(catX + 20, catY - 34, 4, 6);
        ctx.fillRect(catX + 28, catY - 34, 4, 6);
        ctx.fillStyle = g.godModeTimer > 0 ? '#fef08a' : '#fef3c7';
        ctx.fillRect(catX + 20, catY - 26, 12, 12);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(catX + 21, catY - 32, 2, 4);
        ctx.fillStyle = g.godModeTimer > 0 ? '#eab308' : '#1f1d24';
        ctx.fillRect(catX + 29, catY - 32, 2, 4);
      }

      // Eyes
      if (g.feverTimer > 0) {
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 27, catY - 23, 4, 2);
        ctx.fillRect(catX + 26, catY - 22, 2, 2);
        ctx.fillRect(catX + 30, catY - 22, 2, 2);

        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(catX + 24, catY - 18, 4, 3);
        ctx.fillRect(catX + 31, catY - 18, 3, 3);
      } else {
        ctx.fillStyle = g.godModeTimer > 0 ? '#b45309' : '#1f1d24';
        ctx.fillRect(catX + 28, catY - 22, 3, 4);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(catX + 31, catY - 19, 2, 2);
        ctx.fillRect(catX + 24, catY - 18, 3, 2);
      }

      // Running Paws
      ctx.fillStyle = '#1f1d24';
      if (g.isGrounded) {
        if (legRun === 0) {
          ctx.fillRect(catX + 8, catY - 3, 4, 4);
          ctx.fillRect(catX + 20, catY - 3, 4, 4);
        } else {
          ctx.fillRect(catX + 12, catY - 3, 4, 4);
          ctx.fillRect(catX + 16, catY - 3, 4, 4);
        }
      } else {
        ctx.fillRect(catX + 10, catY - 5, 4, 4);
        ctx.fillRect(catX + 20, catY - 5, 4, 4);
      }

      ctx.restore();

      // ============================================================
      // PARTICLES & FLOATING REWARD TEXTS
      // ============================================================
      g.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size * p.life, p.size * p.life);
      });

      g.floatingTexts.forEach(ft => {
        ctx.font = 'bold 12px Space Mono, monospace';
        ctx.fillStyle = '#1f1d24';
        ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, soundEnabled, highScore, selectedCharId]);

  const handleClaim = () => {
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
        className={`relative w-full ${isFullscreen ? 'max-w-4xl aspect-[16/8]' : 'max-w-[560px] aspect-[16/8]'} mx-auto bg-[#fef8e7] rounded-lg overflow-hidden border-2 border-[#1f1d24] cursor-pointer select-none shadow-md transition-all`}
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
          <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5 font-mono text-[9px] bg-black/60 text-white px-2 py-0.5 rounded backdrop-blur-[2px]">
            <Flame size={11} className={currentSpicyTier === 3 ? 'text-red-400' : 'text-amber-400'} />
            <span>
              {currentSpicyTier === 3 ? 'เผ็ดหูดับตับไหม้ 🔥' : (currentSpicyTier === 2 ? 'เผ็ดปากเปิด 🌶️' : 'เผ็ดอนุบาล 🌱')}
            </span>
          </div>
        )}

        {/* Start Overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-[#fef8e7]/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-5">
            <span className="text-4xl animate-bounce">{activeChar.icon}</span>
            <h4 className="font-mono text-base font-bold text-[#1f1d24] uppercase tracking-widest">
              {activeChar.name} ตะลุยเมืองนครพนม
            </h4>
            <p className="text-xs text-[#4b5563] font-sans max-w-sm leading-relaxed">
              แตะหน้าจอ หรือกด Spacebar เพื่อกระโดดหลบ <strong>ปีศาจพริก, เหยี่ยวน้ำโขง 🦅, มะพร้าว 🥥 และคนหัวร้อน 🔥</strong><br/>
              เก็บ <strong>🌿 สะตอ</strong> แปลงร่างเป็น <strong>เทพสะตอ</strong> และสะสม <strong>หลอดความสุข</strong> รับ 2X Fever!
            </p>
            <button
              onClick={startGame}
              className="btn-action mt-2 px-6 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-mono text-xs font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>เริ่มวิ่ง ({activeChar.name})</span>
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-[#fef8e7]/90 backdrop-blur-[3px] flex flex-col items-center justify-center gap-3 text-center p-6 animate-[fadeIn_0.15s_ease-out]">
            <span className="text-3xl">🌶️💥</span>
            <div>
              <h4 className="font-mono text-base font-bold text-red-600 uppercase tracking-widest mb-1">
                โดนชนจนหมดพลัง! (GAME OVER)
              </h4>
              <p className="text-xs text-[#374151] font-mono">
                FINAL SCORE: <strong className="text-[#ea580c]">{score} PTS</strong> // ปรุงสำเร็จ {completedPots} หม้อ
              </p>
            </div>

            {/* xhaus Reward Pill */}
            {earnedXhaus > 0 && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-1.5 rounded-full font-mono text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                <Sparkles size={14} className="text-emerald-600" />
                <span>คุณได้รับ +{earnedXhaus.toFixed(2)} XHAUS COIN!</span>
              </div>
            )}

            <div className="flex gap-3 font-mono text-xs mt-1">
              <button
                onClick={startGame}
                className="btn-action px-5 py-2.5 bg-[#1f1d24] hover:bg-black text-white font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>วิ่งใหม่อีกครั้ง</span>
              </button>

              {score > 0 && (
                <button
                  onClick={handleClaim}
                  className="btn-action px-5 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Trophy size={13} />
                  <span>บันทึกแต้มลงบอร์ด</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Clean Ingredients & Guidelines Dashboard */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-[#fef8e7] border border-[#fde68a] p-3.5 rounded-[4px] text-xs font-mono gap-2">
        <div className="flex items-center gap-2 text-[#451a03]">
          <span className="font-bold">🥘 สะสมวัตถุดิบ (ครบ 3 อย่าง = +6 PTS & +0.10 XH):</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold">
          <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            🐟 ปลาทู (+1 pt): {potIngredients.fish}/1
          </span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            🌿 สะตอ (เทพ 3-5s & +3 pts): {potIngredients.satow}/1
          </span>
          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            🎋 หน่อไม้ (+2 pts): {potIngredients.bamboo}/1
          </span>
        </div>
      </div>
    </div>
  );
}

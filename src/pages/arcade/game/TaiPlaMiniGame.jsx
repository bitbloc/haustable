/* Hallmark · component: TaiPlaMiniGame · genre: 16-bit / High-Def Arcade Runner · theme: Nakhon Phanom (Wat Mahathat, Vietnam Clock Tower, Phaya Si Sattanakharat) x Southern Thai */
import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Flame, Heart, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function TaiPlaMiniGame() {
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'playing' | 'gameover'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('tai_pla_high_score') || '0', 10);
  });
  const [potIngredients, setPotIngredients] = useState({ fish: 0, satow: 0, bamboo: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Smooth Physics & Game Loop State
  const gameRef = useRef({
    catX: 70,
    catY: 200,
    catVy: 0,
    isGrounded: true,
    jumpTimer: 0,
    score: 0,
    distanceRun: 0,
    items: [],
    monsters: [],
    particles: [],
    lastSpawn: 0,
    groundY: 205,
    speed: 4.2,
    frame: 0,
    squashStretch: 1.0
  });

  // High-def Arcade Sound Synthesizer
  const playArcadeSound = (type) => {
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
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.16);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
      } else if (type === 'collect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.05); // E5
        osc.frequency.setValueAtTime(1046.50, now + 0.10); // C6
        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.32);
      }
    } catch (e) {}
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setPotIngredients({ fish: 0, satow: 0, bamboo: 0 });
    gameRef.current = {
      catX: 70,
      catY: 200,
      catVy: 0,
      isGrounded: true,
      jumpTimer: 0,
      score: 0,
      distanceRun: 0,
      items: [],
      monsters: [],
      particles: [],
      lastSpawn: Date.now(),
      groundY: 205,
      speed: 4.2,
      frame: 0,
      squashStretch: 1.0
    };
  };

  // Smooth variable jump with spring physics
  const jump = () => {
    if (gameState !== 'playing') {
      if (gameState === 'idle' || gameState === 'gameover') {
        startGame();
      }
      return;
    }

    const g = gameRef.current;
    if (g.isGrounded) {
      g.catVy = -13.2; // Smooth launch velocity
      g.isGrounded = false;
      g.squashStretch = 1.35; // Stretch vertically on jump
      playArcadeSound('jump');

      // Jump dust particles
      for (let i = 0; i < 5; i++) {
        g.particles.push({
          x: g.catX + 15 + (Math.random() * 10 - 5),
          y: g.groundY + 2,
          vx: (Math.random() - 0.7) * 2,
          vy: -Math.random() * 2,
          radius: Math.random() * 3 + 2,
          color: 'rgba(255, 200, 150, 0.7)',
          life: 1.0
        });
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Main High-Def Game Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const dt = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const g = gameRef.current;
      g.frame++;
      g.distanceRun += g.speed * 1.0;

      // 1. Smooth Physics (Arcade Spring Gravity)
      g.catVy += 34 * dt; // Gravity
      g.catY += g.catVy;

      // Smooth recover from stretch/squash
      g.squashStretch += (1.0 - g.squashStretch) * 0.15;

      if (g.catY >= g.groundY) {
        if (!g.isGrounded) {
          g.squashStretch = 0.75; // Squash on landing
          // Land dust
          for (let i = 0; i < 4; i++) {
            g.particles.push({
              x: g.catX + 15 + (Math.random() * 14 - 7),
              y: g.groundY + 2,
              vx: (Math.random() - 0.5) * 2.5,
              vy: -Math.random() * 1.5,
              radius: Math.random() * 2.5 + 1.5,
              color: 'rgba(255, 220, 180, 0.6)',
              life: 0.8
            });
          }
        }
        g.catY = g.groundY;
        g.catVy = 0;
        g.isGrounded = true;
      }

      // Smooth progressive speed acceleration
      g.speed = Math.min(7.8, 4.2 + g.score * 0.035);

      // 2. Spawn Items & Animated Chili Demons
      const nowMs = Date.now();
      if (nowMs - g.lastSpawn > 1200 / (g.speed / 4.2)) {
        g.lastSpawn = nowMs;
        const isMonster = Math.random() > 0.42;

        if (isMonster) {
          // Spawn "ปีศาจพริกแกง" (Spicy Chili Demon) with distinct personality
          const monsterType = Math.random() > 0.5 ? 'hopper' : 'flamer';
          g.monsters.push({
            x: canvas.width + 30,
            y: g.groundY,
            vy: 0,
            type: monsterType,
            width: 32,
            height: 38,
            hopPhase: Math.random() * Math.PI,
            flameFrame: 0
          });
        } else {
          // Spawn Ingredients
          const r = Math.random();
          const foodType = r > 0.6 ? 'satow' : (r > 0.3 ? 'fish' : 'bamboo');
          g.items.push({
            x: canvas.width + 20,
            y: g.groundY - (Math.random() > 0.5 ? 54 : 18),
            type: foodType,
            bobOffset: Math.random() * Math.PI * 2,
            size: 26
          });
        }
      }

      // 3. Update Collectible Items
      g.items.forEach((item, idx) => {
        item.x -= g.speed;
        const bob = Math.sin(g.frame * 0.08 + item.bobOffset) * 4;

        // Collision detection with Cat Box (x=70, w=34, h=30)
        const catBox = { x: g.catX + 4, y: g.catY - 26, w: 34, h: 28 };
        if (
          catBox.x < item.x + item.size &&
          catBox.x + catBox.w > item.x &&
          catBox.y < item.y + bob + item.size &&
          catBox.y + catBox.h > item.y + bob
        ) {
          g.items.splice(idx, 1);
          const pts = item.type === 'satow' ? 20 : (item.type === 'fish' ? 10 : 15);
          g.score += pts;
          setScore(g.score);

          setPotIngredients(prev => ({
            ...prev,
            [item.type]: prev[item.type] + 1
          }));

          playArcadeSound('collect');

          // Collect sparkles
          for (let p = 0; p < 8; p++) {
            g.particles.push({
              x: item.x + 12,
              y: item.y + bob + 12,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              radius: Math.random() * 3 + 2,
              color: item.type === 'satow' ? '#4ade80' : (item.type === 'fish' ? '#38bdf8' : '#fde047'),
              life: 1.0
            });
          }
        }
      });
      g.items = g.items.filter(i => i.x > -40);

      // 4. Update Lively Chili Demons ("ปีศาจพริก")
      for (let idx = 0; idx < g.monsters.length; idx++) {
        const mon = g.monsters[idx];
        mon.x -= g.speed;
        mon.flameFrame += 0.2;

        // Lively movement: Hopper Chili hops up and down
        let currentMonY = mon.y;
        if (mon.type === 'hopper') {
          const hop = Math.abs(Math.sin(g.frame * 0.09 + mon.hopPhase)) * 26;
          currentMonY = mon.y - hop;
        }

        // Spawn chili ember particles
        if (Math.random() > 0.6) {
          g.particles.push({
            x: mon.x + 16,
            y: currentMonY - 30,
            vx: -Math.random() * 1.5 - 0.5,
            vy: -Math.random() * 2 - 0.5,
            radius: Math.random() * 2.5 + 1,
            color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
            life: 0.7
          });
        }

        // Collision Check with Cat
        const catBox = { x: g.catX + 8, y: g.catY - 24, w: 26, h: 24 };
        if (
          catBox.x < mon.x + mon.width - 6 &&
          catBox.x + catBox.w > mon.x + 6 &&
          catBox.y < currentMonY &&
          catBox.y + catBox.h > currentMonY - mon.height + 6
        ) {
          // Hit Demon -> Game Over
          playArcadeSound('hit');
          setGameState('gameover');

          if (g.score > highScore) {
            setHighScore(g.score);
            localStorage.setItem('tai_pla_high_score', g.score.toString());
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
          }
          return;
        }
      }
      g.monsters = g.monsters.filter(m => m.x > -50);

      // 5. Update Particles
      g.particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt * 1.8;
      });
      g.particles = g.particles.filter(p => p.life > 0);

      // ============================================================
      // 16-BIT / HIGH-DEF RENDER ENGINE (NAKHON PHANOM ATMOSPHERE)
      // ============================================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Background: Golden Sunset Sky Gradient ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 160);
      skyGrad.addColorStop(0, '#9a3412');   // Deep Terracotta Sky
      skyGrad.addColorStop(0.35, '#c2410c'); // Warm Orange
      skyGrad.addColorStop(0.7, '#ea580c');  // Vibrant Sunset
      skyGrad.addColorStop(1, '#fed7aa');   // Golden Horizon
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, 160);

      // Soft Sunset Sun Glow
      const sunX = canvas.width * 0.72;
      const sunGrad = ctx.createRadialGradient(sunX, 75, 5, sunX, 75, 65);
      sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      sunGrad.addColorStop(0.5, 'rgba(251, 146, 60, 0.4)');
      sunGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, 75, 65, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric Clouds Layer
      ctx.fillStyle = 'rgba(255, 237, 213, 0.25)';
      const cloudOffset = (g.distanceRun * 0.15) % (canvas.width + 120);
      ctx.beginPath();
      ctx.ellipse(canvas.width - cloudOffset, 38, 55, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(canvas.width - ((cloudOffset + 320) % (canvas.width + 120)), 58, 70, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      // --- Parallax 1: Khammouane Mountain Ridges (Laos Border) ---
      ctx.fillStyle = '#431407';
      ctx.beginPath();
      ctx.moveTo(0, 142);
      for (let mx = 0; mx <= canvas.width; mx += 25) {
        const peak = Math.sin((mx + g.distanceRun * 0.2) * 0.015) * 24 + Math.cos((mx + g.distanceRun * 0.2) * 0.035) * 12;
        ctx.lineTo(mx, 115 + peak);
      }
      ctx.lineTo(canvas.width, 150);
      ctx.lineTo(0, 150);
      ctx.closePath();
      ctx.fill();

      // --- Parallax 2: Shimmering Mekong River ---
      const riverGrad = ctx.createLinearGradient(0, 140, 0, 175);
      riverGrad.addColorStop(0, '#0369a1');
      riverGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = riverGrad;
      ctx.fillRect(0, 140, canvas.width, 35);

      // Dynamic River Water Waves & Sun Reflections
      ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
      const waveShift = (g.frame * 2.5) % 40;
      for (let wx = -40; wx < canvas.width; wx += 40) {
        ctx.fillRect(wx + waveShift, 148, 22, 2.5);
        ctx.fillRect(wx + waveShift + 12, 160, 16, 2);
      }

      // ============================================================
      // DETAILED 16-BIT NAKHON PHANOM LANDMARKS (NO TEXT LABELS)
      // ============================================================
      const loopDist = (g.distanceRun * 0.85) % 2600;

      // 1. 🛕 วัดมหาธาตุ (Wat Mahathat Pagoda / พระธาตุนคร)
      const watX = 580 - loopDist;
      if (watX > -180 && watX < canvas.width + 120) {
        ctx.save();
        // White Stucco Tiered Base
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(watX, 96, 52, 48);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(watX + 6, 102, 40, 42);

        // Intricate Golden Tiers with Isan Architectural Flourishes
        ctx.fillStyle = '#d97706'; // Base Gold Shadow
        ctx.fillRect(watX + 10, 78, 32, 18);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(watX + 12, 80, 28, 14);

        ctx.fillStyle = '#d97706';
        ctx.fillRect(watX + 15, 58, 22, 20);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(watX + 17, 60, 18, 16);

        ctx.fillStyle = '#d97706';
        ctx.fillRect(watX + 19, 38, 14, 20);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(watX + 21, 40, 10, 16);

        // Golden Chattra Spire with Glowing Tip
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(watX + 24, 16, 4, 22);
        ctx.beginPath();
        ctx.arc(watX + 26, 14, 4, 0, Math.PI * 2);
        ctx.fill();

        // Buddhist Dhammajak Flags
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(watX - 8, 112, 3, 32);
        ctx.beginPath();
        ctx.moveTo(watX - 5, 112);
        ctx.lineTo(watX + 8, 118);
        ctx.lineTo(watX - 5, 124);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 2. 🕰️ หอนาฬิกาเวียดนามอนุสรณ์ (Vietnam Memorial Clock Tower)
      const clockX = 1380 - loopDist;
      if (clockX > -160 && clockX < canvas.width + 120) {
        ctx.save();
        // Historic Red-Pink Brick Colonnade
        ctx.fillStyle = '#9f1239'; // Deep Brick
        ctx.fillRect(clockX, 64, 40, 80);
        ctx.fillStyle = '#be123c'; // Front Facet
        ctx.fillRect(clockX + 4, 68, 32, 76);
        ctx.fillStyle = '#fecdd3'; // Cream Trims
        ctx.fillRect(clockX + 2, 98, 36, 4);
        ctx.fillRect(clockX + 2, 128, 36, 4);

        // French-Indochina Stepped Mansard Roof
        ctx.fillStyle = '#881337';
        ctx.beginPath();
        ctx.moveTo(clockX - 6, 64);
        ctx.lineTo(clockX + 46, 64);
        ctx.lineTo(clockX + 34, 42);
        ctx.lineTo(clockX + 6, 42);
        ctx.closePath();
        ctx.fill();

        // Roof Finial Needle
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(clockX + 18, 30, 4, 12);

        // Circular Classic Clock Face with Hands
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(clockX + 20, 82, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Clock Hands
        ctx.beginPath();
        ctx.moveTo(clockX + 20, 82);
        ctx.lineTo(clockX + 20, 74); // Hour Hand
        ctx.moveTo(clockX + 20, 82);
        ctx.lineTo(clockX + 26, 82); // Minute Hand
        ctx.stroke();
        ctx.restore();
      }

      // 3. 🐉 พญาศรีสัตตนาคราช (7-Headed Golden Brass Naga)
      const nagaX = 2150 - loopDist;
      if (nagaX > -200 && nagaX < canvas.width + 120) {
        ctx.save();
        // Polished Marble Base
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(nagaX, 108, 64, 36);
        ctx.fillStyle = '#334155';
        ctx.fillRect(nagaX + 4, 112, 56, 32);

        // Coiled Golden Naga Body Throne
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.ellipse(nagaX + 32, 88, 26, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(nagaX + 32, 85, 22, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // 7 Hooded Golden Naga Heads Fan (Sattanakharat)
        const headColors = ['#f59e0b', '#fbbf24', '#fde047'];
        const headPositions = [
          { dx: 4, dy: 36, r: 7 },
          { dx: 12, dy: 26, r: 8 },
          { dx: 21, dy: 18, r: 9 },
          { dx: 32, dy: 10, r: 11 }, // Center King Head
          { dx: 43, dy: 18, r: 9 },
          { dx: 52, dy: 26, r: 8 },
          { dx: 60, dy: 36, r: 7 }
        ];

        headPositions.forEach((h, i) => {
          ctx.fillStyle = headColors[i % headColors.length];
          ctx.beginPath();
          ctx.arc(nagaX + h.dx, 40 + h.dy, h.r, 0, Math.PI * 2);
          ctx.fill();
          // Crown Spike
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(nagaX + h.dx - 1.5, 34 + h.dy - h.r, 3, 6);
        });

        // Graceful Spouting Stream of Water into Mekong River
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const waterSpoutOffset = (g.frame * 3) % 20;
        ctx.moveTo(nagaX + 2, 45);
        ctx.quadraticCurveTo(nagaX - 30 - waterSpoutOffset, 75, nagaX - 45 - waterSpoutOffset, 142);
        ctx.stroke();

        // Water Splash Particles
        ctx.fillStyle = '#bae6fd';
        for (let sp = 0; sp < 4; sp++) {
          ctx.fillRect(nagaX - 42 - waterSpoutOffset + (Math.random() * 8 - 4), 140 + Math.random() * 6, 3, 3);
        }
        ctx.restore();
      }

      // ============================================================
      // FOREGROUND: PROMENADE WALKING STREET & RAILINGS
      // ============================================================
      // Promenade Fence & Lamps
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 172, canvas.width, 3);
      for (let rx = 0; rx < canvas.width; rx += 45) {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(rx, 170, 5, 35);
        // Vintage Street Lamp
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(rx - 1, 166, 7, 5);
      }

      // Promenade Ground Path (High-Def Brick Texture)
      ctx.fillStyle = '#92400e';
      ctx.fillRect(0, g.groundY, canvas.width, canvas.height - g.groundY);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, g.groundY, canvas.width, 3);

      const brickMove = (g.distanceRun * 2.2) % 30;
      ctx.fillStyle = '#78350f';
      for (let bx = -30; bx < canvas.width; bx += 30) {
        ctx.fillRect(bx + brickMove, g.groundY + 12, 16, 2.5);
        ctx.fillRect(bx + brickMove + 15, g.groundY + 24, 16, 2.5);
      }

      // ============================================================
      // ANIMATED "ปีศาจพริกแกง" (LIVELY CHILI DEMONS)
      // ============================================================
      g.monsters.forEach(mon => {
        ctx.save();
        let monY = mon.y;
        if (mon.type === 'hopper') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.09 + mon.hopPhase)) * 26;
        }

        const mx = mon.x;
        const flamePulse = Math.sin(mon.flameFrame) * 2;

        // Demon Flame Aura
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.ellipse(mx + 16, monY - 18, 18 + flamePulse, 22 + flamePulse, 0, 0, Math.PI * 2);
        ctx.fill();

        // Chili Demon Body (Spicy Red Body)
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(mx + 16, monY - 4); // Chili Tip
        ctx.quadraticCurveTo(mx + 30, monY - 18, mx + 26, monY - 32);
        ctx.quadraticCurveTo(mx + 16, monY - 38, mx + 6, monY - 32);
        ctx.quadraticCurveTo(mx + 2, monY - 18, mx + 16, monY - 4);
        ctx.closePath();
        ctx.fill();

        // Green Stem / Demon Horns
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.moveTo(mx + 16, monY - 36);
        ctx.quadraticCurveTo(mx + 20, monY - 48, mx + 30, monY - 44);
        ctx.lineTo(mx + 24, monY - 36);
        ctx.closePath();
        ctx.fill();

        // Evil Glowing Eyes
        ctx.fillStyle = '#fef08a'; // Yellow eyes
        ctx.beginPath();
        ctx.arc(mx + 11, monY - 24, 3.5, 0, Math.PI * 2);
        ctx.arc(mx + 21, monY - 24, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000'; // Pupil
        ctx.fillRect(mx + 12, monY - 25, 2, 2);
        ctx.fillRect(mx + 22, monY - 25, 2, 2);

        // Wicked Grin with Fangs
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(mx + 16, monY - 16, 5, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff'; // Fangs
        ctx.fillRect(mx + 13, monY - 16, 2, 2.5);
        ctx.fillRect(mx + 17, monY - 16, 2, 2.5);

        // Bouncing Demon Feet
        const footKick = Math.sin(g.frame * 0.2) * 3;
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(mx + 8 + footKick, monY - 4, 5, 4);
        ctx.fillRect(mx + 20 - footKick, monY - 4, 5, 4);

        ctx.restore();
      });

      // ============================================================
      // COLLECTIBLE INGREDIENTS WITH SHIMMER
      // ============================================================
      g.items.forEach(item => {
        ctx.save();
        const bob = Math.sin(g.frame * 0.08 + item.bobOffset) * 4;
        const ix = item.x;
        const iy = item.y + bob;

        if (item.type === 'satow') {
          // 16-Bit Southern Twisted Satow Pod
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(ix + 12, iy + 12, 14, 10, -0.2, 0, Math.PI * 2);
          ctx.fill();
          // Satow Bean Bumps
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(ix + 6, iy + 10, 4, 0, Math.PI * 2);
          ctx.arc(ix + 15, iy + 14, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.type === 'fish') {
          // 16-Bit Grilled Mackerel (Pla-Too / Tai-Pla)
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.ellipse(ix + 12, iy + 12, 12, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0284c7'; // Tail & Fins
          ctx.beginPath();
          ctx.moveTo(ix + 22, iy + 6);
          ctx.lineTo(ix + 28, iy + 12);
          ctx.lineTo(ix + 22, iy + 18);
          ctx.closePath();
          ctx.fill();
          // Eye & Gill
          ctx.fillStyle = '#000000';
          ctx.fillRect(ix + 4, iy + 10, 2, 2);
        } else {
          // 16-Bit Bamboo Shoot (หน่อไม้)
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.moveTo(ix + 12, iy + 2);
          ctx.lineTo(ix + 22, iy + 22);
          ctx.lineTo(ix + 2, iy + 22);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(ix + 5, iy + 14, 14, 2.5);
        }
        ctx.restore();
      });

      // ============================================================
      // HIGH-DEF "น้องไตปลา" (CALICO CAT / แมวเปรอะ)
      // ============================================================
      ctx.save();
      const catX = g.catX;
      const catY = g.catY;
      const legCycle = Math.sin(g.frame * 0.25) * 5;

      ctx.translate(catX + 16, catY);
      ctx.scale(1 / g.squashStretch, g.squashStretch);
      ctx.translate(-(catX + 16), -catY);

      // Fluffy Tail with Calico Patch
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const tailWag = Math.sin(g.frame * 0.15) * 6;
      ctx.moveTo(catX + 4, catY - 14);
      ctx.quadraticCurveTo(catX - 6 + tailWag, catY - 24, catX + tailWag, catY - 30);
      ctx.stroke();

      // Main Cat Body (Cream Base)
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(catX + 18, catY - 14, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Calico Orange & Black Patches on Body
      ctx.fillStyle = '#ea580c'; // Vibrant Orange
      ctx.beginPath();
      ctx.arc(catX + 12, catY - 18, 6, 0, Math.PI * 2);
      ctx.arc(catX + 26, catY - 12, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#18181b'; // Deep Black
      ctx.beginPath();
      ctx.arc(catX + 20, catY - 18, 5, 0, Math.PI * 2);
      ctx.arc(catX + 8, catY - 10, 4, 0, Math.PI * 2);
      ctx.fill();

      // Cat Head
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(catX + 30, catY - 22, 11, 0, Math.PI * 2);
      ctx.fill();

      // Head Calico Patch
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(catX + 33, catY - 27, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(catX + 26, catY - 27, 4, 0, Math.PI * 2);
      ctx.fill();

      // Ears (Perky Triangles)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(catX + 24, catY - 30);
      ctx.lineTo(catX + 28, catY - 40);
      ctx.lineTo(catX + 32, catY - 30);
      ctx.fill();

      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.moveTo(catX + 32, catY - 30);
      ctx.lineTo(catX + 37, catY - 40);
      ctx.lineTo(catX + 40, catY - 30);
      ctx.fill();

      // Eyes & Cute Facial Features
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(catX + 35, catY - 23, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f43f5e'; // Pink Nose
      ctx.fillRect(catX + 39, catY - 21, 2.5, 2);

      // Whiskers
      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(catX + 37, catY - 20);
      ctx.lineTo(catX + 46, catY - 22);
      ctx.moveTo(catX + 37, catY - 18);
      ctx.lineTo(catX + 45, catY - 16);
      ctx.stroke();

      // Running Legs / Paws
      ctx.fillStyle = '#fef3c7';
      if (g.isGrounded) {
        ctx.fillRect(catX + 8 + legCycle, catY - 4, 5, 5);
        ctx.fillRect(catX + 24 - legCycle, catY - 4, 5, 5);
      } else {
        // Tucked paws in air
        ctx.fillRect(catX + 12, catY - 6, 5, 4);
        ctx.fillRect(catX + 22, catY - 6, 5, 4);
      }

      ctx.restore();

      // ============================================================
      // PARTICLES RENDER
      // ============================================================
      g.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, soundEnabled, highScore]);

  return (
    <div className="w-full bg-[#1b1c1e] text-white p-5 rounded-md border border-[#2d2e30] flex flex-col gap-4 shadow-inner">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-700 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
            🐱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-amber-300 uppercase tracking-wider">
                TAI-PLA RUN: นครพนม x ปักษ์ใต้
              </h3>
              <span className="text-[9px] bg-amber-900/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-700 font-mono font-bold">
                HIGH-DEF ARCADE
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans">
              กระโดดหลบปีศาจพริกแกง & เก็บสะตอสด ปลาทูย่าง ริมแม่น้ำโขงนครพนม
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs self-end sm:self-auto">
          <div className="bg-zinc-800 px-3 py-1 rounded border border-zinc-700 text-amber-300">
            <span className="text-[9px] text-zinc-400 block">SCORE</span>
            <span className="font-bold">{score}</span>
          </div>
          <div className="bg-zinc-800 px-3 py-1 rounded border border-zinc-700 text-emerald-400">
            <span className="text-[9px] text-zinc-400 block">BEST</span>
            <span className="font-bold">{highScore}</span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 cursor-pointer"
            title={soundEnabled ? 'ปิดเสียง Arcade' : 'เปิดเสียง Arcade'}
          >
            {soundEnabled ? <Volume2 size={15} className="text-amber-400" /> : <VolumeX size={15} className="text-zinc-500" />}
          </button>
        </div>
      </div>

      {/* Playable Canvas Container */}
      <div 
        onClick={jump}
        className="relative w-full aspect-[16/8] max-w-[540px] mx-auto bg-[#0a0a0c] rounded-md overflow-hidden border-2 border-zinc-700 cursor-pointer select-none shadow-[inset_0_2px_12px_rgba(0,0,0,0.9)]"
      >
        <canvas 
          ref={canvasRef} 
          width={540} 
          height={240} 
          className="w-full h-full block"
        />

        {/* Start Overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
            <span className="text-3xl animate-bounce">🐱</span>
            <h4 className="font-mono text-sm font-bold text-amber-300 uppercase tracking-widest">
              น้องไตปลา แมวเปรอะผจญภัย
            </h4>
            <p className="text-xs text-zinc-300 font-sans max-w-xs leading-relaxed">
              แตะหน้าจอ หรือกด Spacebar เพื่อกระโดดหลบ <strong>ปีศาจพริกแกง 🌶️</strong> และเก็บวัตถุดิบ
            </p>
            <button
              onClick={startGame}
              className="mt-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono text-xs font-bold uppercase rounded cursor-pointer shadow-md active:scale-95 transition-all"
            >
              เริ่มวิ่ง (START GAME)
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
            <span className="text-2xl">🌶️🔥</span>
            <h4 className="font-mono text-base font-bold text-red-400 uppercase tracking-widest">
              โดนปีศาจพริกเผ็ดร้อน! (GAME OVER)
            </h4>
            <p className="text-xs text-zinc-300 font-mono">
              SCORE: <strong className="text-amber-300">{score} PTS</strong> (ปลา {potIngredients.fish}, สะตอ {potIngredients.satow}, หน่อไม้ {potIngredients.bamboo})
            </p>
            <button
              onClick={startGame}
              className="mt-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold uppercase rounded cursor-pointer shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>วิ่งใหม่อีกครั้ง</span>
            </button>
          </div>
        )}
      </div>

      {/* Ingredients Collection Pot Meter */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded text-xs font-mono">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span>🥘 หม้อแกงไตปลาสะสม:</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-sky-300">🐟 ปลาทู: {potIngredients.fish}</span>
          <span className="text-emerald-400">🌿 สะตอ: {potIngredients.satow}</span>
          <span className="text-yellow-300">🎋 หน่อไม้: {potIngredients.bamboo}</span>
        </div>
      </div>
    </div>
  );
}

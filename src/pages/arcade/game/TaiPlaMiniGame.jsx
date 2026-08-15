/* Hallmark · component: TaiPlaMiniGame · genre: 16-bit / High-Def Arcade Runner · theme: Atelier (Dieter Rams + Thai Modern OKLCH) */
import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Flame, Heart, Maximize2, Minimize2, Coins, ArrowRight, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

export default function TaiPlaMiniGame({ session, onClaimScore, onRequireLogin, onCoinEarned }) {
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'playing' | 'gameover'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('tai_pla_high_score') || '0', 10);
  });
  const [potIngredients, setPotIngredients] = useState({ fish: 0, satow: 0, bamboo: 0 });
  const [completedPots, setCompletedPots] = useState(0);
  const [earnedXhaus, setEarnedXhaus] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Smooth Physics & Game Loop State
  const gameRef = useRef({
    catX: 75,
    catY: 200,
    catVy: 0,
    isGrounded: true,
    jumpTimer: 0,
    score: 0,
    distanceRun: 0,
    items: [],
    monsters: [],
    particles: [],
    floatingTexts: [],
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
      } else if (type === 'coin') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.30);
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
    setCompletedPots(0);
    setEarnedXhaus(0);
    gameRef.current = {
      catX: 75,
      catY: 200,
      catVy: 0,
      isGrounded: true,
      jumpTimer: 0,
      score: 0,
      distanceRun: 0,
      items: [],
      monsters: [],
      particles: [],
      floatingTexts: [],
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
          color: 'rgba(234, 88, 12, 0.4)',
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
      } else if (e.code === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isFullscreen]);

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
      g.catVy += 34 * dt;
      g.catY += g.catVy;

      // Smooth recover from stretch/squash
      g.squashStretch += (1.0 - g.squashStretch) * 0.15;

      if (g.catY >= g.groundY) {
        if (!g.isGrounded) {
          g.squashStretch = 0.75; // Squash on landing
          for (let i = 0; i < 4; i++) {
            g.particles.push({
              x: g.catX + 15 + (Math.random() * 14 - 7),
              y: g.groundY + 2,
              vx: (Math.random() - 0.5) * 2.5,
              vy: -Math.random() * 1.5,
              radius: Math.random() * 2.5 + 1.5,
              color: 'rgba(234, 88, 12, 0.3)',
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

        // Collision detection with Cat
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

          // Update ingredients
          setPotIngredients(prev => {
            const next = { ...prev, [item.type]: prev[item.type] + 1 };
            // Check if full pot is completed (1 fish + 1 satow + 1 bamboo)
            if (next.fish >= 1 && next.satow >= 1 && next.bamboo >= 1) {
              next.fish -= 1;
              next.satow -= 1;
              next.bamboo -= 1;
              setCompletedPots(cp => cp + 1);
              setEarnedXhaus(ex => {
                const updated = +(ex + 0.10).toFixed(2);
                if (onCoinEarned) onCoinEarned(0.10);
                return updated;
              });
              playArcadeSound('coin');

              // Pop floating reward text
              g.floatingTexts.push({
                x: g.catX + 20,
                y: g.catY - 40,
                text: '+0.10 XH 🥘',
                color: '#d97706',
                life: 1.2
              });
            } else {
              playArcadeSound('collect');
            }
            return next;
          });

          // Sparkles particles
          for (let p = 0; p < 8; p++) {
            g.particles.push({
              x: item.x + 12,
              y: item.y + bob + 12,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              radius: Math.random() * 3 + 2,
              color: item.type === 'satow' ? '#16a34a' : (item.type === 'fish' ? '#0284c7' : '#ca8a04'),
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

        let currentMonY = mon.y;
        if (mon.type === 'hopper') {
          const hop = Math.abs(Math.sin(g.frame * 0.09 + mon.hopPhase)) * 26;
          currentMonY = mon.y - hop;
        }

        // Spawn chili ember particles
        if (Math.random() > 0.65) {
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

      // 5. Update Particles & Floating Text
      g.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt * 1.8;
      });
      g.particles = g.particles.filter(p => p.life > 0);

      g.floatingTexts.forEach(ft => {
        ft.y -= 25 * dt;
        ft.life -= dt * 1.0;
      });
      g.floatingTexts = g.floatingTexts.filter(ft => ft.life > 0);

      // ============================================================
      // 16-BIT / HIGH-DEF RENDER ENGINE (NAKHON PHANOM ATMOSPHERE)
      // ============================================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Background: Clean Sunset Sky Gradient ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 160);
      skyGrad.addColorStop(0, '#c2410c');   // Warm Terracotta Orange
      skyGrad.addColorStop(0.4, '#ea580c'); // Vibrant Amber
      skyGrad.addColorStop(0.8, '#fb923c'); // Sunset Glow
      skyGrad.addColorStop(1, '#ffedd5');   // Light Sand Horizon
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, 160);

      // Soft Golden Sun Glow
      const sunX = canvas.width * 0.72;
      const sunGrad = ctx.createRadialGradient(sunX, 75, 5, sunX, 75, 65);
      sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      sunGrad.addColorStop(0.5, 'rgba(251, 146, 60, 0.4)');
      sunGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, 75, 65, 0, Math.PI * 2);
      ctx.fill();

      // Clouds Layer
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

      // River Water Reflections
      ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
      const waveShift = (g.frame * 2.5) % 40;
      for (let wx = -40; wx < canvas.width; wx += 40) {
        ctx.fillRect(wx + waveShift, 148, 22, 2.5);
        ctx.fillRect(wx + waveShift + 12, 160, 16, 2);
      }

      // ============================================================
      // 16-BIT LANDMARKS (NO TEXT LABELS)
      // ============================================================
      const loopDist = (g.distanceRun * 0.85) % 2600;

      // 1. 🛕 วัดมหาธาตุ (Wat Mahathat Pagoda / พระธาตุนคร)
      const watX = 580 - loopDist;
      if (watX > -180 && watX < canvas.width + 120) {
        ctx.save();
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(watX, 96, 52, 48);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(watX + 6, 102, 40, 42);

        ctx.fillStyle = '#d97706';
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

        // Golden Chattra Spire
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(watX + 24, 16, 4, 22);
        ctx.beginPath();
        ctx.arc(watX + 26, 14, 4, 0, Math.PI * 2);
        ctx.fill();

        // Buddhist Flag
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
        ctx.fillStyle = '#9f1239';
        ctx.fillRect(clockX, 64, 40, 80);
        ctx.fillStyle = '#be123c';
        ctx.fillRect(clockX + 4, 68, 32, 76);
        ctx.fillStyle = '#fecdd3';
        ctx.fillRect(clockX + 2, 98, 36, 4);
        ctx.fillRect(clockX + 2, 128, 36, 4);

        // Stepped Roof
        ctx.fillStyle = '#881337';
        ctx.beginPath();
        ctx.moveTo(clockX - 6, 64);
        ctx.lineTo(clockX + 46, 64);
        ctx.lineTo(clockX + 34, 42);
        ctx.lineTo(clockX + 6, 42);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(clockX + 18, 30, 4, 12);

        // Circular Clock Face
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(clockX + 20, 82, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(clockX + 20, 82);
        ctx.lineTo(clockX + 20, 74);
        ctx.moveTo(clockX + 20, 82);
        ctx.lineTo(clockX + 26, 82);
        ctx.stroke();
        ctx.restore();
      }

      // 3. 🐉 พญาศรีสัตตนาคราช (7-Headed Golden Naga)
      const nagaX = 2150 - loopDist;
      if (nagaX > -200 && nagaX < canvas.width + 120) {
        ctx.save();
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(nagaX, 108, 64, 36);
        ctx.fillStyle = '#334155';
        ctx.fillRect(nagaX + 4, 112, 56, 32);

        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.ellipse(nagaX + 32, 88, 26, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.ellipse(nagaX + 32, 85, 22, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // 7 Heads Fan
        const headColors = ['#f59e0b', '#fbbf24', '#fde047'];
        const headPositions = [
          { dx: 4, dy: 36, r: 7 },
          { dx: 12, dy: 26, r: 8 },
          { dx: 21, dy: 18, r: 9 },
          { dx: 32, dy: 10, r: 11 },
          { dx: 43, dy: 18, r: 9 },
          { dx: 52, dy: 26, r: 8 },
          { dx: 60, dy: 36, r: 7 }
        ];

        headPositions.forEach((h, i) => {
          ctx.fillStyle = headColors[i % headColors.length];
          ctx.beginPath();
          ctx.arc(nagaX + h.dx, 40 + h.dy, h.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(nagaX + h.dx - 1.5, 34 + h.dy - h.r, 3, 6);
        });

        // Water Spout
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const waterSpoutOffset = (g.frame * 3) % 20;
        ctx.moveTo(nagaX + 2, 45);
        ctx.quadraticCurveTo(nagaX - 30 - waterSpoutOffset, 75, nagaX - 45 - waterSpoutOffset, 142);
        ctx.stroke();
        ctx.restore();
      }

      // ============================================================
      // FOREGROUND: PROMENADE WALKING STREET
      // ============================================================
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 172, canvas.width, 3);
      for (let rx = 0; rx < canvas.width; rx += 45) {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(rx, 170, 5, 35);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(rx - 1, 166, 7, 5);
      }

      // Ground Brick Path
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
      // ANIMATED "ปีศาจพริกแกง" (CHILI DEMONS)
      // ============================================================
      g.monsters.forEach(mon => {
        ctx.save();
        let monY = mon.y;
        if (mon.type === 'hopper') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.09 + mon.hopPhase)) * 26;
        }

        const mx = mon.x;
        const flamePulse = Math.sin(mon.flameFrame) * 2;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.ellipse(mx + 16, monY - 18, 18 + flamePulse, 22 + flamePulse, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(mx + 16, monY - 4);
        ctx.quadraticCurveTo(mx + 30, monY - 18, mx + 26, monY - 32);
        ctx.quadraticCurveTo(mx + 16, monY - 38, mx + 6, monY - 32);
        ctx.quadraticCurveTo(mx + 2, monY - 18, mx + 16, monY - 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.moveTo(mx + 16, monY - 36);
        ctx.quadraticCurveTo(mx + 20, monY - 48, mx + 30, monY - 44);
        ctx.lineTo(mx + 24, monY - 36);
        ctx.closePath();
        ctx.fill();

        // Evil Eyes & Grin
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(mx + 11, monY - 24, 3.5, 0, Math.PI * 2);
        ctx.arc(mx + 21, monY - 24, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.fillRect(mx + 12, monY - 25, 2, 2);
        ctx.fillRect(mx + 22, monY - 25, 2, 2);

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(mx + 16, monY - 16, 5, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx + 13, monY - 16, 2, 2.5);
        ctx.fillRect(mx + 17, monY - 16, 2, 2.5);
        ctx.restore();
      });

      // ============================================================
      // COLLECTIBLE INGREDIENTS
      // ============================================================
      g.items.forEach(item => {
        ctx.save();
        const bob = Math.sin(g.frame * 0.08 + item.bobOffset) * 4;
        const ix = item.x;
        const iy = item.y + bob;

        if (item.type === 'satow') {
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(ix + 12, iy + 12, 14, 10, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(ix + 6, iy + 10, 4, 0, Math.PI * 2);
          ctx.arc(ix + 15, iy + 14, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.type === 'fish') {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.ellipse(ix + 12, iy + 12, 12, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(ix + 22, iy + 6);
          ctx.lineTo(ix + 28, iy + 12);
          ctx.lineTo(ix + 22, iy + 18);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.fillRect(ix + 4, iy + 10, 2, 2);
        } else {
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
      // "น้องไตปลา" (CALICO CAT / แมวเปรอะ)
      // ============================================================
      ctx.save();
      const catX = g.catX;
      const catY = g.catY;
      const legCycle = Math.sin(g.frame * 0.25) * 5;

      ctx.translate(catX + 16, catY);
      ctx.scale(1 / g.squashStretch, g.squashStretch);
      ctx.translate(-(catX + 16), -catY);

      // Tail
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const tailWag = Math.sin(g.frame * 0.15) * 6;
      ctx.moveTo(catX + 4, catY - 14);
      ctx.quadraticCurveTo(catX - 6 + tailWag, catY - 24, catX + tailWag, catY - 30);
      ctx.stroke();

      // Body
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(catX + 18, catY - 14, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Calico Patches
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(catX + 12, catY - 18, 6, 0, Math.PI * 2);
      ctx.arc(catX + 26, catY - 12, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(catX + 20, catY - 18, 5, 0, Math.PI * 2);
      ctx.arc(catX + 8, catY - 10, 4, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(catX + 30, catY - 22, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(catX + 33, catY - 27, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(catX + 26, catY - 27, 4, 0, Math.PI * 2);
      ctx.fill();

      // Ears
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

      // Face
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(catX + 35, catY - 23, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(catX + 39, catY - 21, 2.5, 2);

      // Paws
      ctx.fillStyle = '#fef3c7';
      if (g.isGrounded) {
        ctx.fillRect(catX + 8 + legCycle, catY - 4, 5, 5);
        ctx.fillRect(catX + 24 - legCycle, catY - 4, 5, 5);
      } else {
        ctx.fillRect(catX + 12, catY - 6, 5, 4);
        ctx.fillRect(catX + 22, catY - 6, 5, 4);
      }
      ctx.restore();

      // ============================================================
      // PARTICLES & FLOATING TEXTS
      // ============================================================
      g.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        ctx.fill();
      });

      g.floatingTexts.forEach(ft => {
        ctx.font = 'bold 13px Space Mono, monospace';
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, soundEnabled, highScore]);

  const handleClaim = () => {
    if (onClaimScore) {
      onClaimScore(score);
    }
  };

  return (
    <div className={`${
      isFullscreen 
        ? 'fixed inset-0 z-[9999] bg-[var(--color-paper)] p-4 sm:p-8 flex flex-col justify-center items-center overflow-auto' 
        : 'w-full bg-white rounded-lg border border-[var(--color-rule)] p-5 sm:p-6 shadow-sm flex flex-col gap-5'
    }`}>
      
      {/* Clean Dieter Rams Control Bar */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-rule)] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] flex items-center justify-center font-bold text-base border border-[oklch(52%_0.16_28)]/20">
            🐱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                TAI-PLA RUN // นครพนม x ปักษ์ใต้
              </h3>
              <span className="text-[9px] bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] px-2 py-0.5 rounded font-mono font-bold border border-[oklch(52%_0.16_28)]/20">
                P2E XHAUS
              </span>
            </div>
            <p className="text-[11px] text-[oklch(45%_0.010_28)] font-sans">
              กระโดดหลบปีศาจพริกแกง & เก็บสะตอสด ปลาทูย่าง สะสมเหรียญ xhaus
            </p>
          </div>
        </div>

        {/* Status Score & LCD Coins Deck */}
        <div className="flex items-center gap-2.5 font-mono text-xs self-end sm:self-auto">
          {/* Earned xhaus Coin display */}
          <div className="bg-[#e2e7df] border border-[#cfd6cb] px-3 py-1.5 rounded-[4px] flex items-center gap-1.5 text-[#2a3026] shadow-2xs">
            <Coins size={14} className="text-amber-600" />
            <span className="font-bold">+{earnedXhaus.toFixed(2)} XH</span>
          </div>

          <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] px-3 py-1.5 rounded-[4px] text-[oklch(18%_0.012_28)]">
            <span className="text-[9px] text-[oklch(45%_0.010_28)] block">SCORE</span>
            <span className="font-bold">{score}</span>
          </div>

          <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] px-3 py-1.5 rounded-[4px] text-emerald-700">
            <span className="text-[9px] text-[oklch(45%_0.010_28)] block">BEST</span>
            <span className="font-bold">{highScore}</span>
          </div>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] rounded-[4px] border border-[var(--color-rule)] cursor-pointer text-[oklch(18%_0.012_28)]"
            title={soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} className="text-neutral-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] rounded-[4px] border border-[var(--color-rule)] cursor-pointer text-[oklch(18%_0.012_28)] flex items-center gap-1 text-[10px] font-bold"
            title={isFullscreen ? 'ออกจากเต็มจอ' : 'เล่นเต็มจอ'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Clean Frame Canvas Container */}
      <div 
        onClick={jump}
        className={`relative w-full ${isFullscreen ? 'max-w-4xl aspect-[16/8]' : 'max-w-[560px] aspect-[16/8]'} mx-auto bg-[var(--color-paper-2)] rounded-md overflow-hidden border border-[var(--color-rule)] cursor-pointer select-none shadow-sm transition-all`}
      >
        <canvas 
          ref={canvasRef} 
          width={560} 
          height={240} 
          className="w-full h-full block"
        />

        {/* Start Overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2.5 text-center p-5">
            <span className="text-4xl animate-bounce">🐱</span>
            <h4 className="font-mono text-base font-bold text-[oklch(18%_0.012_28)] uppercase tracking-widest">
              น้องไตปลา แมวเปรอะผจญภัย
            </h4>
            <p className="text-xs text-[oklch(35%_0.010_28)] font-sans max-w-sm leading-relaxed">
              แตะหน้าจอ หรือกด Spacebar เพื่อกระโดดหลบ <strong>ปีศาจพริกแกง 🌶️</strong> และเก็บวัตถุดิบครบ 3 อย่างเพื่อรับเหรียญ <strong>xhaus</strong>
            </p>
            <button
              onClick={startGame}
              className="btn-action mt-2 px-6 py-2.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white font-mono text-xs font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all"
            >
              เริ่มวิ่ง (START RUN)
            </button>
          </div>
        )}

        {/* Game Over Overlay (Clean White Box) */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-[3px] flex flex-col items-center justify-center gap-3 text-center p-6 animate-[fadeIn_0.15s_ease-out]">
            <span className="text-3xl">🌶️💥</span>
            <div>
              <h4 className="font-mono text-base font-bold text-red-600 uppercase tracking-widest mb-1">
                โดนปีศาจพริกแกง! (GAME OVER)
              </h4>
              <p className="text-xs text-[oklch(35%_0.010_28)] font-mono">
                SCORE: <strong className="text-[oklch(52%_0.16_28)]">{score} PTS</strong> // ปรุงสำเร็จ {completedPots} หม้อ
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
                className="btn-action px-5 py-2.5 bg-[oklch(18%_0.012_28)] hover:bg-black text-white font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>วิ่งใหม่อีกครั้ง</span>
              </button>

              {score > 0 && (
                <button
                  onClick={handleClaim}
                  className="btn-action px-5 py-2.5 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Trophy size={13} />
                  <span>บันทึกแต้มลงบอร์ด</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Clean Dieter Rams Ingredients Dashboard */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-3.5 rounded-[4px] text-xs font-mono gap-2">
        <div className="flex items-center gap-2 text-[oklch(35%_0.010_28)]">
          <span className="font-bold">🥘 สะสมวัตถุดิบ (เก็บครบ 3 ชนิด = +0.10 XH):</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-bold">
          <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            🐟 ปลาทู: {potIngredients.fish}/1
          </span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            🌿 สะตอ: {potIngredients.satow}/1
          </span>
          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            🎋 หน่อไม้: {potIngredients.bamboo}/1
          </span>
        </div>
      </div>
    </div>
  );
}

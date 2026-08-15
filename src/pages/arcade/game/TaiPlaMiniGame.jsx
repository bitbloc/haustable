/* Hallmark · component: TaiPlaMiniGame · genre: Retro Chunky Pixel Arcade · theme: Cute Nakhon Phanom (Wat Mahathat, Vietnam Clock Tower, Phaya Naga, Thai Fruit Cart) x Cute Calico Tai-Pla */
import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Maximize2, Minimize2, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';

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

  // Smooth Game Physics & Engine References
  const gameRef = useRef({
    catX: 75,
    catY: 185,
    catVy: 0,
    isGrounded: true,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    score: 0,
    distanceRun: 0,
    items: [],
    monsters: [],
    particles: [],
    floatingTexts: [],
    lastSpawn: 0,
    groundY: 185,
    speed: 4.0,
    frame: 0,
    scaleX: 1.0,
    scaleY: 1.0
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
      } else if (type === 'collect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.04); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.08); // D6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'pot_complete') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.18); // C6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.30);
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
    setGameState('playing');
    setScore(0);
    setPotIngredients({ fish: 0, satow: 0, bamboo: 0 });
    setCompletedPots(0);
    setEarnedXhaus(0);
    gameRef.current = {
      catX: 75,
      catY: 185,
      catVy: 0,
      isGrounded: true,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      score: 0,
      distanceRun: 0,
      items: [],
      monsters: [],
      particles: [],
      floatingTexts: [],
      lastSpawn: Date.now(),
      groundY: 185,
      speed: 4.0,
      frame: 0,
      scaleX: 1.0,
      scaleY: 1.0
    };
  };

  // Ultra-Smooth Jump with Coyote Time & Jump Buffering
  const handleJumpPress = () => {
    if (gameState !== 'playing') {
      if (gameState === 'idle' || gameState === 'gameover') {
        startGame();
      }
      return;
    }

    const g = gameRef.current;
    if (g.isGrounded || g.coyoteTimer > 0) {
      g.catVy = -11.0; // Responsive jump velocity
      g.isGrounded = false;
      g.coyoteTimer = 0;
      g.scaleX = 0.85;
      g.scaleY = 1.25; // Squash-Stretch launch
      playRetroSound('jump');

      // Sparkle / Dust particles on jump
      for (let i = 0; i < 4; i++) {
        g.particles.push({
          x: g.catX + 14 + (Math.random() * 10 - 5),
          y: g.groundY + 2,
          vx: (Math.random() - 0.7) * 2,
          vy: -Math.random() * 2,
          size: Math.random() * 4 + 2,
          color: '#fbbf24',
          life: 0.7
        });
      }
    } else {
      // Buffer jump for next 160ms
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
  }, [gameState, isFullscreen]);

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

      // 1. Platformer Physics (Weighty Arc with Fall Gravity Multiplier)
      if (g.isGrounded) {
        g.coyoteTimer = 0.08;
      } else {
        g.coyoteTimer = Math.max(0, g.coyoteTimer - dt);
      }

      g.jumpBufferTimer = Math.max(0, g.jumpBufferTimer - dt);

      // Downward gravity is slightly stronger for snappy, fluid platforming feel
      const gravity = g.catVy > 0 ? 28 : 23;
      g.catVy += gravity * dt;
      g.catY += g.catVy;

      // Spring Interpolation for Squash & Stretch
      g.scaleX += (1.0 - g.scaleX) * 0.2;
      g.scaleY += (1.0 - g.scaleY) * 0.2;

      // Ground Collision
      if (g.catY >= g.groundY) {
        if (!g.isGrounded) {
          g.scaleX = 1.25; // Landing squash
          g.scaleY = 0.75;
          // Check buffered jump on landing
          if (g.jumpBufferTimer > 0) {
            g.catVy = -11.0;
            g.jumpBufferTimer = 0;
            g.isGrounded = false;
            g.scaleX = 0.85;
            g.scaleY = 1.25;
            playRetroSound('jump');
          }
        }
        if (g.isGrounded || g.catVy >= 0) {
          g.catY = g.groundY;
          g.catVy = 0;
          g.isGrounded = true;
        }
      }

      // Smooth Acceleration
      g.speed = Math.min(7.0, 4.0 + g.score * 0.025);

      // 2. Spawn Items & Mischievous Chili Demons
      const nowMs = Date.now();
      if (nowMs - g.lastSpawn > 1300 / (g.speed / 4.0)) {
        g.lastSpawn = nowMs;
        const isMonster = Math.random() > 0.45;

        if (isMonster) {
          g.monsters.push({
            x: canvas.width + 30,
            y: g.groundY,
            type: Math.random() > 0.5 ? 'hop_chili' : 'run_chili',
            width: 24,
            height: 28,
            animPhase: Math.random() * Math.PI * 2
          });
        } else {
          const r = Math.random();
          const foodType = r > 0.6 ? 'satow' : (r > 0.3 ? 'fish' : 'bamboo');
          g.items.push({
            x: canvas.width + 20,
            y: g.groundY - (Math.random() > 0.5 ? 42 : 14),
            type: foodType,
            bobOffset: Math.random() * Math.PI * 2,
            size: 22
          });
        }
      }

      // 3. Update Collectible Items (With Magnetic Pull)
      g.items.forEach((item, idx) => {
        item.x -= g.speed;
        const bob = Math.sin(g.frame * 0.09 + item.bobOffset) * 3.5;
        const currentItemY = item.y + bob;

        // Juicy Magnetic Pull toward Cat
        const distCatX = g.catX + 14 - (item.x + 11);
        const distCatY = g.catY - 14 - (currentItemY + 11);
        const dist = Math.hypot(distCatX, distCatY);
        if (dist < 42) {
          item.x += distCatX * 0.2;
          item.y += distCatY * 0.2;
        }

        // Precise AABB Collision Check with Cat
        const catBox = { left: g.catX + 4, right: g.catX + 28, top: g.catY - 24, bottom: g.catY };
        const itemBox = { left: item.x, right: item.x + item.size, top: currentItemY, bottom: currentItemY + item.size };

        if (
          catBox.right > itemBox.left &&
          catBox.left < itemBox.right &&
          catBox.bottom > itemBox.top &&
          catBox.top < itemBox.bottom
        ) {
          g.items.splice(idx, 1);
          const pts = item.type === 'satow' ? 20 : (item.type === 'fish' ? 10 : 15);
          g.score += pts;
          setScore(g.score);

          setPotIngredients(prev => {
            const next = { ...prev, [item.type]: prev[item.type] + 1 };
            // Complete Pot (1 fish + 1 satow + 1 bamboo)
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
              playRetroSound('pot_complete');

              g.floatingTexts.push({
                x: g.catX + 16,
                y: g.catY - 32,
                text: '+0.10 XH 🥘',
                color: '#ea580c',
                life: 1.2
              });
            } else {
              playRetroSound('collect');
            }
            return next;
          });

          // Sparkle particles
          for (let p = 0; p < 5; p++) {
            g.particles.push({
              x: item.x + 11,
              y: currentItemY + 11,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              size: Math.random() * 4 + 2,
              color: item.type === 'satow' ? '#22c55e' : (item.type === 'fish' ? '#38bdf8' : '#f59e0b'),
              life: 0.8
            });
          }
        }
      });
      g.items = g.items.filter(i => i.x > -40);

      // 4. Update Chili Demons ("ปีศาจพริก") with Precise AABB Hitboxes
      for (let idx = 0; idx < g.monsters.length; idx++) {
        const mon = g.monsters[idx];
        mon.x -= g.speed;

        let monY = mon.y;
        if (mon.type === 'hop_chili') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.09 + mon.animPhase)) * 22;
        }

        // Forgiving, player-friendly AABB collision box
        const catBox = { left: g.catX + 8, right: g.catX + 24, top: g.catY - 20, bottom: g.catY - 2 };
        const monBox = { left: mon.x + 5, right: mon.x + mon.width - 5, top: monY - mon.height + 4, bottom: monY };

        if (
          catBox.right > monBox.left &&
          catBox.left < monBox.right &&
          catBox.bottom > monBox.top &&
          catBox.top < monBox.bottom
        ) {
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

      // 5. Update Particles & Floating Texts
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
      // 🎨 RETRO CHUNKY PIXEL ART RENDERING (PROPERLY GROUND-ANCHORED)
      // ============================================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Warm Cream Sky (Ref 1 & 3 Palette)
      ctx.fillStyle = '#fef8e7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cute Smiling Sun (Ref 3)
      const sunX = canvas.width - 65;
      const sunY = 38;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(sunX - 16, sunY - 4, 32, 8);
      ctx.fillRect(sunX - 4, sunY - 16, 8, 32);
      ctx.fillRect(sunX - 12, sunY - 12, 24, 24);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(sunX - 10, sunY - 10, 20, 20);
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(sunX - 5, sunY - 3, 2, 4);
      ctx.fillRect(sunX + 3, sunY - 3, 2, 4);
      ctx.fillRect(sunX - 1, sunY + 2, 2, 2);

      // Cute Blushing Pixel Clouds (Ref 3)
      const drawCuteCloud = (cx, cy) => {
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cx, cy + 6, 44, 16);
        ctx.fillRect(cx + 8, cy, 28, 24);
        ctx.fillRect(cx + 14, cy - 4, 16, 30);

        ctx.fillStyle = '#93c5fd';
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
      ctx.fillStyle = '#ebd5b3';
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
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 146, canvas.width, 14);
      ctx.fillStyle = '#bae6fd';
      const waveShift = (g.frame * 2) % 28;
      for (let wx = -28; wx < canvas.width; wx += 28) {
        ctx.fillRect(wx + waveShift, 150, 14, 2);
      }

      // ============================================================
      // CONTINUOUS SCENERY & LANDMARKS (FIRMLY SEATED ON GROUND y=185)
      // ============================================================
      const totalLoop = 1800;
      const getSceneX = (baseX) => {
        const scrolled = (baseX - (g.distanceRun * 0.85)) % totalLoop;
        return ((scrolled % totalLoop) + totalLoop) % totalLoop - 100;
      };

      // 1. 🛕 วัดมหาธาตุ (Seated on Ground y=185)
      const watX = getSceneX(200);
      if (watX > -120 && watX < canvas.width + 80) {
        const gy = g.groundY;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(watX, gy - 46, 44, 46); // Main Body
        ctx.fillRect(watX + 6, gy - 66, 32, 20); // Mid Tier
        ctx.fillRect(watX + 12, gy - 86, 20, 20); // Top Tier
        ctx.fillRect(watX + 18, gy - 110, 8, 24); // Spire

        ctx.fillStyle = '#ffffff'; // White Stupa Base
        ctx.fillRect(watX + 3, gy - 43, 38, 43);
        ctx.fillStyle = '#f59e0b'; // Gold Tier 1
        ctx.fillRect(watX + 9, gy - 63, 26, 17);
        ctx.fillStyle = '#fbbf24'; // Gold Tier 2
        ctx.fillRect(watX + 15, gy - 83, 14, 17);
        ctx.fillStyle = '#fde047'; // Gold Spire
        ctx.fillRect(watX + 20, gy - 108, 4, 22);
      }

      // 2. 🍉 รถเข็นผลไม้ไทย & เก้าอี้แดง (Ref 2 Inspiration - Seated on Ground y=185)
      const cartX = getSceneX(650);
      if (cartX > -120 && cartX < canvas.width + 80) {
        const gy = g.groundY;
        // Fruit Cart Body
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cartX, gy - 44, 44, 34);
        ctx.fillStyle = '#0284c7'; // Blue frame
        ctx.fillRect(cartX + 2, gy - 42, 40, 30);

        // Fruits inside glass case
        ctx.fillStyle = '#ef4444'; // Watermelon
        ctx.fillRect(cartX + 5, gy - 38, 9, 9);
        ctx.fillStyle = '#22c55e'; // Guava
        ctx.fillRect(cartX + 16, gy - 38, 9, 9);
        ctx.fillStyle = '#facc15'; // Mango
        ctx.fillRect(cartX + 27, gy - 38, 9, 9);

        // Wheel on ground
        ctx.fillStyle = '#1f1d24';
        ctx.beginPath();
        ctx.arc(cartX + 14, gy - 8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(cartX + 14, gy - 8, 4, 0, Math.PI * 2);
        ctx.fill();

        // Red Plastic Chair (Ref 2)
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cartX + 46, gy - 24, 18, 24);
        ctx.fillStyle = '#dc2626'; // Red
        ctx.fillRect(cartX + 48, gy - 22, 14, 22);
        // Salt Jar on chair
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(cartX + 52, gy - 32, 6, 8);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(cartX + 51, gy - 34, 8, 3);
      }

      // 3. 🕰️ หอนาฬิกาเวียดนามอนุสรณ์ (Seated on Ground y=185)
      const clockX = getSceneX(1100);
      if (clockX > -120 && clockX < canvas.width + 80) {
        const gy = g.groundY;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(clockX, gy - 80, 38, 80); // Tower
        ctx.fillRect(clockX - 4, gy - 92, 46, 12); // Roof base
        ctx.fillRect(clockX + 5, gy - 106, 28, 14); // Roof top

        ctx.fillStyle = '#e11d48'; // Pink-Red Brick
        ctx.fillRect(clockX + 3, gy - 77, 32, 77);
        ctx.fillStyle = '#881337'; // Dark Roof
        ctx.fillRect(clockX - 2, gy - 90, 42, 8);
        ctx.fillRect(clockX + 7, gy - 104, 24, 12);

        // Clock Face
        ctx.fillStyle = '#1f1d24';
        ctx.beginPath();
        ctx.arc(clockX + 19, gy - 60, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(clockX + 19, gy - 60, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(clockX + 18, gy - 65, 2, 6);
        ctx.fillRect(clockX + 18, gy - 60, 5, 2);
      }

      // 4. 🐉 พญาศรีสัตตนาคราช 7 เศียร (Seated on Ground y=185)
      const nagaX = getSceneX(1550);
      if (nagaX > -120 && nagaX < canvas.width + 80) {
        const gy = g.groundY;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(nagaX, gy - 36, 52, 36); // Base Pedestal
        ctx.fillStyle = '#334155';
        ctx.fillRect(nagaX + 3, gy - 33, 46, 33);

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(nagaX + 8, gy - 66, 34, 32); // Naga Body
        ctx.fillStyle = '#eab308'; // Gold
        ctx.fillRect(nagaX + 11, gy - 63, 28, 26);

        // 7 Heads Fan
        const headColors = ['#fde047', '#facc15', '#eab308'];
        const heads = [4, 11, 18, 25, 32, 39, 46];
        heads.forEach((hx, i) => {
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(nagaX + hx - 3, gy - 86 - (i === 3 ? 10 : (i === 2 || i === 4 ? 5 : 0)), 8, 18);
          ctx.fillStyle = headColors[i % 3];
          ctx.fillRect(nagaX + hx - 1, gy - 84 - (i === 3 ? 10 : (i === 2 || i === 4 ? 5 : 0)), 4, 14);
        });

        // Water Spout Droplets
        ctx.fillStyle = '#38bdf8';
        const waterSpurt = (g.frame * 3) % 20;
        ctx.fillRect(nagaX - 8 - waterSpurt, gy - 80 + waterSpurt * 1.5, 4, 4);
      }

      // ============================================================
      // TREES & CHECKERBOARD GROUND (ALL SEATED ON y=185)
      // ============================================================
      const drawCuteTree = (tx, isPink = false) => {
        const gy = g.groundY;
        // Tree Trunk
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(tx + 8, gy - 30, 10, 30);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(tx + 10, gy - 28, 6, 28);

        // Fluffy Canopy
        ctx.fillStyle = '#1f1d24';
        ctx.beginPath();
        ctx.arc(tx + 13, gy - 46, 20, 0, Math.PI * 2);
        ctx.arc(tx + 2, gy - 38, 12, 0, Math.PI * 2);
        ctx.arc(tx + 24, gy - 38, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isPink ? '#f472b6' : '#22c55e';
        ctx.beginPath();
        ctx.arc(tx + 13, gy - 46, 17, 0, Math.PI * 2);
        ctx.arc(tx + 2, gy - 38, 9, 0, Math.PI * 2);
        ctx.arc(tx + 24, gy - 38, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isPink ? '#fbcfe8' : '#86efac';
        ctx.fillRect(tx + 8, gy - 56, 8, 5);
      };

      const tree1X = getSceneX(420);
      const tree2X = getSceneX(880);
      const tree3X = getSceneX(1340);
      if (tree1X > -60 && tree1X < canvas.width + 40) drawCuteTree(tree1X, false);
      if (tree2X > -60 && tree2X < canvas.width + 40) drawCuteTree(tree2X, true);
      if (tree3X > -60 && tree3X < canvas.width + 40) drawCuteTree(tree3X, false);

      // Solid Ground Line & Checkered Grass
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(0, g.groundY, canvas.width, 3);
      ctx.fillStyle = '#65a30d'; // Grass Green
      ctx.fillRect(0, g.groundY + 3, canvas.width, canvas.height - (g.groundY + 3));

      // Checkerboard Pattern
      ctx.fillStyle = '#4d7c0f';
      const tileShift = (g.distanceRun * 2.4) % 24;
      for (let tx = -24; tx < canvas.width; tx += 24) {
        ctx.fillRect(tx + tileShift, g.groundY + 3, 12, 10);
        ctx.fillRect(tx + tileShift + 12, g.groundY + 13, 12, 18);
      }

      // Little Flowers along Grass
      const drawFlower = (fx, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(fx + 2, g.groundY - 6, 4, 4);
        ctx.fillRect(fx - 2, g.groundY - 4, 4, 4);
        ctx.fillRect(fx + 6, g.groundY - 4, 4, 4);
        ctx.fillRect(fx + 2, g.groundY - 2, 4, 4);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(fx + 2, g.groundY - 4, 4, 4);
      };
      drawFlower(50 - (g.distanceRun * 2.4) % 220, '#f43f5e');
      drawFlower(140 - (g.distanceRun * 2.4) % 220, '#38bdf8');
      drawFlower(210 - (g.distanceRun * 2.4) % 220, '#e879f9');

      // ============================================================
      // 🌶️ CUTE MISCHIEVOUS "ปีศาจพริก" (REF 1 SPRITE STYLE)
      // ============================================================
      g.monsters.forEach(mon => {
        ctx.save();
        let monY = mon.y;
        if (mon.type === 'hop_chili') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.09 + mon.animPhase)) * 22;
        }

        const mx = mon.x;

        // Shadow on ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(mx + 12, mon.y + 2, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bold Outline
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(mx + 3, monY - 24, 18, 22);
        ctx.fillRect(mx + 6, monY - 28, 12, 26);
        ctx.fillRect(mx + 1, monY - 16, 22, 12);

        // Spicy Red Body
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(mx + 5, monY - 22, 14, 18);
        ctx.fillRect(mx + 8, monY - 26, 8, 22);
        ctx.fillRect(mx + 3, monY - 14, 18, 8);

        // Green Stem Horn
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(mx + 10, monY - 30, 4, 4);
        ctx.fillRect(mx + 12, monY - 33, 3, 3);

        // Cute Big Dot Eyes & Cheeky Smile (Ref 1 Style)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx + 6, monY - 16, 4, 4);
        ctx.fillRect(mx + 14, monY - 16, 4, 4);
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(mx + 8, monY - 15, 2, 3);
        ctx.fillRect(mx + 16, monY - 15, 2, 3);

        // Animated Feet
        const walkCycle = Math.sin(g.frame * 0.25) * 3;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(mx + 5 + walkCycle, monY - 3, 4, 3);
        ctx.fillRect(mx + 15 - walkCycle, monY - 3, 4, 3);

        ctx.restore();
      });

      // ============================================================
      // 🐟 🌿 🎋 CUTE PIXEL COLLECTIBLE INGREDIENTS
      // ============================================================
      g.items.forEach(item => {
        ctx.save();
        const bob = Math.sin(g.frame * 0.09 + item.bobOffset) * 3.5;
        const ix = item.x;
        const iy = item.y + bob;

        if (item.type === 'satow') {
          // Twisted Satow Pod
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 2, iy + 2, 18, 16);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(ix + 4, iy + 4, 14, 12);
          ctx.fillStyle = '#86efac';
          ctx.fillRect(ix + 6, iy + 6, 4, 4);
          ctx.fillRect(ix + 12, iy + 9, 4, 4);
        } else if (item.type === 'fish') {
          // Grilled Mackerel (Pla-Too)
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 2, iy + 4, 18, 12);
          ctx.fillRect(ix + 18, iy + 2, 4, 16);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(ix + 4, iy + 6, 14, 8);
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 6, iy + 8, 2, 2);
        } else {
          // Bamboo Shoot
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
      // 🐱 "น้องไตปลา" (CUTE CALICO CAT - PROPERLY SEATED ON GROUND)
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

      // Apply Spring Squash & Stretch
      ctx.translate(catX + 16, catY);
      ctx.scale(g.scaleX, g.scaleY);
      ctx.translate(-(catX + 16), -catY);

      // Tail (Bouncing tail)
      ctx.fillStyle = '#1f1d24';
      const tailWag = Math.sin(g.frame * 0.2) * 3;
      ctx.fillRect(catX + 2 + tailWag, catY - 14, 4, 4);
      ctx.fillRect(catX - 2 + tailWag, catY - 18, 4, 6);
      ctx.fillRect(catX + 2 + tailWag, catY - 22, 4, 4);

      // Main Cat Body Outline
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(catX + 4, catY - 22, 24, 18);
      ctx.fillRect(catX + 8, catY - 26, 16, 22);

      // Body Fill (Cream Base)
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(catX + 6, catY - 20, 20, 14);

      // Calico Orange & Black Patches
      ctx.fillStyle = '#f97316';
      ctx.fillRect(catX + 8, catY - 20, 8, 8);
      ctx.fillRect(catX + 18, catY - 14, 6, 6);

      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(catX + 18, catY - 20, 6, 6);
      ctx.fillRect(catX + 8, catY - 12, 6, 4);

      // Head: Cream Face with Cute Ears
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(catX + 18, catY - 28, 16, 16);
      ctx.fillRect(catX + 20, catY - 34, 4, 6);
      ctx.fillRect(catX + 28, catY - 34, 4, 6);

      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(catX + 20, catY - 26, 12, 12);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(catX + 21, catY - 32, 2, 4);
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(catX + 29, catY - 32, 2, 4);

      // Eyes & Pink Cheeks
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(catX + 28, catY - 22, 3, 4);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(catX + 31, catY - 19, 2, 2);
      ctx.fillRect(catX + 24, catY - 18, 3, 2);

      // Animated Running Paws
      ctx.fillStyle = '#1f1d24';
      if (g.isGrounded) {
        if (legRun === 0) {
          ctx.fillRect(catX + 8, catY - 3, 4, 4);
          ctx.fillRect(catX + 20, catY - 3, 4, 4);
        } else if (legRun === 1) {
          ctx.fillRect(catX + 12, catY - 3, 4, 4);
          ctx.fillRect(catX + 16, catY - 3, 4, 4);
        } else if (legRun === 2) {
          ctx.fillRect(catX + 6, catY - 3, 4, 4);
          ctx.fillRect(catX + 22, catY - 3, 4, 4);
        } else {
          ctx.fillRect(catX + 10, catY - 3, 4, 4);
          ctx.fillRect(catX + 18, catY - 3, 4, 4);
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
        ctx.font = 'bold 14px Space Mono, monospace';
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
  }, [gameState, soundEnabled, highScore]);

  const handleClaim = () => {
    if (onClaimScore) {
      onClaimScore(score);
    }
  };

  return (
    <div className={`${
      isFullscreen 
        ? 'fixed inset-0 z-[9999] bg-[#fbf8eb] p-4 sm:p-8 flex flex-col justify-center items-center overflow-auto' 
        : 'w-full bg-white rounded-lg border border-[var(--color-rule)] p-5 sm:p-6 shadow-sm flex flex-col gap-5'
    }`}>
      
      {/* Clean Control Bar */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-rule)] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#fef3c7] text-[#f97316] flex items-center justify-center font-bold text-base border border-[#fde68a]">
            🐱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                TAI-PLA RUN // นครพนม x ปักษ์ใต้
              </h3>
              <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-bold border border-amber-300">
                P2E XHAUS
              </span>
            </div>
            <p className="text-[11px] text-[oklch(45%_0.010_28)] font-sans">
              กระโดดหลบปีศาจพริกแกง & สะสมวัตถุดิบปรุงแกงไตปลา รับเหรียญ xhaus
            </p>
          </div>
        </div>

        {/* Status Score & LCD Coins Deck */}
        <div className="flex items-center gap-2.5 font-mono text-xs self-end sm:self-auto">
          {/* Earned xhaus Coin display */}
          <div className="bg-[#fef9c3] border border-[#fde047] px-3 py-1.5 rounded-[4px] flex items-center gap-1.5 text-amber-950 shadow-2xs">
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

        {/* Start Overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-[#fef8e7]/85 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2.5 text-center p-5">
            <span className="text-4xl animate-bounce">🐱</span>
            <h4 className="font-mono text-base font-bold text-[#1f1d24] uppercase tracking-widest">
              น้องไตปลา แมวเปรอะผจญภัย
            </h4>
            <p className="text-xs text-[#4b5563] font-sans max-w-sm leading-relaxed">
              แตะหน้าจอ หรือกด Spacebar เพื่อกระโดดหลบ <strong>ปีศาจพริกแกง 🌶️</strong> และเก็บวัตถุดิบครบ 3 อย่างเพื่อรับเหรียญ <strong>xhaus</strong>
            </p>
            <button
              onClick={startGame}
              className="btn-action mt-2 px-6 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-mono text-xs font-bold uppercase rounded-[4px] cursor-pointer shadow-sm active:scale-95 transition-all"
            >
              เริ่มวิ่ง (START RUN)
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-[#fef8e7]/90 backdrop-blur-[3px] flex flex-col items-center justify-center gap-3 text-center p-6 animate-[fadeIn_0.15s_ease-out]">
            <span className="text-3xl">🌶️💥</span>
            <div>
              <h4 className="font-mono text-base font-bold text-red-600 uppercase tracking-widest mb-1">
                โดนปีศาจพริกแกง! (GAME OVER)
              </h4>
              <p className="text-xs text-[#374151] font-mono">
                SCORE: <strong className="text-[#ea580c]">{score} PTS</strong> // ปรุงสำเร็จ {completedPots} หม้อ
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

      {/* Clean Ingredients Dashboard */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-[#fef8e7] border border-[#fde68a] p-3.5 rounded-[4px] text-xs font-mono gap-2">
        <div className="flex items-center gap-2 text-[#451a03]">
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

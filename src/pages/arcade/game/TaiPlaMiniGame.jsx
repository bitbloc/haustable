/* Hallmark · component: TaiPlaMiniGame · genre: Retro Chunky Pixel Arcade · theme: Cute Nakhon Phanom (Wat Mahathat, Vietnam Clock Tower, Phaya Naga, Thai Fruit Cart) x Cute Calico Tai-Pla */
import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Maximize2, Minimize2, Coins, ArrowRight, CheckCircle2 } from 'lucide-react';
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
    catX: 80,
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
    groundY: 188,
    speed: 3.8,
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
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'collect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.05); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.10); // D6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'pot_complete') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.28);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.3);
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
      catX: 80,
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
      groundY: 188,
      speed: 3.8,
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
      g.catVy = -12.5; // Smooth launch velocity
      g.isGrounded = false;
      g.coyoteTimer = 0;
      g.scaleX = 0.8;
      g.scaleY = 1.3; // Squash-Stretch launch
      playRetroSound('jump');

      // Sparkle / Dust particles on jump
      for (let i = 0; i < 4; i++) {
        g.particles.push({
          x: g.catX + 16 + (Math.random() * 12 - 6),
          y: g.groundY + 4,
          vx: (Math.random() - 0.7) * 2,
          vy: -Math.random() * 2,
          size: Math.random() * 4 + 2,
          color: '#fbbf24',
          life: 0.8
        });
      }
    } else {
      // Buffer jump for next 150ms
      g.jumpBufferTimer = 0.15;
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
    ctx.imageSmoothingEnabled = false; // Pixel-perfect rendering
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const dt = Math.min(0.04, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const g = gameRef.current;
      g.frame++;
      g.distanceRun += g.speed * 1.0;

      // 1. Smooth Platformer Physics
      if (g.isGrounded) {
        g.coyoteTimer = 0.08;
      } else {
        g.coyoteTimer = Math.max(0, g.coyoteTimer - dt);
      }

      g.jumpBufferTimer = Math.max(0, g.jumpBufferTimer - dt);

      // Smooth Gravity Curve
      g.catVy += 32 * dt;
      g.catY += g.catVy;

      // Spring Interpolation for Squash & Stretch
      g.scaleX += (1.0 - g.scaleX) * 0.18;
      g.scaleY += (1.0 - g.scaleY) * 0.18;

      // Ground Collision
      if (g.catY >= g.groundY) {
        if (!g.isGrounded) {
          g.scaleX = 1.28; // Landing squash
          g.scaleY = 0.72;
          // Check buffered jump on landing
          if (g.jumpBufferTimer > 0) {
            g.catVy = -12.5;
            g.jumpBufferTimer = 0;
            g.isGrounded = false;
            g.scaleX = 0.8;
            g.scaleY = 1.3;
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
      g.speed = Math.min(7.2, 3.8 + g.score * 0.03);

      // 2. Spawn Items & Mischievous Chili Demons
      const nowMs = Date.now();
      if (nowMs - g.lastSpawn > 1280 / (g.speed / 3.8)) {
        g.lastSpawn = nowMs;
        const isMonster = Math.random() > 0.44;

        if (isMonster) {
          g.monsters.push({
            x: canvas.width + 30,
            y: g.groundY,
            type: Math.random() > 0.5 ? 'hop_chili' : 'run_chili',
            width: 28,
            height: 32,
            animPhase: Math.random() * Math.PI * 2
          });
        } else {
          const r = Math.random();
          const foodType = r > 0.6 ? 'satow' : (r > 0.3 ? 'fish' : 'bamboo');
          g.items.push({
            x: canvas.width + 20,
            y: g.groundY - (Math.random() > 0.5 ? 48 : 16),
            type: foodType,
            bobOffset: Math.random() * Math.PI * 2,
            size: 24
          });
        }
      }

      // 3. Update Collectible Items
      g.items.forEach((item, idx) => {
        item.x -= g.speed;
        const bob = Math.sin(g.frame * 0.09 + item.bobOffset) * 4;

        // Collision Check with Cat (x=80, w=32, h=28)
        const catBox = { x: g.catX + 4, y: g.catY - 24, w: 32, h: 26 };
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
                x: g.catX + 18,
                y: g.catY - 36,
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
          for (let p = 0; p < 6; p++) {
            g.particles.push({
              x: item.x + 12,
              y: item.y + bob + 12,
              vx: (Math.random() - 0.5) * 3.5,
              vy: (Math.random() - 0.5) * 3.5,
              size: Math.random() * 4 + 2,
              color: item.type === 'satow' ? '#22c55e' : (item.type === 'fish' ? '#38bdf8' : '#f59e0b'),
              life: 0.9
            });
          }
        }
      });
      g.items = g.items.filter(i => i.x > -40);

      // 4. Update Chili Demons ("ปีศาจพริก")
      for (let idx = 0; idx < g.monsters.length; idx++) {
        const mon = g.monsters[idx];
        mon.x -= g.speed;

        let monY = mon.y;
        if (mon.type === 'hop_chili') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.1 + mon.animPhase)) * 24;
        }

        // Collision Check with Cat
        const catBox = { x: g.catX + 6, y: g.catY - 22, w: 26, h: 22 };
        if (
          catBox.x < mon.x + mon.width - 4 &&
          catBox.x + catBox.w > mon.x + 4 &&
          catBox.y < monY &&
          catBox.y + catBox.h > monY - mon.height + 4
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
        p.life -= dt * 1.6;
      });
      g.particles = g.particles.filter(p => p.life > 0);

      g.floatingTexts.forEach(ft => {
        ft.y -= 22 * dt;
        ft.life -= dt * 1.0;
      });
      g.floatingTexts = g.floatingTexts.filter(ft => ft.life > 0);

      // ============================================================
      // 🎨 RETRO CHUNKY PIXEL ART RENDERING (MATCHING USER'S REFS)
      // ============================================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Warm Cream / Ivory Sky (Like Ref 1 & 3)
      ctx.fillStyle = '#fef8e7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cute Smiling Sun (Ref 3 Inspiration)
      const sunX = canvas.width - 70;
      const sunY = 40;
      // Sun Rays
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(sunX - 18, sunY - 4, 36, 8);
      ctx.fillRect(sunX - 4, sunY - 18, 8, 36);
      ctx.fillRect(sunX - 14, sunY - 14, 28, 28);
      // Sun Center Body
      ctx.fillStyle = '#fde047';
      ctx.fillRect(sunX - 12, sunY - 12, 24, 24);
      // Sun Cute Face
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(sunX - 6, sunY - 4, 3, 4); // Eye L
      ctx.fillRect(sunX + 3, sunY - 4, 3, 4); // Eye R
      ctx.fillRect(sunX - 1, sunY + 2, 2, 2); // Mouth

      // Cute Blushing Pixel Clouds (Ref 3 Inspiration)
      const cloudShift = (g.distanceRun * 0.2) % (canvas.width + 120);
      const drawCuteCloud = (cx, cy) => {
        ctx.fillStyle = '#1f1d24'; // Bold Outline
        ctx.fillRect(cx, cy + 6, 48, 18);
        ctx.fillRect(cx + 8, cy, 32, 26);
        ctx.fillRect(cx + 16, cy - 4, 18, 32);

        ctx.fillStyle = '#93c5fd'; // Soft Blue Fill
        ctx.fillRect(cx + 2, cy + 8, 44, 14);
        ctx.fillRect(cx + 10, cy + 2, 28, 22);
        ctx.fillRect(cx + 18, cy - 2, 14, 26);

        // Eyes & Blush
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cx + 14, cy + 10, 3, 3);
        ctx.fillRect(cx + 30, cy + 10, 3, 3);
        ctx.fillStyle = '#f43f5e'; // Pink Blush
        ctx.fillRect(cx + 10, cy + 14, 4, 2);
        ctx.fillRect(cx + 34, cy + 14, 4, 2);
      };
      drawCuteCloud(canvas.width - cloudShift, 28);
      drawCuteCloud(canvas.width - ((cloudShift + 300) % (canvas.width + 120)), 50);

      // ============================================================
      // NAKHON PHANOM LANDMARKS & THAI STREET SCENERY (REFS 2 & 3)
      // ============================================================
      const loopDist = (g.distanceRun * 0.9) % 2600;

      // 1. 🛕 วัดมหาธาตุ (Wat Mahathat Pagoda - Chunky Pixel Art)
      const watX = 560 - loopDist;
      if (watX > -160 && watX < canvas.width + 100) {
        // Base Wall
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(watX, 98, 48, 46);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(watX + 3, 101, 42, 40);

        // Golden Multi-Tier Pagoda
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(watX + 8, 80, 32, 20);
        ctx.fillRect(watX + 14, 60, 20, 22);
        ctx.fillRect(watX + 18, 40, 12, 22);
        ctx.fillRect(watX + 22, 16, 4, 26); // Spire

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(watX + 11, 83, 26, 14);
        ctx.fillRect(watX + 17, 63, 14, 16);
        ctx.fillRect(watX + 20, 43, 8, 16);
        ctx.fillStyle = '#fde047'; // Gold Highlight
        ctx.fillRect(watX + 23, 18, 2, 22);
      }

      // 2. 🍉 รถเข็นผลไม้ไทย & เก้าอี้แดง (Thai Fruit Cart - Ref 2 Inspiration)
      const cartX = 1100 - loopDist;
      if (cartX > -160 && cartX < canvas.width + 100) {
        // Glass Fruit Cart Body
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cartX, 108, 46, 36);
        ctx.fillStyle = '#0284c7'; // Blue Metal Frame
        ctx.fillRect(cartX + 2, 110, 42, 32);

        // Fruit Stacks inside Cart (Watermelon, Mango, Pineapple)
        ctx.fillStyle = '#ef4444'; // Red Watermelon
        ctx.fillRect(cartX + 6, 114, 10, 10);
        ctx.fillStyle = '#22c55e'; // Green Guava
        ctx.fillRect(cartX + 18, 114, 10, 10);
        ctx.fillStyle = '#facc15'; // Yellow Mango
        ctx.fillRect(cartX + 30, 114, 10, 10);

        // Cart Wheel
        ctx.fillStyle = '#1f1d24';
        ctx.beginPath();
        ctx.arc(cartX + 14, 148, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(cartX + 14, 148, 5, 0, Math.PI * 2);
        ctx.fill();

        // Red Plastic Stool with Chili-Salt Jar (Ref 2 Inspiration)
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(cartX + 48, 126, 18, 22);
        ctx.fillStyle = '#dc2626'; // Red Plastic Chair
        ctx.fillRect(cartX + 50, 128, 14, 18);
        ctx.fillStyle = '#fef08a'; // Chili-Salt Glass Jar
        ctx.fillRect(cartX + 54, 118, 6, 8);
        ctx.fillStyle = '#f43f5e'; // Pink Jar Lid
        ctx.fillRect(cartX + 53, 116, 8, 3);
      }

      // 3. 🕰️ หอนาฬิกาเวียดนามอนุสรณ์ (Vietnam Clock Tower - Chunky Pixel Art)
      const clockX = 1680 - loopDist;
      if (clockX > -160 && clockX < canvas.width + 100) {
        // Red Brick Tower Body
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(clockX, 68, 38, 76);
        ctx.fillStyle = '#e11d48'; // Pink-Red Brick
        ctx.fillRect(clockX + 3, 71, 32, 70);

        // Stepped Roof
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(clockX - 4, 58, 46, 12);
        ctx.fillRect(clockX + 6, 44, 26, 16);
        ctx.fillStyle = '#881337';
        ctx.fillRect(clockX - 2, 60, 42, 8);
        ctx.fillRect(clockX + 8, 46, 22, 12);

        // Clock Face with Cute Clock Hands
        ctx.fillStyle = '#1f1d24';
        ctx.beginPath();
        ctx.arc(clockX + 19, 86, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(clockX + 19, 86, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(clockX + 18, 81, 2, 6); // Hand
        ctx.fillRect(clockX + 18, 86, 5, 2);
      }

      // 4. 🐉 พญาศรีสัตตนาคราช (7-Headed Golden Naga - Chunky Pixel Art)
      const nagaX = 2250 - loopDist;
      if (nagaX > -180 && nagaX < canvas.width + 100) {
        // Dark Base Pedestal
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(nagaX, 110, 56, 34);
        ctx.fillStyle = '#334155';
        ctx.fillRect(nagaX + 3, 113, 50, 28);

        // Golden Naga Body Coils
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(nagaX + 8, 74, 38, 38);
        ctx.fillStyle = '#eab308'; // Gold
        ctx.fillRect(nagaX + 11, 77, 32, 32);

        // 7 Heads Fan
        const headColors = ['#fde047', '#facc15', '#eab308'];
        const heads = [6, 13, 20, 28, 36, 43, 50];
        heads.forEach((hx, i) => {
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(nagaX + hx - 4, 46 - (i === 3 ? 12 : (i === 2 || i === 4 ? 6 : 0)), 8, 16);
          ctx.fillStyle = headColors[i % 3];
          ctx.fillRect(nagaX + hx - 2, 48 - (i === 3 ? 12 : (i === 2 || i === 4 ? 6 : 0)), 4, 12);
        });

        // Water Spout Droplets
        ctx.fillStyle = '#38bdf8';
        const waterSpurt = (g.frame * 3) % 24;
        ctx.fillRect(nagaX - 8 - waterSpurt, 52 + waterSpurt * 1.5, 4, 4);
        ctx.fillRect(nagaX - 16 - waterSpurt, 66 + waterSpurt * 1.8, 5, 4);
      }

      // ============================================================
      // FOREGROUND: FLUFFY TREES & CHECKERBOARD GROUND (REF 3)
      // ============================================================
      // Cute Fluffy Trees along Path
      const drawCuteTree = (tx, isPink = false) => {
        // Tree Trunk
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(tx + 8, 116, 12, 30);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(tx + 10, 118, 8, 26);

        // Fluffy Canopy (Green or Sakura Pink like Ref 3)
        ctx.fillStyle = '#1f1d24'; // Bold Outline
        ctx.beginPath();
        ctx.arc(tx + 14, 98, 22, 0, Math.PI * 2);
        ctx.arc(tx + 2, 106, 14, 0, Math.PI * 2);
        ctx.arc(tx + 26, 106, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isPink ? '#f472b6' : '#22c55e'; // Base Canopy
        ctx.beginPath();
        ctx.arc(tx + 14, 98, 19, 0, Math.PI * 2);
        ctx.arc(tx + 2, 106, 11, 0, Math.PI * 2);
        ctx.arc(tx + 26, 106, 11, 0, Math.PI * 2);
        ctx.fill();

        // Canopy Highlights
        ctx.fillStyle = isPink ? '#fbcfe8' : '#86efac';
        ctx.fillRect(tx + 8, 86, 10, 6);
      };

      const tree1X = 260 - (g.distanceRun * 0.9) % 900;
      const tree2X = 720 - (g.distanceRun * 0.9) % 900;
      if (tree1X > -80 && tree1X < canvas.width + 50) drawCuteTree(tree1X, false);
      if (tree2X > -80 && tree2X < canvas.width + 50) drawCuteTree(tree2X, true);

      // Charming Checkerboard Grass Ground (Ref 3 Inspiration)
      ctx.fillStyle = '#1f1d24'; // Border line
      ctx.fillRect(0, g.groundY + 2, canvas.width, 3);
      ctx.fillStyle = '#65a30d'; // Grass Green
      ctx.fillRect(0, g.groundY + 5, canvas.width, canvas.height - (g.groundY + 5));

      // Checkerboard Pattern
      ctx.fillStyle = '#4d7c0f';
      const tileShift = (g.distanceRun * 2.4) % 24;
      for (let tx = -24; tx < canvas.width; tx += 24) {
        ctx.fillRect(tx + tileShift, g.groundY + 5, 12, 10);
        ctx.fillRect(tx + tileShift + 12, g.groundY + 15, 12, 15);
      }

      // Little Flowers along Grass (Ref 3 Inspiration)
      const drawFlower = (fx, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(fx + 2, g.groundY - 6, 4, 4);
        ctx.fillRect(fx - 2, g.groundY - 4, 4, 4);
        ctx.fillRect(fx + 6, g.groundY - 4, 4, 4);
        ctx.fillRect(fx + 2, g.groundY - 2, 4, 4);
        ctx.fillStyle = '#fde047'; // Flower Center
        ctx.fillRect(fx + 2, g.groundY - 4, 4, 4);
      };
      drawFlower(60 - (g.distanceRun * 2.4) % 200, '#f43f5e');
      drawFlower(160 - (g.distanceRun * 2.4) % 200, '#38bdf8');

      // ============================================================
      // 🌶️ CUTE MISCHIEVOUS "ปีศาจพริก" (REF 1 SPRITE INSPIRATION)
      // ============================================================
      g.monsters.forEach(mon => {
        ctx.save();
        let monY = mon.y;
        if (mon.type === 'hop_chili') {
          monY = mon.y - Math.abs(Math.sin(g.frame * 0.1 + mon.animPhase)) * 24;
        }

        const mx = mon.x;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(mx + 14, mon.y + 2, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bold Outline (Ref 1 Style)
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(mx + 4, monY - 26, 20, 24);
        ctx.fillRect(mx + 8, monY - 32, 12, 30);
        ctx.fillRect(mx + 2, monY - 18, 24, 14);

        // Spicy Red Body
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(mx + 6, monY - 24, 16, 20);
        ctx.fillRect(mx + 10, monY - 28, 8, 24);
        ctx.fillRect(mx + 4, monY - 16, 20, 10);

        // Green Stem Horn
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(mx + 12, monY - 34, 4, 6);
        ctx.fillRect(mx + 14, monY - 36, 4, 3);

        // Cute Angry/Cheeky Face (Ref 1 Style)
        ctx.fillStyle = '#ffffff'; // Big White Eyes
        ctx.fillRect(mx + 8, monY - 18, 4, 5);
        ctx.fillRect(mx + 16, monY - 18, 4, 5);
        ctx.fillStyle = '#1f1d24'; // Pupils
        ctx.fillRect(mx + 10, monY - 17, 2, 3);
        ctx.fillRect(mx + 18, monY - 17, 2, 3);

        // Little Feet (Animated Walking)
        const walkCycle = Math.sin(g.frame * 0.25) * 3;
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(mx + 7 + walkCycle, monY - 3, 4, 4);
        ctx.fillRect(mx + 17 - walkCycle, monY - 3, 4, 4);

        ctx.restore();
      });

      // ============================================================
      // 🐟 🌿 🎋 CUTE PIXEL COLLECTIBLE INGREDIENTS
      // ============================================================
      g.items.forEach(item => {
        ctx.save();
        const bob = Math.sin(g.frame * 0.09 + item.bobOffset) * 4;
        const ix = item.x;
        const iy = item.y + bob;

        if (item.type === 'satow') {
          // Cute Twisted Satow Pod
          ctx.fillStyle = '#1f1d24'; // Bold Outline
          ctx.fillRect(ix + 2, iy + 2, 18, 16);
          ctx.fillStyle = '#22c55e'; // Green Pod
          ctx.fillRect(ix + 4, iy + 4, 14, 12);
          ctx.fillStyle = '#86efac'; // Bean bumps
          ctx.fillRect(ix + 6, iy + 6, 4, 4);
          ctx.fillRect(ix + 12, iy + 9, 4, 4);
        } else if (item.type === 'fish') {
          // Cute Grilled Mackerel (Pla-Too)
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 2, iy + 4, 18, 12);
          ctx.fillRect(ix + 18, iy + 2, 4, 16); // Tail
          ctx.fillStyle = '#38bdf8'; // Blue Fish
          ctx.fillRect(ix + 4, iy + 6, 14, 8);
          ctx.fillStyle = '#1f1d24'; // Cute Dot Eye
          ctx.fillRect(ix + 6, iy + 8, 2, 2);
        } else {
          // Cute Bamboo Shoot (หน่อไม้)
          ctx.fillStyle = '#1f1d24';
          ctx.fillRect(ix + 4, iy + 2, 14, 18);
          ctx.fillStyle = '#fde047'; // Yellow Shoot
          ctx.fillRect(ix + 6, iy + 4, 10, 14);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(ix + 6, iy + 10, 10, 2);
        }
        ctx.restore();
      });

      // ============================================================
      // 🐱 "น้องไตปลา" (CUTE CHUBBY CALICO CAT - REFS 1 & 3 STYLE)
      // ============================================================
      ctx.save();
      const catX = g.catX;
      const catY = g.catY;
      const legRun = Math.floor((g.frame / 5) % 4);

      // Cute Oval Ground Shadow
      const shadowScale = Math.max(0.4, 1.0 - (g.groundY - catY) / 120);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.ellipse(catX + 16, g.groundY + 4, 14 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Apply Spring Squash & Stretch
      ctx.translate(catX + 16, catY);
      ctx.scale(g.scaleX, g.scaleY);
      ctx.translate(-(catX + 16), -catY);

      // Tail (Bouncing tail like Ref 1 cat)
      ctx.fillStyle = '#1f1d24';
      const tailWag = Math.sin(g.frame * 0.2) * 4;
      ctx.fillRect(catX + 2 + tailWag, catY - 14, 4, 4);
      ctx.fillRect(catX - 2 + tailWag, catY - 18, 4, 6);
      ctx.fillRect(catX + 2 + tailWag, catY - 22, 4, 4);

      // Main Cat Body: Bold Dark Outline (Ref 1 Style)
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(catX + 4, catY - 22, 24, 18);
      ctx.fillRect(catX + 8, catY - 26, 16, 22);

      // Body Fill: Cream Base
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(catX + 6, catY - 20, 20, 14);

      // Calico Orange & Black Patches (แมวเปรอะ)
      ctx.fillStyle = '#f97316'; // Vibrant Orange Patch
      ctx.fillRect(catX + 8, catY - 20, 8, 8);
      ctx.fillRect(catX + 18, catY - 14, 6, 6);

      ctx.fillStyle = '#1f1d24'; // Black Patch
      ctx.fillRect(catX + 18, catY - 20, 6, 6);
      ctx.fillRect(catX + 8, catY - 12, 6, 4);

      // Head: Cream Face with Cute Ears
      ctx.fillStyle = '#1f1d24'; // Head Outline
      ctx.fillRect(catX + 18, catY - 28, 16, 16);
      ctx.fillRect(catX + 20, catY - 34, 4, 6); // Ear L
      ctx.fillRect(catX + 28, catY - 34, 4, 6); // Ear R

      ctx.fillStyle = '#fef3c7'; // Head Base
      ctx.fillRect(catX + 20, catY - 26, 12, 12);
      ctx.fillStyle = '#f97316'; // Ear Tip Orange
      ctx.fillRect(catX + 21, catY - 32, 2, 4);
      ctx.fillStyle = '#1f1d24'; // Ear Tip Black
      ctx.fillRect(catX + 29, catY - 32, 2, 4);

      // Cute Big Dot Eyes & Blushing Pink Cheeks (Ref 1 & 3 Style)
      ctx.fillStyle = '#1f1d24'; // Eyes
      ctx.fillRect(catX + 28, catY - 22, 3, 4);
      ctx.fillStyle = '#f43f5e'; // Pink Nose & Blush
      ctx.fillRect(catX + 31, catY - 19, 2, 2);
      ctx.fillRect(catX + 24, catY - 18, 3, 2);

      // Cute Animated Running Paws
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
        // Tucked paws in air
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
        ctx.fillStyle = '#1f1d24'; // Text Shadow
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

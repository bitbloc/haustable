/* Hallmark · component: TaiPlaMiniGame · genre: 8-bit retro arcade · theme: Nakhon Phanom (Wat Mahathat, Clock Tower, Naga) x Southern Thai (Tai-Pla) */
import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Flame, Heart, Compass, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function TaiPlaMiniGame() {
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'playing' | 'gameover'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('tai_pla_high_score') || '0', 10);
  });
  const [currentLandmark, setCurrentLandmark] = useState('ถนนคนเดินริมโขง');
  const [potIngredients, setPotIngredients] = useState({ fish: 0, satow: 0, bamboo: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Internal Game State Refs
  const gameRef = useRef({
    catY: 180,
    catVy: 0,
    isGrounded: true,
    score: 0,
    distanceRun: 0,
    items: [],
    obstacles: [],
    lastSpawn: 0,
    groundY: 195,
    speed: 3.8,
    frame: 0
  });

  // 8-Bit Chiptune Sound Synthesizer
  const play8BitSound = (type) => {
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
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (type === 'coin') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.06); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'landmark') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.42);
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      }
    } catch (e) {}
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setCurrentLandmark('ถนนคนเดินริมโขง');
    setPotIngredients({ fish: 0, satow: 0, bamboo: 0 });
    gameRef.current = {
      catY: 180,
      catVy: 0,
      isGrounded: true,
      score: 0,
      distanceRun: 0,
      items: [],
      obstacles: [],
      lastSpawn: Date.now(),
      groundY: 195,
      speed: 3.8,
      frame: 0
    };
  };

  const jump = () => {
    if (gameState !== 'playing') {
      if (gameState === 'idle' || gameState === 'gameover') {
        startGame();
      }
      return;
    }

    if (gameRef.current.isGrounded) {
      gameRef.current.catVy = -11.5;
      gameRef.current.isGrounded = false;
      play8BitSound('jump');
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

  // Main 8-Bit Pixel Game Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; // Crisp retro pixel art
    let lastTime = Date.now();

    const loop = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const g = gameRef.current;
      g.frame++;
      g.distanceRun += g.speed * 0.8;

      // Update Current Landmark based on distance run
      const loopDistance = g.distanceRun % 2400;
      let landmarkNow = 'ถนนคนเดินริมโขง';
      if (loopDistance >= 400 && loopDistance < 1000) {
        landmarkNow = '🛕 วัดมหาธาตุ (พระธาตุนคร)';
      } else if (loopDistance >= 1000 && loopDistance < 1700) {
        landmarkNow = '🕰️ หอนาฬิกาเวียดนามอนุสรณ์';
      } else if (loopDistance >= 1700 && loopDistance < 2350) {
        landmarkNow = '🐉 พญาศรีสัตตนาคราช ริมโขง';
      }

      if (landmarkNow !== currentLandmark) {
        setCurrentLandmark(landmarkNow);
        if (landmarkNow.includes('วัดมหาธาตุ') || landmarkNow.includes('หอนาฬิกา') || landmarkNow.includes('พญาศรี')) {
          play8BitSound('landmark');
        }
      }

      // Physics: Gravity & Jump
      g.catVy += 30 * dt;
      g.catY += g.catVy;
      if (g.catY >= g.groundY) {
        g.catY = g.groundY;
        g.catVy = 0;
        g.isGrounded = true;
      }

      // Dynamic Speed increase
      g.speed = Math.min(7.0, 3.8 + g.score * 0.04);

      // Spawn Items and Obstacles
      if (now - g.lastSpawn > 1250 / (g.speed / 3.8)) {
        g.lastSpawn = now;
        const isFood = Math.random() > 0.42;

        if (isFood) {
          const rand = Math.random();
          const foodType = rand > 0.6 ? 'satow' : (rand > 0.3 ? 'fish' : 'bamboo');
          g.items.push({
            x: canvas.width + 20,
            y: g.groundY - (Math.random() > 0.5 ? 46 : 16),
            type: foodType,
            size: 22
          });
        } else {
          g.obstacles.push({
            x: canvas.width + 20,
            y: g.groundY,
            type: Math.random() > 0.5 ? 'chili' : 'driftwood',
            width: 20,
            height: 24
          });
        }
      }

      // Update Items
      g.items.forEach((item, idx) => {
        item.x -= g.speed;
        // Collision with cat
        const catBox = { x: 42, y: g.catY - 24, w: 28, h: 26 };
        if (
          catBox.x < item.x + item.size &&
          catBox.x + catBox.w > item.x &&
          catBox.y < item.y + item.size &&
          catBox.y + catBox.h > item.y
        ) {
          g.items.splice(idx, 1);
          const pts = item.type === 'satow' ? 20 : (item.type === 'fish' ? 10 : 15);
          g.score += pts;
          setScore(g.score);

          setPotIngredients(prev => ({
            ...prev,
            [item.type]: prev[item.type] + 1
          }));

          play8BitSound('coin');
        }
      });
      g.items = g.items.filter(i => i.x > -30);

      // Update Obstacles
      for (let idx = 0; idx < g.obstacles.length; idx++) {
        const obs = g.obstacles[idx];
        obs.x -= g.speed;

        const catBox = { x: 44, y: g.catY - 20, w: 22, h: 20 };
        if (
          catBox.x < obs.x + obs.width - 4 &&
          catBox.x + catBox.w > obs.x + 4 &&
          catBox.y < obs.y &&
          catBox.y + catBox.h > obs.y - obs.height + 4
        ) {
          // Collision -> Game Over
          play8BitSound('gameover');
          setGameState('gameover');

          if (g.score > highScore) {
            setHighScore(g.score);
            localStorage.setItem('tai_pla_high_score', g.score.toString());
            confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
          }
          return;
        }
      }
      g.obstacles = g.obstacles.filter(o => o.x > -40);

      // ==========================================
      // 8-BIT PIXEL RENDERING ENGINE
      // ==========================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Dithered 8-Bit Sunset Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 150);
      skyGrad.addColorStop(0, '#c2410c'); // Deep Sunset Orange
      skyGrad.addColorStop(0.5, '#ea580c');
      skyGrad.addColorStop(1, '#fb923c');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, 150);

      // Pixelated Clouds (Slow Parallax)
      ctx.fillStyle = 'rgba(254, 215, 170, 0.4)';
      const cloudX = (g.distanceRun * 0.2) % (canvas.width + 100);
      ctx.fillRect(canvas.width - cloudX, 25, 45, 12);
      ctx.fillRect(canvas.width - cloudX + 10, 18, 25, 8);
      ctx.fillRect(canvas.width - ((cloudX + 250) % (canvas.width + 100)), 45, 60, 14);

      // 2. Parallax Layer 1: Laos Mountains Silhouette Across Mekong
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.moveTo(0, 140);
      for (let mx = 0; mx <= canvas.width; mx += 30) {
        const my = 105 + Math.sin((mx + g.distanceRun * 0.3) * 0.02) * 22;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(canvas.width, 150);
      ctx.lineTo(0, 150);
      ctx.closePath();
      ctx.fill();

      // 3. Parallax Layer 2: Flowing Mekong River
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 140, canvas.width, 35);
      ctx.fillStyle = '#38bdf8';
      const waveShift = (g.frame * 2) % 32;
      for (let wx = -32; wx < canvas.width; wx += 32) {
        ctx.fillRect(wx + waveShift, 148, 14, 3);
        ctx.fillRect(wx + waveShift + 8, 160, 10, 2);
      }

      // ==========================================
      // NAKHON PHANOM 8-BIT ICONIC LANDMARKS
      // ==========================================
      const landmarkScroll = (g.distanceRun * 0.8) % 2400;

      // 🛕 LANDMARK 1: วัดมหาธาตุ (Wat Mahathat Pagoda / พระธาตุนคร)
      const watX = 550 - landmarkScroll;
      if (watX > -150 && watX < canvas.width + 100) {
        // Base structure
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(watX, 90, 44, 50);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(watX + 4, 95, 36, 45);

        // Golden Pagoda Tiers
        ctx.fillStyle = '#eab308'; // Gold
        ctx.fillRect(watX + 8, 70, 28, 20);
        ctx.fillRect(watX + 12, 50, 20, 20);
        ctx.fillRect(watX + 16, 30, 12, 20);
        // Golden Spire
        ctx.fillStyle = '#fde047';
        ctx.fillRect(watX + 20, 12, 4, 18);
        ctx.fillRect(watX + 19, 8, 6, 4);

        // Buddhist Flag Banner
        ctx.fillStyle = '#f97316';
        ctx.fillRect(watX - 8, 110, 4, 30);
        ctx.fillRect(watX - 8, 110, 10, 8);

        // Landmark Label Pill
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(watX - 10, 145, 64, 14);
        ctx.fillStyle = '#fde047';
        ctx.font = '8px monospace';
        ctx.fillText('วัดมหาธาตุ', watX - 6, 155);
      }

      // 🕰️ LANDMARK 2: หอนาฬิกาเวียดนามอนุสรณ์ (Vietnam Memorial Clock Tower)
      const clockX = 1250 - landmarkScroll;
      if (clockX > -150 && clockX < canvas.width + 100) {
        // Tower Brick Body (Pinkish Red Heritage Brick)
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(clockX, 60, 36, 80);
        ctx.fillStyle = '#be123c';
        ctx.fillRect(clockX + 4, 65, 28, 75);

        // Tower Top Roof
        ctx.fillStyle = '#881337';
        ctx.fillRect(clockX - 4, 52, 44, 8);
        ctx.fillRect(clockX + 8, 40, 20, 12);
        ctx.fillRect(clockX + 14, 32, 8, 8);

        // 8-Bit Clock Face
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(clockX + 10, 72, 16, 16);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(clockX + 17, 74, 2, 7); // Clock Hand
        ctx.fillRect(clockX + 17, 80, 5, 2);

        // Landmark Label Pill
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(clockX - 12, 145, 60, 14);
        ctx.fillStyle = '#f43f5e';
        ctx.font = '8px monospace';
        ctx.fillText('หอนาฬิกา', clockX - 6, 155);
      }

      // 🐉 LANDMARK 3: พญาศรีสัตตนาคราช (7-Headed Golden Naga Monument)
      const nagaX = 1950 - landmarkScroll;
      if (nagaX > -180 && nagaX < canvas.width + 100) {
        // Pedestal / Base
        ctx.fillStyle = '#334155';
        ctx.fillRect(nagaX, 105, 52, 35);
        ctx.fillStyle = '#475569';
        ctx.fillRect(nagaX + 4, 110, 44, 30);

        // Coiled Golden Naga Body
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(nagaX + 12, 60, 28, 45);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(nagaX + 16, 50, 20, 30);

        // 7 Golden Heads Fan
        ctx.fillStyle = '#facc15';
        ctx.fillRect(nagaX + 2, 32, 8, 18);  // Head 1
        ctx.fillRect(nagaX + 8, 26, 8, 22);  // Head 2
        ctx.fillRect(nagaX + 15, 20, 8, 26); // Head 3
        ctx.fillRect(nagaX + 22, 14, 8, 30); // Head 4 (Center King)
        ctx.fillRect(nagaX + 29, 20, 8, 26); // Head 5
        ctx.fillRect(nagaX + 36, 26, 8, 22); // Head 6
        ctx.fillRect(nagaX + 42, 32, 8, 18); // Head 7

        // Spouting Sparkling Pixel Water into Mekong River
        ctx.fillStyle = '#38bdf8';
        const spoutAnim = (g.frame * 4) % 30;
        ctx.fillRect(nagaX - 8 - spoutAnim, 28 + (spoutAnim * 0.8), 6, 4);
        ctx.fillRect(nagaX - 16 - spoutAnim, 42 + (spoutAnim * 1.2), 5, 5);

        // Landmark Label Pill
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(nagaX - 10, 145, 72, 14);
        ctx.fillStyle = '#facc15';
        ctx.font = '8px monospace';
        ctx.fillText('พญาศรีสัตตฯ', nagaX - 6, 155);
      }

      // ==========================================
      // FOREGROUND: NAKHON PHANOM PROMENADE TRACK
      // ==========================================
      // Promenade Railing / Divider
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 172, canvas.width, 4);
      for (let rx = 0; rx < canvas.width; rx += 40) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(rx, 172, 6, 24);
      }

      // Promenade Brick Walking Street
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(0, g.groundY, canvas.width, canvas.height - g.groundY);
      ctx.fillStyle = '#a16207';
      ctx.fillRect(0, g.groundY, canvas.width, 3);
      
      // Moving Brick Tile Pattern
      const brickShift = (g.distanceRun * 2) % 24;
      ctx.fillStyle = '#713f12';
      for (let bx = -24; bx < canvas.width; bx += 24) {
        ctx.fillRect(bx + brickShift, g.groundY + 12, 12, 2);
        ctx.fillRect(bx + brickShift + 12, g.groundY + 28, 12, 2);
      }

      // ==========================================
      // DRAW 8-BIT OBSTACLES & FOOD ITEMS
      // ==========================================
      // Obstacles
      g.obstacles.forEach(obs => {
        if (obs.type === 'chili') {
          // 8-bit Hot Southern Chili
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(obs.x + 6, obs.y - 18, 8, 18);
          ctx.fillRect(obs.x + 4, obs.y - 12, 12, 10);
          ctx.fillStyle = '#16a34a'; // Stem
          ctx.fillRect(obs.x + 8, obs.y - 24, 4, 6);
        } else {
          // River Driftwood / Obstacle
          ctx.fillStyle = '#451a03';
          ctx.fillRect(obs.x + 2, obs.y - 14, 18, 14);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(obs.x + 6, obs.y - 10, 10, 8);
        }
      });

      // Food Ingredients
      g.items.forEach(item => {
        if (item.type === 'satow') {
          // 8-bit Southern Twisted Satow Pod
          ctx.fillStyle = '#15803d';
          ctx.fillRect(item.x + 2, item.y + 2, 18, 16);
          ctx.fillStyle = '#22c55e'; // Bean bumps
          ctx.fillRect(item.x + 4, item.y + 4, 6, 6);
          ctx.fillRect(item.x + 12, item.y + 10, 6, 6);
        } else if (item.type === 'fish') {
          // 8-bit Grilled Mackerel (Pla-Too / Tai-Pla ingredient)
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(item.x + 2, item.y + 6, 16, 8);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(item.x + 14, item.y + 4, 4, 12); // Tail
          ctx.fillStyle = '#000000';
          ctx.fillRect(item.x + 4, item.y + 8, 2, 2); // Eye
        } else {
          // 8-bit Bamboo Shoots (หน่อไม้)
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(item.x + 4, item.y + 2, 12, 16);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(item.x + 6, item.y + 4, 8, 4);
          ctx.fillRect(item.x + 4, item.y + 12, 12, 4);
        }
      });

      // ==========================================
      // 8-BIT SPRITE: "น้องไตปลา" (Calico Cat / แมวเปรอะ)
      // ==========================================
      const catX = 42;
      const catY = g.catY;
      const legRun = Math.floor((g.frame / 4) % 4);

      // Tail (bouncing 8-bit tail)
      ctx.fillStyle = '#18181b';
      ctx.fillRect(catX + 2, catY - 14, 4, 4);
      ctx.fillRect(catX - 2, catY - 20, 4, 6);
      ctx.fillRect(catX + 2, catY - 24, 4, 4);

      // Body (Calico: Cream base with Orange & Dark patches)
      ctx.fillStyle = '#fef3c7'; // Cream base
      ctx.fillRect(catX + 6, catY - 18, 20, 14);

      // Orange Calico Patch
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(catX + 8, catY - 18, 8, 8);
      ctx.fillRect(catX + 18, catY - 12, 6, 6);

      // Black Calico Patch
      ctx.fillStyle = '#18181b';
      ctx.fillRect(catX + 16, catY - 18, 8, 6);
      ctx.fillRect(catX + 6, catY - 10, 6, 6);

      // Cat Head
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(catX + 20, catY - 26, 14, 14);

      // Head Calico Patches
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(catX + 22, catY - 26, 6, 6);
      ctx.fillStyle = '#18181b';
      ctx.fillRect(catX + 28, catY - 26, 6, 6);

      // Ears
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(catX + 20, catY - 32, 4, 6);
      ctx.fillStyle = '#18181b';
      ctx.fillRect(catX + 30, catY - 32, 4, 6);

      // Eyes (Cute pixel eyes)
      ctx.fillStyle = '#000000';
      ctx.fillRect(catX + 28, catY - 20, 2, 3);
      ctx.fillStyle = '#f43f5e'; // Pink Nose
      ctx.fillRect(catX + 32, catY - 17, 2, 2);

      // Animated 8-bit Running Paws (4 frame cycle)
      ctx.fillStyle = '#fef3c7';
      if (legRun === 0) {
        ctx.fillRect(catX + 8, catY - 4, 4, 4);
        ctx.fillRect(catX + 20, catY - 4, 4, 4);
      } else if (legRun === 1) {
        ctx.fillRect(catX + 12, catY - 4, 4, 4);
        ctx.fillRect(catX + 16, catY - 4, 4, 4);
      } else if (legRun === 2) {
        ctx.fillRect(catX + 6, catY - 4, 4, 4);
        ctx.fillRect(catX + 22, catY - 4, 4, 4);
      } else {
        ctx.fillRect(catX + 10, catY - 4, 4, 4);
        ctx.fillRect(catX + 18, catY - 4, 4, 4);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, soundEnabled, highScore, currentLandmark]);

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
                TAI-PLA RUN: 8-BIT นครพนม
              </h3>
              <span className="text-[9px] bg-amber-900/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-700 font-mono">
                RETRO 8-BIT
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-sans">
              วิ่งผ่านวัดมหาธาตุ, หอนาฬิกาเวียดนาม และลานพญาศรีสัตตนาคราช
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
            title={soundEnabled ? 'ปิดเสียง 8-Bit' : 'เปิดเสียง 8-Bit'}
          >
            {soundEnabled ? <Volume2 size={15} className="text-amber-400" /> : <VolumeX size={15} className="text-zinc-500" />}
          </button>
        </div>
      </div>

      {/* Active Landmark HUD Indicator */}
      <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 text-amber-300">
          <MapPin size={13} className="text-rose-400 animate-bounce" />
          <span className="font-bold">{currentLandmark}</span>
        </div>
        <span className="text-[10px] text-zinc-400">
          ระยะทาง: {Math.floor(gameRef.current.distanceRun / 10)} ม.
        </span>
      </div>

      {/* Playable 8-Bit Canvas Container */}
      <div 
        onClick={jump}
        className="relative w-full aspect-[16/8] max-w-[540px] mx-auto bg-[#0a0a0c] rounded-md overflow-hidden border-2 border-zinc-700 cursor-pointer select-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]"
      >
        <canvas 
          ref={canvasRef} 
          width={540} 
          height={240} 
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Start Overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
            <span className="text-3xl animate-bounce">🐱</span>
            <h4 className="font-mono text-sm font-bold text-amber-300 uppercase tracking-widest">
              น้องไตปลา ตะลุยนครพนม (8-BIT)
            </h4>
            <p className="text-xs text-zinc-300 font-sans max-w-xs leading-relaxed">
              แตะหน้าจอ หรือกด Spacebar เพื่อกระโดดเก็บวัตถุดิบแกงไตปลา หลบพริกแกงใต้ริมแม่น้ำโขง
            </p>
            <button
              onClick={startGame}
              className="mt-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono text-xs font-bold uppercase rounded cursor-pointer shadow-md active:scale-95 transition-all"
            >
              เริ่มวิ่ง (START 8-BIT RUN)
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
            <span className="text-2xl">🌶️🔥</span>
            <h4 className="font-mono text-base font-bold text-red-400 uppercase tracking-widest">
              เผ็ดพริกแกง! (GAME OVER)
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

      {/* 8-Bit Ingredients Collection Pot Meter */}
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

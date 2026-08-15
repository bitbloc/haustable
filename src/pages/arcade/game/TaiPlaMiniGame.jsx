/* Hallmark · component: TaiPlaMiniGame · genre: 8-bit runner · theme: Nakhon Phanom x Southern Thai */
import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Trophy, Sparkles, Volume2, VolumeX, Flame, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function TaiPlaMiniGame() {
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'playing' | 'gameover'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('tai_pla_high_score') || '0', 10);
  });
  const [potIngredients, setPotIngredients] = useState({ fish: 0, satow: 0, curry: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Game internal physics refs
  const gameRef = useRef({
    catY: 180,
    catVy: 0,
    isGrounded: true,
    score: 0,
    items: [],
    obstacles: [],
    lastSpawn: 0,
    groundY: 195,
    speed: 3.5
  });

  const playTone = (freq, type = 'sine', duration = 0.1) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setPotIngredients({ fish: 0, satow: 0, curry: 0 });
    gameRef.current = {
      catY: 180,
      catVy: 0,
      isGrounded: true,
      score: 0,
      items: [],
      obstacles: [],
      lastSpawn: Date.now(),
      groundY: 195,
      speed: 3.5
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
      gameRef.current.catVy = -11;
      gameRef.current.isGrounded = false;
      playTone(440, 'square', 0.12);
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

  // Main Canvas Game Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let lastTime = Date.now();

    const loop = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const g = gameRef.current;

      // Update Cat Physics (Gravity)
      g.catVy += 28 * dt; // gravity
      g.catY += g.catVy;
      if (g.catY >= g.groundY) {
        g.catY = g.groundY;
        g.catVy = 0;
        g.isGrounded = true;
      }

      // Increase Speed progressively
      g.speed = Math.min(6.5, 3.5 + g.score * 0.05);

      // Spawn Obstacles & Food Ingredients
      if (now - g.lastSpawn > 1300 / (g.speed / 3.5)) {
        g.lastSpawn = now;
        const isFood = Math.random() > 0.45;

        if (isFood) {
          const foodType = Math.random() > 0.5 ? 'fish' : 'satow';
          g.items.push({
            x: canvas.width + 20,
            y: g.groundY - (Math.random() > 0.5 ? 45 : 15),
            type: foodType,
            size: 22
          });
        } else {
          g.obstacles.push({
            x: canvas.width + 20,
            y: g.groundY,
            type: 'chili',
            width: 22,
            height: 28
          });
        }
      }

      // Move & Update Items
      g.items.forEach((item, idx) => {
        item.x -= g.speed;
        // Check collision with cat (Cat bounding box: x=40, width=28, height=28)
        const catBox = { x: 40, y: g.catY - 24, w: 30, h: 28 };
        if (
          catBox.x < item.x + item.size &&
          catBox.x + catBox.w > item.x &&
          catBox.y < item.y + item.size &&
          catBox.y + catBox.h > item.y
        ) {
          // Collected item!
          g.items.splice(idx, 1);
          const pts = item.type === 'satow' ? 20 : 10;
          g.score += pts;
          setScore(g.score);

          setPotIngredients(prev => ({
            ...prev,
            [item.type]: prev[item.type] + 1
          }));

          playTone(650, 'sine', 0.08);
        }
      });
      g.items = g.items.filter(i => i.x > -30);

      // Move & Update Obstacles
      for (let idx = 0; idx < g.obstacles.length; idx++) {
        const obs = g.obstacles[idx];
        obs.x -= g.speed;

        // Collision Check with Cat
        const catBox = { x: 44, y: g.catY - 22, w: 22, h: 22 };
        if (
          catBox.x < obs.x + obs.width - 4 &&
          catBox.x + catBox.w > obs.x + 4 &&
          catBox.y < obs.y &&
          catBox.y + catBox.h > obs.y - obs.height + 6
        ) {
          // Hit chili obstacle -> Game Over!
          playTone(150, 'sawtooth', 0.25);
          setGameState('gameover');

          if (g.score > highScore) {
            setHighScore(g.score);
            localStorage.setItem('tai_pla_high_score', g.score.toString());
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
          return;
        }
      }
      g.obstacles = g.obstacles.filter(o => o.x > -40);

      // --- Rendering ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Mekong Riverside Background Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#f97316'); // Sunset Orange
      skyGrad.addColorStop(0.65, '#fdba74');
      skyGrad.addColorStop(1, '#fed7aa');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Distant Mekong River Mountains (Laos border silhouette)
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(0, 150);
      ctx.lineTo(80, 110);
      ctx.lineTo(160, 140);
      ctx.lineTo(240, 95);
      ctx.lineTo(330, 135);
      ctx.lineTo(420, 105);
      ctx.lineTo(canvas.width, 145);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Flowing Mekong River Strip
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 150, canvas.width, 35);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      const waveOffset = (now / 15) % 40;
      for (let wx = -40; wx < canvas.width; wx += 40) {
        ctx.fillRect(wx + waveOffset, 162, 18, 2);
      }

      // Ground Path (Nakhon Phanom Walking Street)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, g.groundY + 2, canvas.width, canvas.height - g.groundY);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(0, g.groundY, canvas.width, 4);

      // 2. Draw Obstacles (Chili & Southern Spice)
      g.obstacles.forEach(obs => {
        ctx.font = '22px sans-serif';
        ctx.fillText('🌶️', obs.x, obs.y);
      });

      // 3. Draw Items (Fish & Satow)
      g.items.forEach(item => {
        ctx.font = '20px sans-serif';
        if (item.type === 'satow') {
          ctx.fillText('🌿', item.x, item.y + 16);
        } else {
          ctx.fillText('🐟', item.x, item.y + 16);
        }
      });

      // 4. Draw น้องไตปลา (Calico Cat / แมวเปรอะ)
      const catX = 40;
      const catY = g.catY;

      // Tail
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(catX + 4, catY - 8);
      ctx.quadraticCurveTo(catX - 6, catY - 20, catX - 2, catY - 24);
      ctx.stroke();

      // Body (Calico: Orange + Black spots on Cream)
      ctx.fillStyle = '#fef3c7'; // Cream base
      ctx.beginPath();
      ctx.ellipse(catX + 16, catY - 10, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Black & Orange Calico Patches
      ctx.fillStyle = '#ea580c'; // Orange spot
      ctx.beginPath();
      ctx.arc(catX + 12, catY - 14, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#18181b'; // Black spot
      ctx.beginPath();
      ctx.arc(catX + 20, catY - 8, 4, 0, Math.PI * 2);
      ctx.fill();

      // Cat Head
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(catX + 26, catY - 16, 9, 0, Math.PI * 2);
      ctx.fill();

      // Calico Head Patch
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(catX + 28, catY - 20, 4, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.moveTo(catX + 22, catY - 22);
      ctx.lineTo(catX + 26, catY - 28);
      ctx.lineTo(catX + 28, catY - 22);
      ctx.fill();

      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(catX + 28, catY - 22);
      ctx.lineTo(catX + 32, catY - 28);
      ctx.lineTo(catX + 34, catY - 22);
      ctx.fill();

      // Eyes & Whiskers
      ctx.fillStyle = '#000000';
      ctx.fillRect(catX + 30, catY - 17, 2, 2);

      // Paws (running animation)
      const legOffset = Math.sin(now / 50) * 4;
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(catX + 8 + legOffset, catY - 2, 4, 4);
      ctx.fillRect(catX + 20 - legOffset, catY - 2, 4, 4);

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
      <div className="flex items-center justify-between border-b border-zinc-700 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐱</span>
          <div>
            <h3 className="font-mono text-sm font-bold text-amber-300 uppercase tracking-wider">
              TAI-PLA RUN: ริมโขงนครพนม
            </h3>
            <p className="text-[10px] text-zinc-400 font-sans">
              พาน้องไตปลา (แมวเปรอะปักษ์ใต้) วิ่งเก็บสะตอและปลาทู หลบพริกแกงริมถนนคนเดิน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-zinc-800 px-3 py-1 rounded border border-zinc-700 text-amber-300">
            <span className="text-[10px] text-zinc-400 block">SCORE</span>
            <span className="font-bold">{score}</span>
          </div>
          <div className="bg-zinc-800 px-3 py-1 rounded border border-zinc-700 text-emerald-400">
            <span className="text-[10px] text-zinc-400 block">BEST</span>
            <span className="font-bold">{highScore}</span>
          </div>
        </div>
      </div>

      {/* Playable Canvas Container */}
      <div 
        onClick={jump}
        className="relative w-full aspect-[16/8] max-w-[540px] mx-auto bg-black rounded-md overflow-hidden border border-zinc-700 cursor-pointer select-none"
      >
        <canvas 
          ref={canvasRef} 
          width={540} 
          height={240} 
          className="w-full h-full block"
        />

        {/* Start Overlay */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
            <span className="text-3xl animate-bounce">🐱</span>
            <h4 className="font-mono text-sm font-bold text-amber-300 uppercase tracking-widest">
              น้องไตปลา แมวเปรอะผจญภัย
            </h4>
            <p className="text-xs text-zinc-300 font-sans max-w-xs leading-relaxed">
              แตะหน้าจอ หรือกด Spacebar เพื่อกระโดดเก็บสะตอ 🌿 และปลาทู 🐟 หลบพริกแกง 🌶️
            </p>
            <button
              onClick={startGame}
              className="mt-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono text-xs font-bold uppercase rounded cursor-pointer shadow-md active:scale-95 transition-all"
            >
              เริ่มวิ่ง (START RUN)
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
            <span className="text-2xl">🌶️🔥</span>
            <h4 className="font-mono text-base font-bold text-red-400 uppercase tracking-widest">
              เผ็ดพริกแกง! (GAME OVER)
            </h4>
            <p className="text-xs text-zinc-300 font-mono">
              SCORE: <strong className="text-amber-300">{score} PTS</strong> (ปลา {potIngredients.fish} ตัว, สะตอ {potIngredients.satow} ฝัก)
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
        <div className="flex items-center gap-2 text-zinc-400">
          <span>🥘 หม้อแกงไตปลาสะสม:</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sky-300">🐟 ปลาทู: {potIngredients.fish}</span>
          <span className="text-emerald-400">🌿 สะตอ: {potIngredients.satow}</span>
        </div>
      </div>
    </div>
  );
}

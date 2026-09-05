/* Hallmark · component: FlappyCatGame · genre: modern-minimal · theme: Atelier (Phaser Retro Arcade)
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 * contrast: pass (APCA / WCAG compliant)
 */
import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { getGameConfig } from './game/FlappyCatConfig';

// Zero-icon discipline: purely monospace typographic indicators
export default function FlappyCatGame({ onGameOver, leaderboard, onClaimScore, session, onRequireLogin, isFullscreen, setIsFullscreen, onBackToHub = null }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  // Initialize Phaser Game after ensuring Thai web fonts are loaded
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let isMounted = true;
    let fallbackTimer = null;

    const initPhaser = () => {
      if (!isMounted || gameRef.current || !containerRef.current) return;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      const config = getGameConfig(containerRef.current, onGameOver, leaderboard, onClaimScore, session, onRequireLogin);
      const game = new Phaser.Game(config);
      gameRef.current = game;
    };

    // Preload Thai unicode chunk via Font Loading API
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all([
        document.fonts.load('16px "IBM Plex Sans Thai"', 'ตะลุยแดนสตอคะแนนสุทธิเล่นอีกครั้ง'),
        document.fonts.load('bold 34px "IBM Plex Sans Thai"', 'ตะลุยแดนสตอ'),
        document.fonts.load('13px "IBM Plex Sans Thai"', 'บันทึกแต้มเล่นอีกครั้ง'),
        document.fonts.ready
      ]).then(() => {
        initPhaser();
      }).catch(() => {
        initPhaser();
      });

      // Safety timeout: boot Phaser anyway after max 350ms if network is slow
      fallbackTimer = setTimeout(initPhaser, 350);
    } else {
      initPhaser();
    }

    return () => {
      isMounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Keep session updated in Phaser registry when React session changes
  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.registry.set('session', session);
    }
  }, [session]);

  // Update leaderboard in Phaser when it updates in React state
  useEffect(() => {
    if (gameRef.current && leaderboard) {
      gameRef.current.registry.set('initialLeaderboard', leaderboard);
      
      // If the MenuScene is active, trigger restart to refresh high scores
      const menuScene = gameRef.current.scene.getScene('MenuScene');
      if (menuScene && menuScene.sys.isActive()) {
        menuScene.scene.restart();
      }
    }
  }, [leaderboard]);

  // Handle resizing Phaser canvas on fullscreen toggle
  useEffect(() => {
    if (gameRef.current) {
      // Small delay to let the CSS transition/layout update before triggering resize calculation
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  // Lock body scroll in fullscreen mode to prevent background scroll on mobile
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const handleFullscreenToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onBackToHub && isFullscreen) {
      onBackToHub();
      return;
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`${
      isFullscreen 
        ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-none' 
        : 'relative w-full h-full rounded-2xl border-2 border-[var(--color-ink)] shadow-md'
    } flex justify-center items-center select-none overflow-hidden bg-[#181615]`}>
      
      {/* 
        Double protection for crisp retro styling:
        Phaser configuration uses pixelArt: true, and the canvas container uses CSS pixelated rendering.
      */}
      {/* Hidden DOM font preloader ensuring browser fetches the Thai unicode-range chunk */}
      <span 
        aria-hidden="true"
        style={{ 
          fontFamily: '"IBM Plex Sans Thai", sans-serif',
          position: 'absolute',
          left: -9999,
          top: -9999,
          opacity: 0,
          pointerEvents: 'none',
          visibility: 'hidden'
        }}
      >
        ตะลุยแดนสตอ แตะหน้าจอเพื่อเริ่มเล่น คะแนนสุทธิ เล่นอีกครั้ง บันทึกแต้ม กำลังเปิดหน้าต่างบันทึกคะแนน โปรดรอสักครู่ แตะเพื่อเริ่มใหม่
      </span>

      <div 
        ref={containerRef} 
        className="game-canvas-container max-w-full max-h-full" 
        style={{ 
          imageRendering: 'pixelated',
          WebkitFontSmoothing: 'antialiased'
        }} 
      />

      {/* Navigation Controls in Fullscreen Mode */}
      {isFullscreen ? (
        <>
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              onTouchStart={onBackToHub}
              className="absolute top-4 left-4 z-50 px-3.5 py-2 bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] rounded-xl border-2 border-[#181615] shadow-xl text-xs font-mono font-bold tracking-wider active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>[ ← กลับโถงเกม ]</span>
            </button>
          )}
          <button
            onClick={handleFullscreenToggle}
            onTouchStart={handleFullscreenToggle}
            className="absolute top-4 right-4 z-50 px-3 py-1.5 bg-[#181615]/95 hover:bg-[#24201E] text-[#FAF7F5] rounded-xl border-2 border-[#5C544D] shadow-xl text-[11px] font-mono transition-colors active:scale-95 cursor-pointer font-bold tracking-wider focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
          >
            [ ESC // ออกจากเต็มจอ ]
          </button>
        </>
      ) : (
        <button
          onClick={handleFullscreenToggle}
          onTouchStart={handleFullscreenToggle}
          className="absolute bottom-3 right-3 z-40 px-2.5 py-1 bg-[#181615]/95 hover:bg-[#24201E] text-[#FAF7F5] rounded border border-[#3D3835] shadow-md text-[10px] font-mono transition-colors active:scale-95 cursor-pointer font-bold tracking-wide focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
        >
          [ FULLSCREEN // เต็มจอ ]
        </button>
      )}
    </div>
  );
}

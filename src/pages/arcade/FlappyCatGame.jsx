import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { getGameConfig } from './game/FlappyCatConfig';
import { Maximize2, Minimize2 } from 'lucide-react';

export default function FlappyCatGame({ onGameOver, leaderboard, onClaimScore, session, onRequireLogin, isFullscreen, setIsFullscreen }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  // Initialize Phaser Game
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config = getGameConfig(containerRef.current, onGameOver, leaderboard, onClaimScore, session, onRequireLogin);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    return () => {
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
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`${
      isFullscreen 
        ? 'fixed inset-0 z-[999] w-screen h-screen rounded-none border-none' 
        : 'relative w-full h-full rounded-3xl border border-neutral-800 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
    } flex justify-center items-center select-none overflow-hidden bg-[#0A0A0C]`}>
      
      {/* 
        Double protection for crisp retro styling:
        Phaser configuration uses pixelArt: true, and the canvas container uses CSS pixelated rendering.
      */}
      <div 
        ref={containerRef} 
        className="game-canvas-container max-w-full max-h-full" 
        style={{ 
          imageRendering: 'pixelated',
          WebkitFontSmoothing: 'none'
        }} 
      />

      {/* Fullscreen Toggle Buttons */}
      {isFullscreen ? (
        <button
          onClick={handleFullscreenToggle}
          onTouchStart={handleFullscreenToggle}
          className="absolute top-4 right-4 z-[1000] px-3 py-2 bg-[#181615]/90 hover:bg-[#24201E] text-[#FAF7F5] rounded-lg border border-[#5C544D] shadow-xl flex items-center gap-2 text-[11px] font-mono transition-all active:scale-95 cursor-pointer font-bold tracking-wider"
        >
          <Minimize2 className="w-3.5 h-3.5 text-[#BD4924]" />
          <span>ออกจากเต็มจอ</span>
        </button>
      ) : (
        <button
          onClick={handleFullscreenToggle}
          onTouchStart={handleFullscreenToggle}
          className="absolute bottom-3 right-3 z-40 px-2.5 py-1.5 bg-[#181615]/90 hover:bg-[#24201E] text-[#FAF7F5] rounded-md border border-[#3D3835] shadow-md flex items-center gap-1.5 text-[10px] font-mono transition-all active:scale-95 cursor-pointer font-bold tracking-wide"
        >
          <Maximize2 className="w-3 h-3 text-[#BD4924]" />
          <span>เต็มจอ</span>
        </button>
      )}
    </div>
  );
}

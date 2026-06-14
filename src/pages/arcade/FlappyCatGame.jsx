import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { getGameConfig } from './game/FlappyCatConfig';

export default function FlappyCatGame({ onGameOver, leaderboard, onClaimScore }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  // Initialize Phaser Game
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config = getGameConfig(containerRef.current, onGameOver, leaderboard, onClaimScore);
    const game = new Phaser.Game(config);
    gameRef.current = game;

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

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

  return (
    <div className="relative w-full h-full flex justify-center items-center select-none overflow-hidden rounded-3xl border border-neutral-800 bg-[#0A0A0C] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {/* 
        Double protection for crisp retro styling:
        Phaser configuration uses pixelArt: true, and the canvas container uses CSS pixelated rendering.
      */}
      <div 
        ref={containerRef} 
        className="game-canvas-container max-w-full" 
        style={{ 
          imageRendering: 'pixelated',
          WebkitFontSmoothing: 'none'
        }} 
      />
    </div>
  );
}

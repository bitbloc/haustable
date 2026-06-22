import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import MenuScene from './scenes/MenuScene';
import PlayScene from './scenes/PlayScene';
import GameOverScene from './scenes/GameOverScene';

export const getGameConfig = (parentEl, onGameOver, initialLeaderboard, onClaimScore, session, onRequireLogin) => {
  return {
    type: Phaser.AUTO,
    // Size suitable for iPad / Mobile viewport display
    width: 600,
    height: 700,
    parent: parentEl,
    pixelArt: true, // Crucial command to make the pixelated art display crisp without blur
    antialias: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 }, // Individual scenes will define custom gravity
        debug: false
      }
    },
    scene: [BootScene, MenuScene, PlayScene, GameOverScene],
    callbacks: {
      postBoot: (game) => {
        // Share references from React down into Phaser's global registry
        game.registry.set('onGameOver', onGameOver);
        game.registry.set('initialLeaderboard', initialLeaderboard);
        game.registry.set('onClaimScore', onClaimScore);
        game.registry.set('session', session);
        game.registry.set('onRequireLogin', onRequireLogin);
      }
    }
  };
};

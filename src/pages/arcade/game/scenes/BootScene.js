import Phaser from 'phaser';
import { generateGameTextures } from '../utils/TextureGenerator';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Ensure Thai web font unicode chunks are loaded for Canvas 2D rendering
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.load('16px "IBM Plex Sans Thai"', 'ตะลุยแดนสตอคะแนนสุทธิเล่นอีกครั้ง');
      document.fonts.load('bold 34px "IBM Plex Sans Thai"', 'ตะลุยแดนสตอ');
      document.fonts.load('13px "IBM Plex Sans Thai"', 'บันทึกแต้มเล่นอีกครั้ง');
      document.fonts.load('12px "Space Mono"');
    }

    // Atelier loading text
    const loadingText = this.add.text(width / 2, height / 2 - 30, 'LOADING ATELIER ARCADE...', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '12px',
      fill: '#89827B',
      letterSpacing: 1.5
    }).setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x181615, 0.9);
    progressBox.lineStyle(1, 0x3D3835, 1);
    progressBox.fillRect(width / 2 - 140, height / 2 + 6, 280, 14);
    progressBox.strokeRect(width / 2 - 140, height / 2 + 6, 280, 14);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xBD4924, 1);
      progressBar.fillRect(width / 2 - 138, height / 2 + 8, 276 * value, 10);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Preload Audio from the public path
    this.load.audio('jump', '/arcade/audio/jump.wav');
    this.load.audio('point', '/arcade/audio/point.wav');
    this.load.audio('hit', '/arcade/audio/hit.wav');
    this.load.audio('gameover', '/arcade/audio/gameover.wav');
    this.load.audio('bgm', '/arcade/audio/bgm.wav');
    
    // Preload Logo image from the public path
    this.load.image('logo', '/logo-secondary.png');
  }

  create() {
    // Generate fallback textures
    generateGameTextures(this);

    // Generate dynamic pixelated logo texture if loaded successfully
    if (this.textures.exists('logo') && !this.textures.exists('logo_pixelated')) {
      try {
        const logoSource = this.textures.get('logo').getSourceImage();
        if (logoSource && logoSource.width > 0) {
          const lowResWidth = 120;
          const lowResHeight = Math.round(lowResWidth * (logoSource.height / logoSource.width));
          
          const canvasTexture = this.textures.createCanvas('logo_pixelated', lowResWidth, lowResHeight);
          const ctx = canvasTexture.context;
          
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(logoSource, 0, 0, lowResWidth, lowResHeight);
          canvasTexture.refresh();
        }
      } catch (e) {
        console.error('Failed to create pixelated logo texture:', e);
      }
    }

    // Transition to Menu Scene only after web fonts are ready
    const proceedToMenu = () => {
      if (this.scene.isActive('BootScene')) {
        this.scene.start('MenuScene');
      }
    };

    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(proceedToMenu).catch(proceedToMenu);
      this.time.delayedCall(400, proceedToMenu);
    } else {
      proceedToMenu();
    }
  }
}

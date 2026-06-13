import Phaser from 'phaser';
import { generateGameTextures } from '../utils/TextureGenerator';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Retro loading text
    const loadingText = this.add.text(width / 2, height / 2 - 40, 'LOADING...', {
      fontFamily: '"Press Start 2P", Courier, monospace',
      fontSize: '20px',
      fill: '#DFFF00'
    }).setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x110022, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 + 10, 320, 24);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xDFFF00, 1);
      progressBar.fillRect(width / 2 - 152, height / 2 + 16, 304 * value, 12);
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

    // Transition to Menu Scene
    this.scene.start('MenuScene');
  }
}

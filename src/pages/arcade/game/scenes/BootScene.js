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

    // Preload Audio from the public path (will show warnings but won't crash if files are absent)
    this.load.audio('jump', '/arcade/audio/jump.mp3');
    this.load.audio('point', '/arcade/audio/point.mp3');
    this.load.audio('hit', '/arcade/audio/hit.mp3');
    this.load.audio('gameover', '/arcade/audio/gameover.mp3');
    this.load.audio('bgm', '/arcade/audio/bgm.mp3');
  }

  create() {
    // Generate fallback textures
    generateGameTextures(this);

    // Transition to Menu Scene
    this.scene.start('MenuScene');
  }
}

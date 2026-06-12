import Phaser from 'phaser';
import QRCode from 'qrcode';

// Secure hashing helper for client-side validation
export function generateScoreHash(score, timestamp) {
  const salt = 'haus_arcade_super_secret_salt_2026';
  const str = `${score}_${timestamp}_${salt}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.finalScore = data.score || 0;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Static backgrounds
    this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0);
    this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0).setDepth(10);

    // 2. Play gameover audio
    try {
      this.sound.stopByKey('bgm');
      this.sound.play('gameover', { volume: 0.6 });
    } catch (e) {
      console.warn('Game over audio error:', e);
    }

    // 3. Game Over Header
    this.add.text(width / 2, 80, 'GAME OVER', {
      fontFamily: 'Courier New, monospace',
      fontSize: '44px',
      fill: '#FF3333',
      stroke: '#000000',
      strokeThickness: 8,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 4. Score Display
    this.add.text(width / 2, 145, `SCORE: ${this.finalScore}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      fill: '#DFFF00',
      stroke: '#000000',
      strokeThickness: 6,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 5. QR Code Claim Generation (only if score > 0)
    if (this.finalScore > 0) {
      const timestamp = Math.floor(Date.now() / 1000);
      const hash = generateScoreHash(this.finalScore, timestamp);
      
      // Build secure url: /arcade/claim?score=X&ts=Y&hash=Z
      const claimUrl = `${window.location.origin}/arcade/claim?score=${this.finalScore}&ts=${timestamp}&hash=${hash}`;
      
      this.add.text(width / 2, 210, 'SCAN TO CLAIM SCORE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        fill: '#00FFFF',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.add.text(width / 2, 235, 'สแกนเพื่อสะสมแต้ม LINE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      // Create a temporary canvas element to render QR code
      const qrCanvas = document.createElement('canvas');
      QRCode.toCanvas(qrCanvas, claimUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) {
          console.error('QR code generation error:', err);
          this.add.text(width / 2, 350, 'QR Code Load Failed', {
            fontFamily: 'Courier New, monospace',
            fontSize: '16px',
            fill: '#FF0000'
          }).setOrigin(0.5);
        } else {
          // Add canvas to Phaser texture manager with a unique name
          const textureKey = `qr_${Date.now()}`;
          this.textures.addCanvas(textureKey, qrCanvas);
          
          // Render QR Code image sprite
          const qrSprite = this.add.image(width / 2, 360, textureKey).setOrigin(0.5);
          
          // Draw a retro glowing outline around the QR code
          const border = this.add.graphics();
          border.lineStyle(4, 0xDFFF00, 1);
          border.strokeRect(qrSprite.x - 92, qrSprite.y - 92, 184, 184);
        }
      });
      
      this.add.text(width / 2, 485, 'Expires in 5 minutes', {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        fill: '#888888',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    } else {
      // If score is 0, encourage them to try harder
      this.add.text(width / 2, 320, 'TRY TO GET AT LEAST 1 POINT\nTO CLAIM REWARDS!', {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        fill: '#FFFFFF',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    // 6. Play Again Button
    const restartBtn = this.add.text(width / 2, height - 120, 'TOUCH HERE TO RESTART', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fill: '#DFFF00',
      stroke: '#000000',
      strokeThickness: 5,
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive();

    // Pulse retry button
    this.tweens.add({
      targets: restartBtn,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 650,
      yoyo: true,
      repeat: -1
    });

    // Make the whole screen clickable to restart (excluding QR code or specific zones if wanted,
    // but standard Flappy Bird touch screen to restart is best)
    this.input.on('pointerdown', () => {
      // Stop gameover sound
      try { this.sound.stopByKey('gameover'); } catch (e) {}

      // Trigger callback to React if provided, to check/reload leaderboard
      const onGameOver = this.registry.get('onGameOver');
      if (onGameOver) {
        onGameOver(this.finalScore);
      }

      this.scene.start('MenuScene');
    });
  }
}

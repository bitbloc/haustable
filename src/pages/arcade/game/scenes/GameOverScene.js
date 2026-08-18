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

    // 1. Static/Parallax backgrounds
    this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0).setDepth(0);
    this.add.tileSprite(0, height - 160, width, 96, 'bg_river').setOrigin(0, 0).setDepth(1);
    this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0).setDepth(10);

    // 2. Play gameover audio
    try {
      this.sound.stopAll();
      this.sound.play('gameover', { volume: 0.6 });
    } catch (e) {
      console.warn('Game over audio error:', e);
    }

    // 3. Logo Display (UX/UI brand placement)
    if (this.textures.exists('logo_pixelated')) {
      const logo = this.add.image(width / 2, 55, 'logo_pixelated').setOrigin(0.5).setDepth(5);
      logo.setScale(1.8);
    } else {
      this.add.text(width / 2, 55, 'ในบ้าน', {
        fontFamily: 'Courier New, monospace',
        fontSize: '24px',
        fill: '#DFFF00',
        stroke: '#000000',
        strokeThickness: 4,
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(5);
    }

    // 4. Game Over Header
    this.add.text(width / 2, 115, 'GAME OVER', {
      fontFamily: 'Courier New, monospace',
      fontSize: '36px',
      fill: '#FF3333',
      stroke: '#000000',
      strokeThickness: 7,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    // 5. Score Display
    this.add.text(width / 2, 170, `SCORE: ${this.finalScore}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      fill: '#DFFF00',
      stroke: '#000000',
      strokeThickness: 6,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(20);

    const triggerRestart = () => {
      try { this.sound.stopAll(); } catch (e) {}

      const onGameOver = this.registry.get('onGameOver');
      if (onGameOver) {
        onGameOver(this.finalScore);
      }

      this.scene.start('PlayScene');
    };

    // 6. Direct Score Claim Button (if score > 0)
    if (this.finalScore > 0) {
      const claimBtnBg = this.add.rectangle(width / 2, 240, 360, 52, 0x1f1d24).setOrigin(0.5).setDepth(25).setStrokeStyle(3, 0xDFFF00).setInteractive();
      const claimBtn = this.add.text(width / 2, 240, '💾 SAVE SCORE / บันทึกแต้ม', {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        fill: '#DFFF00',
        stroke: '#000000',
        strokeThickness: 5,
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(26).setInteractive();

      // Pulse the claim button
      this.tweens.add({
        targets: [claimBtn, claimBtnBg],
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 600,
        yoyo: true,
        repeat: -1
      });

      const handleClaimClick = (pointer) => {
        if (pointer && pointer.event) pointer.event.stopPropagation();
        const onClaimScore = this.registry.get('onClaimScore');
        if (onClaimScore) {
          onClaimScore(this.finalScore);
        }
      };

      claimBtn.on('pointerdown', handleClaimClick);
      claimBtnBg.on('pointerdown', handleClaimClick);
    }

    // 7. Prominent "PLAY AGAIN / เริ่มใหม่อีกครั้ง" Button (High depth, clearly visible)
    const retryY = this.finalScore > 0 ? 325 : 260;
    const restartBtnBg = this.add.rectangle(width / 2, retryY, 360, 54, 0xEA580C).setOrigin(0.5).setDepth(25).setStrokeStyle(3, 0xFFFFFF).setInteractive();
    const restartBtn = this.add.text(width / 2, retryY, '▶ PLAY AGAIN / เริ่มใหม่', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 6,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(26).setInteractive();

    // Pulse retry button
    this.tweens.add({
      targets: [restartBtn, restartBtnBg],
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    const handleRestartClick = (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      triggerRestart();
    };

    restartBtn.on('pointerdown', handleRestartClick);
    restartBtnBg.on('pointerdown', handleRestartClick);

    // 8. Helpful hint subtext
    this.add.text(width / 2, retryY + 52, '[ แตะที่ใดก็ได้บนหน้าจอเพื่อเริ่มใหม่ ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(25);

    // 9. Tap anywhere on background or press SPACE to restart immediately
    this.input.on('pointerdown', (pointer) => {
      // Small delay prevents instant accidental clicks
      triggerRestart();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => triggerRestart());
      this.input.keyboard.on('keydown-ENTER', () => triggerRestart());
    }
  }
}

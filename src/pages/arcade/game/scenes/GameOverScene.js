import Phaser from 'phaser';
import QRCode from 'qrcode';
import { pixelSound, getArcadeRank } from '../utils/pixelSoundEngine';

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
    this.canRestart = false;
    this.isClaiming = false;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const rankInfo = getArcadeRank(this.finalScore, 'flappy');
    const currentRank = rankInfo.rank || rankInfo.tier || 'C';

    // 1. Static/Parallax backgrounds
    this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0).setDepth(0);
    this.add.tileSprite(0, height - 160, width, 96, 'bg_river').setOrigin(0, 0).setDepth(1);
    this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0).setDepth(2);

    // 2. Play gameover audio & trigger mobile haptics
    try {
      this.sound.stopAll();
      pixelSound.play('gameover');
      if (pixelSound.isSoundEnabled()) {
        this.sound.play('gameover', { volume: 0.45 });
      }
    } catch (e) {
      console.warn('Game over audio error:', e);
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 50, 40]); } catch (e) {}
    }

    // 3. Clean Minimal Enclosure Card
    const cardY = height / 2 - 10;
    const cardW = Math.min(width - 56, 320);
    const cardH = this.finalScore > 0 ? 290 : 230;

    this.add.rectangle(width / 2, cardY, cardW, cardH, 0x181615, 0.95)
      .setOrigin(0.5)
      .setDepth(10)
      .setStrokeStyle(2, 0x5C544D);

    // 4. Title & Big Score
    const topY = cardY - cardH / 2 + 36;
    this.add.text(width / 2, topY, 'GAME OVER', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '20px',
      fill: '#BD4924',
      fontStyle: 'bold',
      letterSpacing: 1.5
    }).setOrigin(0.5).setDepth(12);

    const scoreDisplay = this.add.text(width / 2, topY + 52, `${this.finalScore}`, {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '48px',
      fill: '#FAF7F5',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12);

    this.tweens.add({
      targets: scoreDisplay,
      scaleX: { from: 0.8, to: 1.0 },
      scaleY: { from: 0.8, to: 1.0 },
      duration: 300,
      ease: 'Back.easeOut'
    });

    const rankBadgeFill = currentRank === 'S+' ? '#E9F344' : (currentRank === 'S' ? '#FBBF24' : (currentRank === 'A' ? '#34D399' : '#A8A29E'));
    this.add.text(width / 2, topY + 96, `RANK ${currentRank}`, {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '12px',
      fill: rankBadgeFill,
      fontStyle: 'bold',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(13);

    const triggerRestart = () => {
      if (!this.canRestart) return;
      pixelSound.play('ui_click');
      try { this.sound.stopAll(); } catch (e) {}

      const onGameOver = this.registry.get('onGameOver');
      if (onGameOver) {
        onGameOver(this.finalScore);
      }

      this.scene.start('PlayScene');
    };

    // 5. Action Buttons
    let currentBtnY = topY + 142;
    const btnW = cardW - 40;

    // "เล่นอีกครั้ง" Button
    const restartBtnBg = this.add.rectangle(width / 2, currentBtnY, btnW, 44, 0xE9F344)
      .setOrigin(0.5)
      .setDepth(20)
      .setStrokeStyle(2, 0x181615)
      .setInteractive({ useHandCursor: true });

    const restartBtn = this.add.text(width / 2, currentBtnY, 'เล่นอีกครั้ง', {
      fontFamily: '"IBM Plex Sans Thai", -apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '15px',
      fill: '#181615',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    const handleRestartClick = (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      if (!this.canRestart) return;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(15); } catch (e) {}
      }
      triggerRestart();
    };

    restartBtn.on('pointerdown', handleRestartClick);
    restartBtnBg.on('pointerdown', handleRestartClick);

    // Direct Score Claim Button (if score > 0)
    let claimBtn = null;
    let claimBtnBg = null;
    if (this.finalScore > 0) {
      currentBtnY += 54;
      claimBtnBg = this.add.rectangle(width / 2, currentBtnY, btnW, 42, 0xBD4924)
        .setOrigin(0.5)
        .setDepth(20)
        .setStrokeStyle(1, 0xE05A36)
        .setInteractive({ useHandCursor: true });

      claimBtn = this.add.text(width / 2, currentBtnY, 'บันทึกแต้ม', {
        fontFamily: '"IBM Plex Sans Thai", -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        fill: '#FAF7F5',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

      const handleClaimClick = (pointer) => {
        if (pointer && pointer.event) pointer.event.stopPropagation();
        this.isClaiming = true;
        pixelSound.play('tier_up');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([20, 30]); } catch (e) {}
        }
        claimBtn.setText('กำลังบันทึก…');
        claimBtnBg.setFillStyle(0x2B2725);
        claimBtnBg.setStrokeStyle(1, 0x5C544D);

        const onClaimScore = this.registry.get('onClaimScore');
        if (onClaimScore) {
          onClaimScore(this.finalScore);
        }
      };

      claimBtn.on('pointerdown', handleClaimClick);
      claimBtnBg.on('pointerdown', handleClaimClick);
    }

    // 6. Cooldown timer to prevent accidental taps from death
    this.time.delayedCall(650, () => {
      this.canRestart = true;
    });

    this.input.on('pointerdown', (pointer) => {
      if (!this.canRestart || this.isClaiming) return;
      if (this.finalScore > 0 && claimBtnBg) {
        const bounds = claimBtnBg.getBounds();
        if (bounds.contains(pointer.x, pointer.y)) return;
      }
      triggerRestart();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => {
        if (this.canRestart && !this.isClaiming) triggerRestart();
      });
      this.input.keyboard.on('keydown-ENTER', () => {
        if (this.canRestart && !this.isClaiming) triggerRestart();
      });
    }
  }
}

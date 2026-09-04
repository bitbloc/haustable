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
    this.canRestart = false;
    this.isClaiming = false;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Static/Parallax backgrounds
    this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0).setDepth(0);
    this.add.tileSprite(0, height - 160, width, 96, 'bg_river').setOrigin(0, 0).setDepth(1);
    this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0).setDepth(2);

    // 2. Play gameover audio & trigger mobile haptics
    try {
      this.sound.stopAll();
      this.sound.play('gameover', { volume: 0.55 });
    } catch (e) {
      console.warn('Game over audio error:', e);
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 50, 40]); } catch (e) {}
    }

    // 3. Central Atelier Rams Enclosure Card
    const cardY = height / 2 - 25;
    const cardW = Math.min(width - 48, 440);
    const cardH = this.finalScore > 0 ? 370 : 310;
    
    // Card background (Tinted warm charcoal-ink)
    const cardBg = this.add.rectangle(width / 2, cardY, cardW, cardH, 0x181615, 0.94)
      .setOrigin(0.5)
      .setDepth(10)
      .setStrokeStyle(1, 0x5C544D);

    // Subtle inner hairline divider
    const headerLineY = cardY - cardH / 2 + 72;
    const lineGraphics = this.add.graphics().setDepth(11);
    lineGraphics.lineStyle(1, 0x3D3835, 1.0);
    lineGraphics.lineBetween(width / 2 - cardW / 2 + 20, headerLineY, width / 2 + cardW / 2 - 20, headerLineY);

    // 4. Header Section: Atelier Clean Upright Typography
    const tagY = cardY - cardH / 2 + 28;
    this.add.text(width / 2, tagY, 'IN THE HAUS • ATELIER ARCADE', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '11px',
      fill: '#89827B',
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(12);

    this.add.text(width / 2, tagY + 24, 'GAME OVER', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '24px',
      fill: '#BD4924', // Terracotta clay accent
      fontStyle: 'bold',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(12);

    // 5. Monospace Score Panel (Minimalist Instrument readout)
    const scoreY = headerLineY + 54;
    this.add.text(width / 2, scoreY - 18, 'FINAL SCORE / คะแนนสุทธิ', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '11px',
      fill: '#89827B',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(12);

    const scoreDisplay = this.add.text(width / 2, scoreY + 16, `${this.finalScore}`, {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '48px',
      fill: '#FAF7F5', // Warm cream
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12);

    // Subtle score entrance scale
    this.tweens.add({
      targets: scoreDisplay,
      scaleX: { from: 0.8, to: 1.0 },
      scaleY: { from: 0.8, to: 1.0 },
      duration: 350,
      ease: 'Back.easeOut'
    });

    const triggerRestart = () => {
      if (!this.canRestart) return;
      try { this.sound.stopAll(); } catch (e) {}

      const onGameOver = this.registry.get('onGameOver');
      if (onGameOver) {
        onGameOver(this.finalScore);
      }

      this.scene.start('PlayScene');
    };

    // 6. Action Buttons Section
    let currentBtnY = scoreY + 68;

    // Direct Score Claim Button (if score > 0)
    let claimBtn = null;
    let claimBtnBg = null;
    if (this.finalScore > 0) {
      const btnW = cardW - 48;
      claimBtnBg = this.add.rectangle(width / 2, currentBtnY, btnW, 46, 0xBD4924)
        .setOrigin(0.5)
        .setDepth(20)
        .setStrokeStyle(1, 0xE05A36)
        .setInteractive({ useHandCursor: true });

      claimBtn = this.add.text(width / 2, currentBtnY, 'บันทึกแต้ม / SAVE SCORE', {
        fontFamily: '"Geist Mono", "Space Mono", monospace',
        fontSize: '13px',
        fill: '#FAF7F5',
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

      const handleClaimClick = (pointer) => {
        if (pointer && pointer.event) pointer.event.stopPropagation();
        this.isClaiming = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([20, 30]); } catch (e) {}
        }
        claimBtn.setText('กำลังเปิดหน้าต่างบันทึกคะแนน...');
        claimBtnBg.setFillStyle(0x2B2725);
        claimBtnBg.setStrokeStyle(1, 0x5C544D);

        const onClaimScore = this.registry.get('onClaimScore');
        if (onClaimScore) {
          onClaimScore(this.finalScore);
        }
      };

      claimBtn.on('pointerdown', handleClaimClick);
      claimBtnBg.on('pointerdown', handleClaimClick);

      currentBtnY += 56;
    }

    // "PLAY AGAIN / เล่นอีกครั้ง" Button
    const retryBtnW = cardW - 48;
    const restartBtnBg = this.add.rectangle(width / 2, currentBtnY, retryBtnW, 46, 0x24201E)
      .setOrigin(0.5)
      .setDepth(20)
      .setStrokeStyle(1, 0x5C544D)
      .setInteractive({ useHandCursor: true });

    const restartBtn = this.add.text(width / 2, currentBtnY, 'เล่นอีกครั้ง / PLAY AGAIN', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '13px',
      fill: '#FAF7F5',
      fontStyle: 'bold',
      letterSpacing: 1
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

    // 7. Cooldown Lockout & Monospace Helper Subtext
    const subtextY = currentBtnY + 36;
    const helperSubtext = this.add.text(width / 2, subtextY, 'โปรดรอสักครู่...', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '10px',
      fill: '#69635D',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(15);

    // 800ms cooldown timer to prevent accidental taps from death
    this.time.delayedCall(800, () => {
      this.canRestart = true;
      if (helperSubtext && helperSubtext.active) {
        helperSubtext.setText('แตะเพื่อเริ่มใหม่ • กด SPACE / ENTER');
        helperSubtext.setFill('#89827B');
        
        // Gentle pulse on helper subtext
        this.tweens.add({
          targets: helperSubtext,
          alpha: { from: 1.0, to: 0.5 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // 8. Controlled background tap: only triggers restart after 800ms cooldown and not when claiming
    this.input.on('pointerdown', (pointer) => {
      if (!this.canRestart || this.isClaiming) return;
      
      // If clicking inside the card's claim button zone, do not trigger background restart
      if (this.finalScore > 0 && claimBtnBg) {
        const bounds = claimBtnBg.getBounds();
        if (bounds.contains(pointer.x, pointer.y)) return;
      }

      triggerRestart();
    });

    // Keyboard restart controls
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

import Phaser from 'phaser';
import { pixelSound } from '../utils/pixelSoundEngine';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const cy = height / 2 - 20;

    // 1. Scrolling background layers (Riverside sunset parallax)
    this.bgWall = this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0).setDepth(0);
    this.bgRiver = this.add.tileSprite(0, height - 160, width, 96, 'bg_river').setOrigin(0, 0).setDepth(1);
    this.bgGround = this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0).setDepth(2);

    // 2. Minimal Title
    this.add.text(width / 2, cy - 110, 'FLAPPY CAT', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '32px',
      fill: '#FAF7F5',
      stroke: '#181615',
      strokeThickness: 6,
      fontStyle: 'bold',
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    // 3. Bouncing animated cat sprite
    const menuCat = this.add.sprite(width / 2, cy - 25, 'cat').setDepth(5);
    menuCat.setScale(2.4);

    if (!this.anims.exists('flap')) {
      this.anims.create({
        key: 'flap',
        frames: this.anims.generateFrameNumbers('cat', { frames: [0, 1, 2, 1] }),
        frameRate: 10,
        repeat: -1
      });
    }
    menuCat.play('flap');

    this.tweens.add({
      targets: menuCat,
      y: cy - 38,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 4. Clean Start Button
    const startBtnW = 220;
    const startCardBg = this.add.rectangle(width / 2, cy + 70, startBtnW, 50, 0xE9F344, 1)
      .setOrigin(0.5)
      .setDepth(10)
      .setStrokeStyle(2, 0x181615)
      .setInteractive({ useHandCursor: true });

    const startText = this.add.text(width / 2, cy + 70, 'เริ่มเล่น', {
      fontFamily: '"IBM Plex Sans Thai", -apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '18px',
      fill: '#181615',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    this.tweens.add({
      targets: [startCardBg, startText],
      scaleX: { from: 1.0, to: 1.03 },
      scaleY: { from: 1.0, to: 1.03 },
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 5. Play Background Music if available and sound is enabled
    const playBGM = () => {
      try {
        if (!pixelSound.isSoundEnabled()) return;
        let bgm = this.sound.get('bgm');
        if (bgm) {
          if (!bgm.isPlaying) {
            bgm.setLoop(true);
            bgm.setVolume(0.25);
            bgm.play();
          }
        } else {
          bgm = this.sound.add('bgm', { loop: true, volume: 0.25 });
          bgm.play();
        }
      } catch (e) {
        console.warn('BGM play failed in MenuScene:', e);
      }
    };

    if (this.sound.locked) {
      this.sound.once('unlocked', playBGM);
    } else {
      playBGM();
    }

    // 6. Input Event: Tap to Start
    this.isStarting = false;
    const startGame = () => {
      if (this.isStarting) return;
      this.isStarting = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(15); } catch (e) {}
      }
      pixelSound.play('meow');
      if (pixelSound.isSoundEnabled()) {
        try { this.sound.play('jump', { volume: 0.4 }); } catch (e) {}
      }
      this.scene.start('PlayScene');
    };

    this.input.on('pointerdown', startGame);
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', startGame);
      this.input.keyboard.on('keydown-ENTER', startGame);
    }
  }

  update() {
    this.bgWall.tilePositionX += 0.2;
    this.bgRiver.tilePositionX += 1.0;
    this.bgGround.tilePositionX += 2.5;
  }
}

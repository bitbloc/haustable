import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Scrolling background layers (Riverside sunset parallax)
    this.bgWall = this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0).setDepth(0);
    this.bgRiver = this.add.tileSprite(0, height - 160, width, 96, 'bg_river').setOrigin(0, 0).setDepth(1);
    this.bgGround = this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0).setDepth(2);

    // 2. Logo / Title Section
    if (this.textures.exists('logo_pixelated')) {
      const logo = this.add.image(width / 2, 75, 'logo_pixelated').setOrigin(0.5).setDepth(5);
      logo.setScale(2.2); // Chunky retro pixelated scaling
    } else {
      this.add.text(width / 2, 75, 'ในบ้าน', {
        fontFamily: 'Courier New, monospace',
        fontSize: '28px',
        fill: '#DFFF00',
        stroke: '#000000',
        strokeThickness: 5,
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(5);
    }

    const titleText = this.add.text(width / 2, 135, 'FLAPPY CAT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '44px',
      fill: '#DFFF00',
      stroke: '#000000',
      strokeThickness: 8,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    // Make the title pulse
    this.tweens.add({
      targets: titleText,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Add a bouncing animated cat sprite to make menu lively
    const menuCat = this.add.sprite(width / 2, 205, 'cat').setDepth(5);
    menuCat.setScale(1.35);
    menuCat.setFlipX(true);
    
    // Flap animation
    if (!this.anims.exists('flap')) {
      this.anims.create({
        key: 'flap',
        frames: this.anims.generateFrameNumbers('cat', { start: 0, end: 1 }),
        frameRate: 10,
        repeat: -1
      });
    }
    menuCat.play('flap');

    // Bounce the cat up and down
    this.tweens.add({
      targets: menuCat,
      y: 190,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 3. Play Button / Instruction Text
    const startText = this.add.text(width / 2, 260, 'TAP TO FLY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    // Make instruction blink
    this.tweens.add({
      targets: startText,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    // 4. Leaderboard Section
    this.add.text(width / 2, 340, '--- LEADERBOARD ---', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      fill: '#00FFFF',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    // Display Leaderboard entries
    const leaderboard = this.registry.get('initialLeaderboard') || [];
    const startY = 380;
    
    if (leaderboard.length === 0) {
      this.add.text(width / 2, startY + 40, 'NO HIGH SCORES YET', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        fill: '#888888',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(5);
    } else {
      leaderboard.slice(0, 5).forEach((entry, index) => {
        // Safe display name logic
        let name = entry.display_name ? entry.display_name.toUpperCase() : 'GUEST';
        if (name.length > 12) name = name.substring(0, 10) + '..';
        const score = entry.score;
        const rankText = `${index + 1}. ${name.padEnd(14, '.')} ${score}`;
        
        this.add.text(width / 2, startY + (index * 40), rankText, {
          fontFamily: 'Courier New, monospace',
          fontSize: '18px',
          fill: index === 0 ? '#DFFF00' : '#FFFFFF',
          stroke: '#000000',
          strokeThickness: 3,
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(5);
      });
    }

    // 5. Play Background Music if available (handle AudioContext lock gracefully)
    const playBGM = () => {
      try {
        let bgm = this.sound.get('bgm');
        if (!bgm) {
          this.sound.play('bgm', { loop: true, volume: 0.3 });
        } else if (!bgm.isPlaying) {
          bgm.play();
        }
      } catch (e) {
        console.warn('BGM play failed:', e);
      }
    };

    if (this.sound.locked) {
      this.sound.once('unlocked', playBGM);
    } else {
      playBGM();
    }

    // 6. Input Event: Click/Touch to Start
    this.input.once('pointerdown', () => {
      try { this.sound.play('jump', { volume: 0.5 }); } catch (e) {}
      this.scene.start('PlayScene');
    });
  }

  update() {
    // Parallax background scroll
    this.bgWall.tilePositionX += 0.2;
    this.bgRiver.tilePositionX += 1.0;
    this.bgGround.tilePositionX += 2.5;
  }
}

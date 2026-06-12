import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Scrolling background layers
    this.bgWall = this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0);
    this.bgGround = this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0);

    // 2. Title Text
    this.add.text(width / 2, 100, 'HAUS ARCADE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      fill: '#FF00FF',
      stroke: '#000000',
      strokeThickness: 5,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const titleText = this.add.text(width / 2, 160, 'FLAPPY CAT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      fill: '#DFFF00',
      stroke: '#000000',
      strokeThickness: 8,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Make the title pulse
    this.tweens.add({
      targets: titleText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 3. Play Button / Instruction Text
    const startText = this.add.text(width / 2, 250, 'TAP TO FLY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold'
    }).setOrigin(0.5);

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
    }).setOrigin(0.5);

    // Display Leaderboard entries
    const leaderboard = this.registry.get('initialLeaderboard') || [];
    const startY = 380;
    
    if (leaderboard.length === 0) {
      this.add.text(width / 2, startY + 40, 'NO HIGH SCORES YET', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        fill: '#888888',
        fontStyle: 'bold'
      }).setOrigin(0.5);
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
        }).setOrigin(0.5);
      });
    }

    // 5. Play Background Music if available
    try { this.sound.play('bgm', { loop: true, volume: 0.3 }); } catch (e) {
      console.warn('BGM play failed:', e);
    }

    // 6. Input Event: Click/Touch to Start
    this.input.once('pointerdown', () => {
      try { this.sound.play('jump', { volume: 0.5 }); } catch (e) {}
      this.scene.start('PlayScene');
    });
  }

  update() {
    // Parallax background scroll
    this.bgWall.tilePositionX += 0.5;
    this.bgGround.tilePositionX += 2;
  }
}

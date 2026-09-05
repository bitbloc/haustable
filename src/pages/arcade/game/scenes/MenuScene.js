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

    // 2. Logo / Header Section
    if (this.textures.exists('logo_pixelated')) {
      const logo = this.add.image(width / 2, 60, 'logo_pixelated').setOrigin(0.5).setDepth(5);
      logo.setScale(1.8);
    } else {
      this.add.text(width / 2, 60, 'IN THE HAUS', {
        fontFamily: '"Geist Mono", "Space Mono", monospace',
        fontSize: '18px',
        fill: '#FAF7F5',
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5).setDepth(5);
    }

    const titleText = this.add.text(width / 2, 110, 'ตะลุยแดนสตอ', {
      fontFamily: '"IBM Plex Sans Thai", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '34px',
      fill: '#FAF7F5',
      stroke: '#181615',
      strokeThickness: 6,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    const subTitleText = this.add.text(width / 2, 145, 'FLAPPY CAT • ATELIER ARCADE', {
      fontFamily: '"Space Mono", monospace',
      fontSize: '11px',
      fill: '#BD4924', // Terracotta Clay
      fontStyle: 'bold',
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    // Bouncing animated cat sprite
    const menuCat = this.add.sprite(width / 2, 195, 'cat').setDepth(5);
    menuCat.setScale(1.4);
    menuCat.setFlipX(true);
    
    if (!this.anims.exists('flap')) {
      this.anims.create({
        key: 'flap',
        frames: this.anims.generateFrameNumbers('cat', { start: 0, end: 1 }),
        frameRate: 10,
        repeat: -1
      });
    }
    menuCat.play('flap');

    this.tweens.add({
      targets: menuCat,
      y: 182,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 3. Play Button / Start CTA Card
    const session = this.registry.get('session');
    const isLoggedIn = !!session;

    const startBtnW = Math.min(width - 64, 380);
    const startCardBg = this.add.rectangle(width / 2, 260, startBtnW, 58, 0x181615, 0.92)
      .setOrigin(0.5)
      .setDepth(10)
      .setStrokeStyle(1, 0xBD4924)
      .setInteractive({ useHandCursor: true });

    const startText = this.add.text(width / 2, 250, 'แตะหน้าจอเพื่อเริ่มเล่น', {
      fontFamily: '"IBM Plex Sans Thai", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '16px',
      fill: '#FAF7F5',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    const subPromptText = this.add.text(width / 2, 274, isLoggedIn ? '● บัญชีสมาชิกเชื่อมต่อแล้ว (สะสมเหรียญ xhaus)' : '○ โหมดเล่นอิสระ (Guest Mode)', {
      fontFamily: '"IBM Plex Sans Thai", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '11px',
      fill: isLoggedIn ? '#526A3B' : '#89827B',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11);

    // Subtle breathing animation on start card
    this.tweens.add({
      targets: [startCardBg, startText, subPromptText],
      alpha: { from: 1.0, to: 0.75 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 4. Atelier Leaderboard Section (Clean Tabular Grid)
    const boardW = Math.min(width - 64, 380);
    const boardH = 260;
    const boardY = 445;

    // Outer card container
    this.add.rectangle(width / 2, boardY, boardW, boardH, 0x181615, 0.92)
      .setOrigin(0.5)
      .setDepth(10)
      .setStrokeStyle(1, 0x3D3835);

    // Header strip inside card
    this.add.text(width / 2 - boardW / 2 + 20, boardY - boardH / 2 + 22, 'LEADERBOARD', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '12px',
      fill: '#FAF7F5',
      fontStyle: 'bold',
      letterSpacing: 1.5
    }).setOrigin(0, 0.5).setDepth(11);

    this.add.text(width / 2 + boardW / 2 - 20, boardY - boardH / 2 + 22, '[ TOP 5 ]', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '10px',
      fill: '#89827B'
    }).setOrigin(1, 0.5).setDepth(11);

    // Hairline divider
    const boardDivider = this.add.graphics().setDepth(11);
    boardDivider.lineStyle(1, 0x2B2725, 1.0);
    boardDivider.lineBetween(width / 2 - boardW / 2 + 16, boardY - boardH / 2 + 40, width / 2 + boardW / 2 - 16, boardY - boardH / 2 + 40);

    // Display Leaderboard rows
    const leaderboard = this.registry.get('initialLeaderboard') || [];
    const rowStartY = boardY - boardH / 2 + 65;

    if (leaderboard.length === 0) {
      this.add.text(width / 2, boardY + 15, 'ยังไม่มีอันดับคะแนน', {
        fontFamily: '"IBM Plex Sans Thai", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '12px',
        fill: '#69635D'
      }).setOrigin(0.5).setDepth(11);
    } else {
      leaderboard.slice(0, 5).forEach((entry, index) => {
        let name = entry.display_name ? entry.display_name.toUpperCase() : 'GUEST';
        if (name.length > 12) name = name.substring(0, 10) + '..';
        const score = entry.score;
        const rowY = rowStartY + (index * 38);

        // Rank pill
        const isFirst = index === 0;
        const rankColor = isFirst ? '#BD4924' : '#89827B';
        const rankNum = String(index + 1).padStart(2, '0');

        this.add.text(width / 2 - boardW / 2 + 22, rowY, rankNum, {
          fontFamily: '"Geist Mono", "Space Mono", monospace',
          fontSize: '12px',
          fill: rankColor,
          fontStyle: 'bold'
        }).setOrigin(0, 0.5).setDepth(11);

        // Player Name
        this.add.text(width / 2 - boardW / 2 + 56, rowY, name, {
          fontFamily: '"IBM Plex Sans Thai", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fill: isFirst ? '#FAF7F5' : '#D9D2CB',
          fontStyle: isFirst ? 'bold' : 'normal'
        }).setOrigin(0, 0.5).setDepth(11);

        // Score (Right-aligned)
        this.add.text(width / 2 + boardW / 2 - 22, rowY, `${score}`, {
          fontFamily: '"Geist Mono", "Space Mono", monospace',
          fontSize: '13px',
          fill: isFirst ? '#BD4924' : '#FAF7F5',
          fontStyle: 'bold'
        }).setOrigin(1, 0.5).setDepth(11);
      });
    }

    // 5. Play Background Music if available
    const playBGM = () => {
      try {
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
      try { this.sound.play('jump', { volume: 0.5 }); } catch (e) {}
      this.scene.start('PlayScene');
    };

    this.input.on('pointerdown', startGame);
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', startGame);
      this.input.keyboard.on('keydown-ENTER', startGame);
    }
  }

  update() {
    // Parallax background scroll
    this.bgWall.tilePositionX += 0.2;
    this.bgRiver.tilePositionX += 1.0;
    this.bgGround.tilePositionX += 2.5;
  }
}

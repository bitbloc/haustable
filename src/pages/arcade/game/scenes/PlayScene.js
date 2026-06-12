import Phaser from 'phaser';

export default class PlayScene extends Phaser.Scene {
  constructor() {
    super('PlayScene');
  }

  init() {
    this.score = 0;
    this.isGameOver = false;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Scrolling background layers
    this.bgWall = this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0);
    this.bgGround = this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0);
    
    // Set depth of ground to be above obstacles
    this.bgGround.setDepth(10);

    // 2. Score Text
    this.scoreText = this.add.text(width / 2, 80, '0', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      fill: '#DFFF00',
      stroke: '#000000',
      strokeThickness: 8,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(20);

    // 3. Create Player (Cat)
    this.player = this.physics.add.sprite(100, height / 2, 'cat');
    this.player.setOrigin(0.5);
    this.player.setDepth(5);
    this.player.body.setGravityY(1000);
    this.player.body.setCollideWorldBounds(false); // We handle boundary check manually
    
    // Resize physics hitbox to fit the pixel cat body (32x32 original, let's make it slightly smaller to be forgiving)
    this.player.body.setSize(24, 24);

    // Cat flap animation
    if (!this.anims.exists('flap')) {
      this.anims.create({
        key: 'flap',
        frames: this.anims.generateFrameNumbers('cat', { start: 0, end: 1 }),
        frameRate: 10,
        repeat: -1
      });
    }
    this.player.play('flap');

    // 4. Obstacles (Satow Pods) Group
    this.satowGroup = this.physics.add.group();
    
    // Add collision between player and obstacles
    this.physics.add.collider(this.player, this.satowGroup, this.hitObstacle, null, this);

    // 5. Timer to Spawn Obstacles
    this.spawnTimer = this.time.addEvent({
      delay: 1800,
      callback: this.spawnSatow,
      callbackScope: this,
      loop: true
    });

    // Spawn first obstacle immediately after short delay
    this.time.delayedCall(500, this.spawnSatow, [], this);

    // 6. Tap / Input Listener
    this.input.on('pointerdown', this.flap, this);
  }

  update() {
    if (this.isGameOver) return;

    // Scroll Backgrounds
    this.bgWall.tilePositionX += 0.5;
    this.bgGround.tilePositionX += 2.5;

    // Cat Rotation/Angle logic based on velocity (Flappy Bird style)
    if (this.player.body.velocity.y < 0) {
      // Flapping up
      this.player.angle = -20;
    } else if (this.player.body.velocity.y > 0) {
      // Falling down
      this.player.angle = Math.min(70, this.player.angle + 2.5);
    }

    // Boundary check (hit ground or fly too high)
    const groundY = this.cameras.main.height - 64;
    if (this.player.y > groundY - 16) {
      this.hitObstacle();
    }
    if (this.player.y < -30) {
      this.hitObstacle();
    }

    // Clean up offscreen obstacles
    this.satowGroup.children.iterate((child) => {
      if (child && child.x < -100) {
        child.destroy();
      }
      return true;
    });
  }

  flap() {
    if (this.isGameOver) return;

    // Set upward velocity
    this.player.body.setVelocityY(-350);

    // Play jump sound
    try {
      const jumpSound = this.sound.get('jump');
      if (jumpSound) jumpSound.play({ volume: 0.4 });
    } catch (e) {}

    // Subtle jump squish effect
    this.tweens.add({
      targets: this.player,
      scaleY: 0.8,
      scaleX: 1.2,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
  }

  spawnSatow() {
    if (this.isGameOver) return;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Spawning parameters
    const gap = 170; // gap height for player to fly through
    const minHeight = 80;
    const maxHeight = height - 64 - gap - minHeight;
    const gapY = Phaser.Math.Between(minHeight, maxHeight);

    const spawnX = width + 64;
    const speed = -230; // Obstacle velocity moving left

    // 1. Top Satow (hanging down)
    const topSatow = this.physics.add.sprite(spawnX, gapY, 'satow_pod');
    this.satowGroup.add(topSatow);
    topSatow.setOrigin(0.5, 1); // Align at bottom edge of top pipe
    topSatow.setFlipY(true);    // Point downward
    topSatow.body.setAllowGravity(false);
    topSatow.body.setImmovable(true);
    topSatow.body.setVelocityX(speed);
    
    // Scale size of physics body to match graphic
    topSatow.body.setSize(44, 380);
    // Stretch graphic height to fit
    topSatow.setDisplaySize(64, gapY);

    // 2. Bottom Satow (pointing up)
    const bottomHeight = height - 64 - (gapY + gap);
    const bottomSatow = this.physics.add.sprite(spawnX, gapY + gap, 'satow_pod');
    this.satowGroup.add(bottomSatow);
    bottomSatow.setOrigin(0.5, 0); // Align at top edge of bottom pipe
    bottomSatow.body.setAllowGravity(false);
    bottomSatow.body.setImmovable(true);
    bottomSatow.body.setVelocityX(speed);
    
    bottomSatow.body.setSize(44, 380);
    bottomSatow.setDisplaySize(64, bottomHeight);

    // 3. Invisible score sensor zone (placed between pipes)
    const scoreSensor = this.add.rectangle(spawnX + 32, gapY + gap / 2, 10, gap);
    this.physics.add.existing(scoreSensor, true); // static body
    scoreSensor.body.setAllowGravity(false);
    
    // Move sensor along with pipes
    this.tweens.add({
      targets: scoreSensor,
      x: -100,
      duration: 3500, // speed calculation
      onComplete: () => {
        scoreSensor.destroy();
      }
    });

    // Score trigger on overlap
    this.physics.add.overlap(this.player, scoreSensor, () => {
      scoreSensor.destroy();
      this.score += 1;
      this.scoreText.setText(this.score.toString());
      
      // Play score sound
      try {
        const pointSound = this.sound.get('point');
        if (pointSound) pointSound.play({ volume: 0.5 });
      } catch (e) {}

      // Pulse score text
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 100,
        yoyo: true
      });
    });
  }

  hitObstacle() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    // Pause physics
    this.physics.pause();
    this.spawnTimer.destroy();
    
    // Stop flap anim
    this.player.stop();

    // Play hit sound
    try {
      const hitSound = this.sound.get('hit');
      if (hitSound) hitSound.play({ volume: 0.5 });
    } catch (e) {}

    // Visual red hit tint
    this.player.setTint(0xff3333);
    
    // Shake camera
    this.cameras.main.shake(200, 0.02);

    // Delay 1.2s before going to Game Over Scene
    this.time.delayedCall(1200, () => {
      this.scene.start('GameOverScene', { score: this.score });
    });
  }
}

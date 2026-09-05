import Phaser from 'phaser';

export default class PlayScene extends Phaser.Scene {
  constructor() {
    super('PlayScene');
  }

  init() {
    this.score = 0;
    this.isGameOver = false;
    this.baseSpeed = -230;
    this.speedMultiplier = 1.0;
    
    // Pipe tracking array for 100% reliable scoring
    this.pipePairs = [];

    // Dash & Invincibility State
    this.isDashing = false;
    this.isInvincible = false;
    this.dashTimer = null;
    
    // Custom particle storage
    this.flameParticles = [];
    this.fxParticles = [];
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 0. Ensure Background Music is playing (especially when restarting from GameOverScene)
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
        console.warn('PlayScene BGM play failed:', e);
      }
    };

    if (this.sound.locked) {
      this.sound.once('unlocked', playBGM);
    } else {
      playBGM();
    }

    // 1. Scrolling background layers (Riverside sunset parallax)
    this.bgWall = this.add.tileSprite(0, 0, width, height, 'bg_wall').setOrigin(0, 0).setDepth(0);
    this.bgRiver = this.add.tileSprite(0, height - 160, width, 96, 'bg_river').setOrigin(0, 0).setDepth(1);
    this.bgGround = this.add.tileSprite(0, height - 64, width, 64, 'bg_ground').setOrigin(0, 0).setDepth(10);

    // 2. Logo in Top Left Corner (UX/UI brand placement)
    if (this.textures.exists('logo_pixelated')) {
      const cornerLogo = this.add.image(20, 20, 'logo_pixelated').setOrigin(0, 0).setDepth(20);
      cornerLogo.setScale(1.2);
      cornerLogo.setAlpha(0.65); // Semi-transparent
    }

    // 3. Atelier Rams Monospace Scoreboard Pill (Top-Center)
    this.scorePill = this.add.rectangle(width / 2, 54, 88, 42, 0x181615, 0.82)
      .setOrigin(0.5)
      .setDepth(99)
      .setStrokeStyle(1, 0x5C544D);

    this.scoreText = this.add.text(width / 2, 54, '0', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '26px',
      fill: '#FAF7F5',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

    // 4. Create Player (Cat - scaled up)
    this.player = this.physics.add.sprite(100, height / 2, 'cat');
    this.player.setScale(1.35); // 35% larger
    this.player.setFlipX(true); // Face right (direction of flight)
    this.player.setOrigin(0.5);
    this.player.setDepth(5);
    this.player.body.setGravityY(920); // gentle responsive gravity
    this.player.body.setCollideWorldBounds(false); // We handle boundary check manually
    
    // Forgiving capsule hitbox (prevents annoying edge clippings)
    this.player.body.setSize(16, 16);
    this.player.body.setOffset(8, 8);

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

    // 5. Obstacles (Satow Pods) Group
    this.satowGroup = this.physics.add.group();
    
    // Add collision between player and obstacles (disable physical resolution when dashing/invincible)
    this.physics.add.collider(
      this.player,
      this.satowGroup,
      this.hitObstacle,
      () => { return !this.isDashing && !this.isInvincible; },
      this
    );

    // Satow Bean Group & overlap handler
    this.beanGroup = this.physics.add.group();
    this.physics.add.overlap(this.player, this.beanGroup, this.collectBean, null, this);

    // Overlap handlers for dash effects when passing through obstacles/knives
    this.physics.add.overlap(this.player, this.satowGroup, this.dashOverlapObstacle, null, this);

    // 6. Timer to Spawn Obstacles
    this.spawnTimer = this.time.addEvent({
      delay: 1800,
      callback: this.spawnSatow,
      callbackScope: this,
      loop: true
    });

    // Spawn first obstacle immediately after short delay
    this.time.delayedCall(500, this.spawnSatow, [], this);

    // 7. Kitchen Knives Group & Hazard loop
    this.knifeGroup = this.physics.add.group();
    this.physics.add.collider(
      this.player,
      this.knifeGroup,
      this.hitObstacle,
      () => { return !this.isDashing && !this.isInvincible; },
      this
    );
    this.physics.add.overlap(this.player, this.knifeGroup, this.dashOverlapKnife, null, this);
    
    this.knifeTimer = this.time.addEvent({
      delay: 2800, // Check every 2.8 seconds
      callback: this.triggerKnifeHazard,
      callbackScope: this,
      loop: true
    });

    // 8. Score Sensors Group (Single overlap listener to prevent memory leak)
    this.scoreSensors = this.physics.add.group();
    this.physics.add.overlap(this.player, this.scoreSensors, this.handleScoreSensor, null, this);

    this.activeSensors = [];

    // 9. Tap / Input Listener
    this.input.on('pointerdown', this.flap, this);
  }

  update(time, delta) {
    if (this.isGameOver) return;

    // Scroll Backgrounds (faster when dashing)
    const scrollMultiplier = this.isDashing ? 2.5 : 1.0;
    this.bgWall.tilePositionX += 0.2 * scrollMultiplier;
    this.bgRiver.tilePositionX += 1.0 * scrollMultiplier;
    this.bgGround.tilePositionX += 2.5 * scrollMultiplier;

    // Smooth Cat Rotation/Angle slerp (Parabolic fluid Flappy flight arc)
    if (this.player.body.velocity.y < 0) {
      // Flapping up: smoothly ease angle towards -22 deg
      this.player.angle = Phaser.Math.Linear(this.player.angle, -22, 0.22);
    } else if (this.player.body.velocity.y > 0) {
      // Falling down: smoothly pitch towards +72 deg proportional to falling speed
      const targetDown = Math.min(72, (this.player.body.velocity.y / 480) * 72);
      this.player.angle = Phaser.Math.Linear(this.player.angle, targetDown, 0.09);
    }

    // Boundary check (hit ground/river or fly too high)
    const groundY = this.cameras.main.height - 160; // top of the river
    if (this.player.y > groundY - 18) {
      if (this.isDashing) {
        this.player.y = groundY - 18;
        this.player.body.setVelocityY(-150); // bounce up slightly
      } else {
        this.hitObstacle();
      }
    }
    if (this.player.y < -30) {
      if (this.isDashing) {
        this.player.y = -30;
        this.player.body.setVelocityY(150); // bounce down
      } else {
        this.hitObstacle();
      }
    }

    // Clean up offscreen obstacles safely
    const children = [...this.satowGroup.getChildren()];
    children.forEach((child) => {
      if (child && child.x < -100) {
        child.destroy();
      }
    });

    // Check pipe scoring by X position (100% reliable Flappy Bird scoring pattern)
    if (this.pipePairs) {
      for (let i = 0; i < this.pipePairs.length; i++) {
        const pair = this.pipePairs[i];
        if (!pair.scored && pair.top && pair.top.active) {
          if (pair.top.x <= this.player.x) {
            pair.scored = true;
            this.addScore();
          }
        }
      }
      this.pipePairs = this.pipePairs.filter(p => p.top && p.top.active && p.top.x > -100);
    }

    // Clean up offscreen kitchen knives
    if (this.knifeGroup) {
      this.knifeGroup.getChildren().forEach((knife) => {
        if (knife && knife.x < -50) {
          knife.destroy();
        }
      });
    }

    // Clean up offscreen beans
    if (this.beanGroup) {
      this.beanGroup.getChildren().forEach((bean) => {
        if (bean && bean.x < -100) {
          bean.destroy();
        }
      });
    }

    // Move obstacles vertically if score is >= 15
    this.satowGroup.getChildren().forEach((child) => {
      if (child && child.moving) {
        const elapsed = this.time.now - child.spawnTime;
        const scoreFactor = Math.max(0, this.score - 15);
        const frequency = 0.0025 + scoreFactor * 0.00015;
        const amplitude = Math.min(65, 30 + scoreFactor * 1.5);
        
        const offset = Math.sin(elapsed * frequency) * amplitude;
        child.y = child.initialY + offset;
      }
    });

    // Move active score sensors in sync
    if (this.activeSensors) {
      this.activeSensors = this.activeSensors.filter(s => s && s.active);
      this.activeSensors.forEach((sensor) => {
        if (sensor.moving) {
          const elapsed = this.time.now - sensor.spawnTime;
          const scoreFactor = Math.max(0, this.score - 15);
          const frequency = 0.0025 + scoreFactor * 0.00015;
          const amplitude = Math.min(65, 30 + scoreFactor * 1.5);
          const offset = Math.sin(elapsed * frequency) * amplitude;
          sensor.y = sensor.initialY + offset;
        }
      });
    }

    // Move active beans vertically if score is >= 15
    if (this.beanGroup) {
      this.beanGroup.getChildren().forEach((bean) => {
        if (bean && bean.moving) {
          const elapsed = this.time.now - bean.spawnTime;
          const scoreFactor = Math.max(0, this.score - 15);
          const frequency = 0.0025 + scoreFactor * 0.00015;
          const amplitude = Math.min(65, 30 + scoreFactor * 1.5);
          const offset = Math.sin(elapsed * frequency) * amplitude;
          bean.y = bean.initialY + offset;
        }
      });
    }

    // Spawn and update Jetpack Flame Particles
    if (this.isDashing) {
      // Spawn 3 flame particles per frame
      for (let i = 0; i < 3; i++) {
        const pX = this.player.x - (16 * this.player.scaleX) + Phaser.Math.Between(-4, 4);
        const pY = this.player.y + (2 * this.player.scaleY) + Phaser.Math.Between(-8, 8);
        const size = Phaser.Math.Between(4, 10) * (this.player.scaleX / 1.35);
        
        const rect = this.add.rectangle(pX, pY, size, size);
        rect.setDepth(4); // behind cat
        
        const colors = [0xff3333, 0xff9f00, 0xffea00, 0xffffff];
        const color = Phaser.Utils.Array.GetRandom(colors);
        rect.setFillStyle(color, 1.0);
        
        const vx = -Phaser.Math.Between(200, 500);
        const vy = Phaser.Math.Between(-50, 50);
        
        this.flameParticles.push({
          rect: rect,
          vx: vx,
          vy: vy,
          alpha: 1.0,
          scale: 1.0
        });
      }
    }

    // Update flame particles positions & shrink
    if (this.flameParticles && delta) {
      const dt = delta / 1000;
      this.flameParticles.forEach((p, idx) => {
        p.rect.x += p.vx * dt;
        p.rect.y += p.vy * dt;
        
        p.alpha -= 3.0 * dt;
        p.scale -= 2.0 * dt;
        
        if (p.alpha <= 0 || p.scale <= 0) {
          p.rect.destroy();
          this.flameParticles[idx] = null;
        } else {
          p.rect.setAlpha(p.alpha);
          p.rect.setScale(p.scale);
        }
      });
      this.flameParticles = this.flameParticles.filter(p => p !== null);
    }

    // Update FX particles (exploding debris from dash hits)
    if (this.fxParticles && delta) {
      const dt = delta / 1000;
      this.fxParticles.forEach((p, idx) => {
        p.rect.x += p.vx * dt;
        p.rect.y += p.vy * dt;
        
        // Add gravity to FX particles so they fall down naturally
        p.vy += 400 * dt;
        
        p.alpha -= 2.0 * dt;
        p.scale -= 1.5 * dt;
        
        if (p.alpha <= 0 || p.scale <= 0) {
          p.rect.destroy();
          this.fxParticles[idx] = null;
        } else {
          p.rect.setAlpha(p.alpha);
          p.rect.setScale(p.scale);
        }
      });
      this.fxParticles = this.fxParticles.filter(p => p !== null);
    }
  }

  flap() {
    if (this.isGameOver) return;

    // Set upward velocity
    this.player.body.setVelocityY(-315); // finely tuned responsive jump velocity

    // Play jump sound & mobile tactile haptic
    try { this.sound.play('jump', { volume: 0.4 }); } catch (e) {}
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(12); } catch (e) {}
    }

    // Subtle jump squish effect scaled properly
    const targetScale = this.isDashing ? 2.7 : 1.35;
    const squishScaleY = targetScale * 0.78;
    const squishScaleX = targetScale * 1.15;

    this.tweens.add({
      targets: this.player,
      scaleY: squishScaleY,
      scaleX: squishScaleX,
      duration: 75,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!this.isGameOver) {
          const resetScale = this.isDashing ? 2.7 : 1.35;
          this.player.scaleY = resetScale;
          this.player.scaleX = resetScale;
        }
      }
    });
  }

  spawnSatow() {
    if (this.isGameOver) return;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Spawning parameters - Narrows gap progressively based on score (starts at 170px, shrinks to 125px)
    const gap = Math.max(125, 170 - this.score * 2.5);
    const minHeight = 40; // Random heights go significantly higher/lower
    const maxHeight = height - 64 - gap - minHeight;
    const gapY = Phaser.Math.Between(minHeight, maxHeight);

    const spawnX = width + 64;
    const speed = this.baseSpeed * this.speedMultiplier; // Obstacle velocity scales up

    // 1. Top Satow (hanging down)
    const topSatow = this.physics.add.sprite(spawnX, gapY, 'satow_pod');
    this.satowGroup.add(topSatow);
    topSatow.setOrigin(0.5, 1); // Align at bottom edge of top pipe
    topSatow.setFlipY(true);    // Point downward
    topSatow.body.allowGravity = false;
    topSatow.body.setImmovable(true);
    topSatow.body.setVelocityX(speed);
    
    // Forgiving hitbox (avoids edge snagging)
    topSatow.body.setSize(36, 128);
    topSatow.body.setOffset(14, 0);
    // Stretch graphic height to fit
    topSatow.setDisplaySize(64, gapY);

    // Set scoring metadata for 100% reliable crossing check
    topSatow.isTopPipe = true;
    topSatow.hasScored = false;

    // Set movement coordinates
    topSatow.initialY = gapY;
    topSatow.moving = this.score >= 15;
    topSatow.spawnTime = this.time.now;

    // 2. Bottom Satow (pointing up)
    const bottomHeight = height - 64 - (gapY + gap);
    const bottomSatow = this.physics.add.sprite(spawnX, gapY + gap, 'satow_pod');
    this.satowGroup.add(bottomSatow);
    bottomSatow.setOrigin(0.5, 0); // Align at top edge of bottom pipe
    bottomSatow.body.allowGravity = false;
    bottomSatow.body.setImmovable(true);
    bottomSatow.body.setVelocityX(speed);
    
    // Forgiving hitbox
    bottomSatow.body.setSize(36, 128);
    bottomSatow.body.setOffset(14, 0);
    bottomSatow.setDisplaySize(64, bottomHeight);

    // Set movement coordinates
    bottomSatow.initialY = gapY + gap;
    bottomSatow.moving = this.score >= 15;
    bottomSatow.spawnTime = this.time.now;

    // 3. Invisible score sensor zone (placed between pipes)
    const scoreSensor = this.add.rectangle(spawnX + 32, gapY + gap / 2, 10, gap);
    this.physics.add.existing(scoreSensor); // dynamic body
    scoreSensor.body.allowGravity = false;
    scoreSensor.body.setVelocityX(speed);
    
    // Set movement coordinates
    scoreSensor.initialY = gapY + gap / 2;
    scoreSensor.moving = this.score >= 15;
    scoreSensor.spawnTime = this.time.now;
    if (this.scoreSensors) {
      this.scoreSensors.add(scoreSensor);
    }
    if (this.activeSensors) {
      this.activeSensors.push(scoreSensor);
    }
    
    // Register pipe pair for foolproof scoring
    if (this.pipePairs) {
      this.pipePairs.push({
        top: topSatow,
        bottom: bottomSatow,
        sensor: scoreSensor,
        scored: false
      });
    }

    // Destroy sensor after it goes offscreen (4 seconds is plenty to go from spawn to left screen edge)
    this.time.delayedCall(4000, () => {
      if (scoreSensor && scoreSensor.active) {
        scoreSensor.destroy();
      }
    });

    // 4. Spawning a Satow Bean with 10% probability in the middle of the gap (rare item)
    if (Phaser.Math.Between(1, 100) <= 10) {
      const bean = this.physics.add.sprite(spawnX, gapY + gap / 2, 'satow_bean');
      this.beanGroup.add(bean);
      bean.body.allowGravity = false;
      bean.body.setImmovable(true);
      bean.body.setVelocityX(speed);
      
      bean.initialY = gapY + gap / 2;
      bean.moving = this.score >= 15;
      bean.spawnTime = this.time.now;
      
      bean.setScale(1.5);
    }
  }

  addScore() {
    if (this.isGameOver) return;

    this.score += 1;
    if (this.scoreText) {
      this.scoreText.setText(this.score.toString());
      if (this.scorePill) {
        const digits = this.score.toString().length;
        this.scorePill.width = Math.max(88, 64 + digits * 18);
      }
      this.tweens.add({
        targets: [this.scoreText, this.scorePill],
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 75,
        yoyo: true,
        ease: 'Quad.easeOut'
      });
    }

    // Play score sound & mobile haptics
    try { this.sound.play('point', { volume: 0.5 }); } catch (e) {}
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15); } catch (e) {}
    }

    // Floating Score Popup Effect (+1) in Atelier Terracotta
    const popup = this.add.text(this.player.x + 24, this.player.y - 14, '+1', {
      fontFamily: '"Geist Mono", "Space Mono", monospace',
      fontSize: '18px',
      fill: '#BD4924',
      stroke: '#181615',
      strokeThickness: 4,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(110);

    this.tweens.add({
      targets: popup,
      y: popup.y - 32,
      alpha: 0,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy()
    });

    // Increase speed difficulty recursively on score if not dashing
    if (!this.isDashing) {
      this.speedMultiplier = Math.min(1.8, 1.0 + this.score * 0.05);
    }
    
    // Scale spawn delay to maintain horizontal obstacle gaps
    try {
      if (this.spawnTimer) {
        const newDelay = 1800 / this.speedMultiplier;
        this.spawnTimer.delay = newDelay;
      }
      if (this.knifeTimer) {
        this.knifeTimer.delay = Math.max(1200, 2800 - this.score * 120);
      }
    } catch (e) {}
    
    // Instantly accelerate active obstacles
    const currentSpeed = this.baseSpeed * this.speedMultiplier;
    this.satowGroup.getChildren().forEach((child) => {
      if (child && child.body) {
        child.body.setVelocityX(currentSpeed);
      }
    });
    
    if (this.beanGroup) {
      this.beanGroup.getChildren().forEach((bean) => {
        if (bean && bean.body) {
          bean.body.setVelocityX(currentSpeed);
        }
      });
    }
    
    if (this.knifeGroup) {
      this.knifeGroup.getChildren().forEach((knife) => {
        if (knife && knife.body) {
          knife.body.setVelocityX(currentSpeed * 1.5);
        }
      });
    }

    if (this.scoreSensors) {
      this.scoreSensors.getChildren().forEach((s) => {
        if (s && s.body) {
          s.body.setVelocityX(currentSpeed);
        }
      });
    }
  }

  handleScoreSensor(player, sensor) {
    if (this.isGameOver) return;
    if (sensor && sensor.active) {
      // If crossing detection didn't trigger yet, trigger here as backup
      if (this.pipePairs) {
        const pair = this.pipePairs.find(p => p.sensor === sensor);
        if (pair && !pair.scored) {
          pair.scored = true;
          this.addScore();
        }
      }
      sensor.destroy();
    }
  }

  triggerKnifeHazard() {
    if (this.isGameOver || this.score < 3) return;
    
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Choose a random height for the knife (aligned to where the cat flies)
    const minHeight = 80;
    const maxHeight = height - 140;
    const targetY = Phaser.Math.Between(minHeight, maxHeight);
    
    // Show Warning Icon flashing at the right edge
    const warningX = width - 40;
    const warningIcon = this.add.image(warningX, targetY, 'warning_icon').setDepth(20);
    warningIcon.setScale(1.5);
    
    // Flashing warning sign (blinks 3 times)
    this.tweens.add({
      targets: warningIcon,
      alpha: 0.1,
      duration: 150,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        warningIcon.destroy();
        if (!this.isGameOver) {
          this.spawnKnife(targetY);
        }
      }
    });
  }

  spawnKnife(targetY) {
    const width = this.cameras.main.width;
    const spawnX = width + 32;
    const knife = this.physics.add.sprite(spawnX, targetY, 'kitchen_knife');
    this.knifeGroup.add(knife);
    
    knife.body.allowGravity = false;
    knife.body.setImmovable(true);
    
    // Knife is 50% faster than standard Satow obstacles
    const knifeSpeed = this.baseSpeed * this.speedMultiplier * 1.5;
    knife.body.setVelocityX(knifeSpeed);
    
    // Spin the knife!
    knife.body.setAngularVelocity(360);
    
    // Setup forgiving custom hitbox
    knife.body.setSize(18, 10);
    knife.body.setOffset(7, 11);
    
    knife.setDepth(15);
  }

  hitObstacle() {
    if (this.isGameOver || this.isDashing || this.isInvincible) return;
    this.isGameOver = true;

    // Mobile tactile feedback on collision
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 50, 40]); } catch (e) {}
    }

    // Pause physics and timers
    this.physics.pause();
    this.spawnTimer.destroy();
    if (this.knifeTimer) this.knifeTimer.destroy();
    
    // Stop flap anim
    this.player.stop();

    // Clean up flame particles
    if (this.flameParticles) {
      this.flameParticles.forEach(p => {
        if (p && p.rect) p.rect.destroy();
      });
      this.flameParticles = [];
    }

    // Stop BGM immediately on death so hit SFX & Game Over impact feel punchy
    try {
      const bgm = this.sound.get('bgm');
      if (bgm && bgm.isPlaying) {
        bgm.stop();
      }
    } catch (e) {}

    // Play hit sound
    try { this.sound.play('hit', { volume: 0.5 }); } catch (e) {}

    // Visual terracotta / red hit tint
    this.player.setTint(0xff5544);

    // Spawn impact debris particles (cat fur orange/white & satow pod green)
    const pX = this.player.x;
    const pY = this.player.y;
    for (let i = 0; i < 18; i++) {
      const size = Phaser.Math.Between(3, 7);
      const rect = this.add.rectangle(pX, pY, size, size).setDepth(20);
      const colors = [0xff9f43, 0xd35400, 0xffffff, 0x39FF14, 0x006400, 0xBD4924];
      rect.setFillStyle(Phaser.Utils.Array.GetRandom(colors), 1.0);
      
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(80, 300);
      this.fxParticles.push({
        rect,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        alpha: 1.0,
        scale: 1.0
      });
    }

    // Micro freeze-frame (60ms) before screen shake & flash for punchy weight
    this.time.delayedCall(60, () => {
      this.cameras.main.shake(220, 0.022);
      this.cameras.main.flash(100, 189, 73, 36, true); // Warm terracotta flash
    });

    // Delay 1.1s before transitioning to Game Over Scene
    this.time.delayedCall(1100, () => {
      this.scene.start('GameOverScene', { score: this.score });
    });
  }

  collectBean(player, bean) {
    if (this.isGameOver) return;
    
    // Destroy the bean
    bean.destroy();
    
    // Play point/collect sound & tactile haptic
    try { this.sound.play('point', { volume: 0.6 }); } catch (e) {}
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([25, 35]); } catch (e) {}
    }
    
    // Set dash state
    this.isDashing = true;
    
    // Giant scale animation
    this.tweens.add({
      targets: this.player,
      scaleX: 2.7,
      scaleY: 2.7,
      duration: 200,
      ease: 'Quad.easeOut'
    });
    
    // Boost speed multiplier
    this.speedMultiplier = 2.5;
    
    // Accelerate everything
    const currentSpeed = this.baseSpeed * this.speedMultiplier;
    this.satowGroup.getChildren().forEach((child) => {
      if (child.body) {
        child.body.setVelocityX(currentSpeed);
      }
    });
    if (this.beanGroup) {
      this.beanGroup.getChildren().forEach((b) => {
        if (b.body) {
          b.body.setVelocityX(currentSpeed);
        }
      });
    }
    if (this.knifeGroup) {
      this.knifeGroup.getChildren().forEach((knife) => {
        if (knife.body) {
          knife.body.setVelocityX(currentSpeed * 1.5);
        }
      });
    }
    
    // Set timer to end dash after 2 seconds (2000 ms)
    if (this.dashTimer) {
      this.dashTimer.destroy();
    }
    this.dashTimer = this.time.delayedCall(2000, this.endDash, [], this);
  }

  endDash() {
    if (this.isGameOver) return;
    
    this.isDashing = false;
    
    // Shrink scale animation
    this.tweens.add({
      targets: this.player,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 300,
      ease: 'Quad.easeOut'
    });
    
    // Revert speed multiplier based on current score
    this.speedMultiplier = Math.min(1.8, 1.0 + this.score * 0.05);
    
    // Revert speed of active elements
    const currentSpeed = this.baseSpeed * this.speedMultiplier;
    this.satowGroup.getChildren().forEach((child) => {
      if (child.body) {
        child.body.setVelocityX(currentSpeed);
      }
    });
    if (this.beanGroup) {
      this.beanGroup.getChildren().forEach((b) => {
        if (b.body) {
          b.body.setVelocityX(currentSpeed);
        }
      });
    }
    if (this.knifeGroup) {
      this.knifeGroup.getChildren().forEach((knife) => {
        if (knife.body) {
          knife.body.setVelocityX(currentSpeed * 1.5);
        }
      });
    }
    
    // Safety invincibility blink (0.5 seconds)
    this.isInvincible = true;
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        this.player.alpha = 1.0;
        this.isInvincible = false;
      }
    });
  }

  dashOverlapObstacle(player, obstacle) {
    if (this.isGameOver) return;
    if (this.isDashing || this.isInvincible) {
      if (!obstacle.fxTriggered) {
        obstacle.fxTriggered = true;
        
        // Visual impact screen shake
        this.cameras.main.shake(100, 0.005);
        
        // Spawn 15 pixel debris particles (green, yellow, white)
        const fxX = player.x + 32;
        const fxY = player.y;
        for (let i = 0; i < 15; i++) {
          const size = Phaser.Math.Between(4, 8);
          const rect = this.add.rectangle(fxX, fxY, size, size);
          rect.setDepth(15); // front
          
          const colors = [0x39FF14, 0x006400, 0xFFD700, 0xffffff];
          const color = Phaser.Utils.Array.GetRandom(colors);
          rect.setFillStyle(color, 1.0);
          
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const speed = Phaser.Math.Between(100, 300);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          this.fxParticles.push({
            rect: rect,
            vx: vx,
            vy: vy,
            alpha: 1.0,
            scale: 1.0
          });
        }
      }
    }
  }

  dashOverlapKnife(player, knife) {
    if (this.isGameOver) return;
    if (this.isDashing || this.isInvincible) {
      if (!knife.fxTriggered) {
        knife.fxTriggered = true;
        
        this.cameras.main.shake(100, 0.005);
        
        // Spawn 10 steel spark particles (white, silver, light-blue)
        const fxX = player.x + 32;
        const fxY = player.y;
        for (let i = 0; i < 10; i++) {
          const size = Phaser.Math.Between(3, 6);
          const rect = this.add.rectangle(fxX, fxY, size, size);
          rect.setDepth(15);
          
          const colors = [0xffffff, 0xa5b1c2, 0x778ca3, 0xffea00];
          const color = Phaser.Utils.Array.GetRandom(colors);
          rect.setFillStyle(color, 1.0);
          
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const speed = Phaser.Math.Between(120, 350);
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          
          this.fxParticles.push({
            rect: rect,
            vx: vx,
            vy: vy,
            alpha: 1.0,
            scale: 1.0
          });
        }
      }
    }
  }
}

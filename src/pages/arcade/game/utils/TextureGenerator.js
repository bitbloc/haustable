/**
 * TextureGenerator.js
 * Generates retro pixel art textures dynamically on an HTML Canvas.
 * This provides out-of-the-box assets for the game (Cat, Satow Obstacle, and Background)
 * without requiring external file loading.
 */

export function generateGameTextures(scene) {
  // 1. Generate Flappy Cat Spritesheet (64x32 canvas, two 32x32 frames)
  if (!scene.textures.exists('cat_sheet')) {
    const width = 64;
    const height = 32;
    const canvasTexture = scene.textures.createCanvas('cat_sheet', width, height);
    const ctx = canvasTexture.context;
    
    // Define pixel color palette
    const colors = {
      'W': '#FFFFFF', // White (body)
      'B': '#1A1D20', // Black/dark outline
      'P': '#FFA6B9', // Pink (ears inner)
      'G': '#D2D7DF', // Gray shading
      '.': null      // Transparent
    };
    
    // Frame 1: Legs Extended
    const frame1 = [
      "................................",
      "..........................BB....",
      ".........................BWWB...",
      "........................BWWB....",
      ".......................BWWB.....",
      "....B.......B.........BWWB......",
      "...BPB.....BPB.......BWWB.......",
      "..BPPB....BPPB......BWWB........",
      "..BPPWBBBBWPPB.....BWWB.........",
      ".BWWWWWWWWWWWWBBBBBWWb..........",
      "BWWWWWWWWWWWWWWWWWWWWb..........",
      "BWWWWWWWWWWWWWWWWWWWWWb.........",
      "BWWWWWWWWWWWWWWWWWWWWWWb........",
      "B.B..W.B.WWWWWWWWWWWWWWWb.......",
      "B.B..W.B.WWWWWWWWWWWWWWWWb......",
      "BWWWWWWWWWWWWWWWWWWWWWWWWWb.....",
      "BWWWWWWWWWWWWWWWWWWWWWWWWWWb....",
      ".BWWWWWWWWWWWWWWWWWWWWWWWWWWb...",
      "..BBWWWWWWWWWWWWWWWWWWWWWWWWWb..",
      "....BWWWWWWWWWWWWWWWWWWWWWWWWWb.",
      "....BWWWWWWWWWWWWWWWWWWWWWWWWb..",
      "....BWWWWWWWWWWWWWWWWWWWWWWWb...",
      "....BGGGGWWWWWWWWWWGGGGGGGGb....",
      "....BGGGGWb.BGGGWb.BGGGGGGb.....",
      "....BGGGGWb.BGGGWb.BGGGGGGb.....",
      "....BGGGGWb.BGGGWb.BGGGGGGb.....",
      "....BGGGGWb.BGGGWb.BGGGGGGb.....",
      "....BGGGGb...BGGb...BGGGGb......",
      "....BBBBb.....BB.....BBBBb......",
      "................................",
      "................................",
      "................................"
    ].map(line => line.replaceAll('b', 'B'));

    // Frame 2: Legs Bent (animation state)
    const frame2 = [
      "................................",
      ".........................BB.....",
      "........................BWWB....",
      ".......................BWWB.....",
      "......................BWWB......",
      "....B.......B........BWWB.......",
      "...BPB.....BPB......BWWB........",
      "..BPPB....BPPB.....BWWB.........",
      "..BPPWBBBBWPPB....BWWB..........",
      ".BWWWWWWWWWWWWBBBBWWB...........",
      "BWWWWWWWWWWWWWWWWWWWB...........",
      "BWWWWWWWWWWWWWWWWWWWWb..........",
      "BWWWWWWWWWWWWWWWWWWWWWb.........",
      "B.B..W.B.WWWWWWWWWWWWWWb........",
      "B.B..W.B.WWWWWWWWWWWWWWWb.......",
      "BWWWWWWWWWWWWWWWWWWWWWWWWb......",
      "BWWWWWWWWWWWWWWWWWWWWWWWWWb.....",
      ".BWWWWWWWWWWWWWWWWWWWWWWWWWb....",
      "..BBWWWWWWWWWWWWWWWWWWWWWWWWb...",
      "....BWWWWWWWWWWWWWWWWWWWWWWWWb..",
      "....BWWWWWWWWWWWWWWWWWWWWWWWWb..",
      "....BWWWWWWWWWWWWWWWWWWWWWWWb...",
      "....BGGGGWWWWWWWWWWGGGGGGGGb....",
      "....BGGGGWb.BGGGWb.BGGGGGGb.....",
      "....BGGGGWb.BGGGWb.BGGGGGGb.....",
      "....BGGGGWb.BGGGWb.BGGGGGGb.....",
      "....BGGGGWb.BGGGWb.BGGGGGGb.....",
      "....BGGGGb...BGGb...BGGGGb......",
      "....BBBBb.....BB.....BBBBb......",
      "................................",
      "................................",
      "................................"
    ].map(line => line.replaceAll('b', 'B'));

    const pixelSize = 1; // 1x1 screen pixels per sprite pixel
    
    // Draw Frame 1
    for (let r = 0; r < 32; r++) {
      for (let c = 0; c < 32; c++) {
        const char = frame1[r][c];
        const color = colors[char];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
        }
      }
    }

    // Draw Frame 2
    for (let r = 0; r < 32; r++) {
      for (let c = 0; c < 32; c++) {
        const char = frame2[r][c];
        const color = colors[char];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(32 + c * pixelSize, r * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    
    canvasTexture.refresh();
    
    // Define the spritesheet frame coordinates
    scene.textures.addSpriteSheet('cat', canvasTexture.canvas, {
      frameWidth: 32,
      frameHeight: 32
    });
  }

  // 2. Generate Giant Satow Obstacles (Green Pod with yellow beans)
  if (!scene.textures.exists('satow_pod')) {
    const width = 64;
    const height = 128;
    const canvasTexture = scene.textures.createCanvas('satow_pod', width, height);
    const ctx = canvasTexture.context;
    
    // Palette
    const colors = {
      'G': '#39FF14', // Bright Lime Green
      'D': '#006400', // Dark Green border
      'Y': '#FFD700', // Gold/Yellow (สะตอ beans)
      'K': '#1A330E', // Inner shadow
      '.': null
    };

    // A wavy green pod pattern
    const pattern = [
      "..DDDDDD..",
      ".DGGGGGGD.",
      "DGGYYYGGGD",
      "DGYYYYYYGD",
      "DGYYYYYYKD",
      "DGGYYYGKKD",
      "DGGGGGKKKD",
      ".DKKKKKKD.",
      "..DDDDDD.."
    ];

    const px = 4; // 4x4 canvas pixels per pattern cell
    
    ctx.clearRect(0, 0, width, height);
    
    // Tile the pattern vertically to create a long pod
    for (let tile = 0; tile < 3; tile++) {
      const yOffset = tile * 40;
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < pattern[r].length; c++) {
          const char = pattern[r][c];
          const color = colors[char];
          if (color) {
            ctx.fillStyle = color;
            // Center the pod horizontally
            ctx.fillRect(12 + c * px, yOffset + r * px, px, px);
          }
        }
      }
    }
    
    // Draw connection stems on top and bottom
    ctx.fillStyle = '#006400';
    ctx.fillRect(28, 0, 8, 128); // Stem center line
    
    canvasTexture.refresh();
  }

  // 3. Generate Parallax Background Layer 1: Retro Neon Wall Grid
  if (!scene.textures.exists('bg_wall')) {
    const width = 128;
    const height = 128;
    const canvasTexture = scene.textures.createCanvas('bg_wall', width, height);
    const ctx = canvasTexture.context;
    
    // Neon purple grid background
    ctx.fillStyle = '#110022';
    ctx.fillRect(0, 0, width, height);
    
    // Draw vertical and horizontal grid lines
    ctx.strokeStyle = '#8b00ff';
    ctx.lineWidth = 1;
    
    // Draw lines
    ctx.beginPath();
    for (let x = 0; x <= width; x += 32) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 32) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Add some random bright pixel stars
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(10, 20, 2, 2);
    ctx.fillRect(75, 45, 2, 2);
    ctx.fillRect(40, 90, 2, 2);
    ctx.fillStyle = '#DFFF00';
    ctx.fillRect(110, 15, 2, 2);
    ctx.fillRect(20, 70, 2, 2);
    
    canvasTexture.refresh();
  }

  // 4. Generate Parallax Background Layer 2: Neon Checkerboard Floor (Ground)
  if (!scene.textures.exists('bg_ground')) {
    const width = 64;
    const height = 64;
    const canvasTexture = scene.textures.createCanvas('bg_ground', width, height);
    const ctx = canvasTexture.context;
    
    // Checkerboard ground pattern in neon purple and yellow-green
    ctx.fillStyle = '#39FF14'; // Neon Lime Green top border
    ctx.fillRect(0, 0, width, 4);
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 4, width, height - 4);
    
    // Draw checker lines
    ctx.strokeStyle = '#DFFF00';
    ctx.lineWidth = 1.5;
    
    // Draw perspective lines
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, height);
    ctx.moveTo(16, 4);
    ctx.lineTo(8, height);
    ctx.moveTo(32, 4);
    ctx.lineTo(32, height);
    ctx.moveTo(48, 4);
    ctx.lineTo(56, height);
    ctx.moveTo(64, 4);
    ctx.lineTo(64, height);
    
    // Horizontal perspective lines
    for (let y = 4; y < height; y += 12) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    
    canvasTexture.refresh();
  }
}

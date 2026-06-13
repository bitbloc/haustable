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

  // 3. Generate Parallax Background Layer 1: Retro Sunset Sky (replaces neon wall grid)
  if (!scene.textures.exists('bg_wall')) {
    const width = 256;
    const height = 700;
    const canvasTexture = scene.textures.createCanvas('bg_wall', width, height);
    const ctx = canvasTexture.context;
    
    // Sunset gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#090514');   // Deep night space purple
    grad.addColorStop(0.35, '#2c0c30'); // Dark magenta-purple
    grad.addColorStop(0.65, '#80183b'); // Dusk pink
    grad.addColorStop(0.85, '#cc441b'); // Horizon orange
    grad.addColorStop(1.0, '#ff9f43');  // Sunset yellow-orange
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    
    // Draw retrowave sun
    const sunX = 128;
    const sunY = 500;
    const sunR = 55;
    
    // Sun orange-yellow gradient
    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, '#ffbe76');
    sunGrad.addColorStop(1, '#ff3838');
    ctx.fillStyle = sunGrad;
    
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    
    // Retrowave horizontal scanlines cutting through the sun (using destination-out for transparency)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    for (let y = sunY - sunR; y <= sunY + sunR; y += 8) {
      if (y > sunY - 20) {
        const lineThickness = Math.max(1, Math.round(1.5 + (y - sunY) * 0.08));
        ctx.fillRect(sunX - sunR - 10, y, (sunR + 10) * 2, lineThickness);
      }
    }
    ctx.globalCompositeOperation = 'source-over'; // restore
    
    // Draw distant mountains/hills silhouette
    ctx.fillStyle = '#180824';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(40, 510);
    ctx.lineTo(80, 540);
    ctx.lineTo(120, 520);
    ctx.lineTo(160, 540);
    ctx.lineTo(200, 505);
    ctx.lineTo(256, 540);
    ctx.lineTo(256, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    
    // Draw simple palm tree silhouettes
    ctx.fillStyle = '#0f0518';
    const drawPalm = (px, py, scale) => {
      ctx.fillRect(px - Math.round(1 * scale), py, Math.round(2 * scale), Math.round(50 * scale)); // trunk
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px - Math.round(15 * scale), py + Math.round(5 * scale), px - Math.round(20 * scale), py + Math.round(15 * scale));
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.round(15 * scale), py + Math.round(5 * scale), px + Math.round(20 * scale), py + Math.round(15 * scale));
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px - Math.round(10 * scale), py - Math.round(5 * scale), px - Math.round(15 * scale), py + Math.round(5 * scale));
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.round(10 * scale), py - Math.round(5 * scale), px + Math.round(15 * scale), py + Math.round(5 * scale));
      ctx.lineWidth = Math.round(2 * scale);
      ctx.strokeStyle = '#0f0518';
      ctx.stroke();
    };
    drawPalm(30, 490, 0.8);
    drawPalm(220, 480, 1.1);
    
    canvasTexture.refresh();
  }

  // 4. Generate Parallax Background Layer 2: Scrolling River
  if (!scene.textures.exists('bg_river')) {
    const width = 128;
    const height = 96;
    const canvasTexture = scene.textures.createCanvas('bg_river', width, height);
    const ctx = canvasTexture.context;
    
    ctx.fillStyle = '#0f223a'; // Dark river blue-teal
    ctx.fillRect(0, 0, width, height);
    
    // Draw styled river wave lines that wrap around
    const drawWave = (wx, wy, wlen, color) => {
      ctx.fillStyle = color;
      const drawSegment = (x) => {
        ctx.fillRect(x, wy, wlen, 2);
        ctx.fillRect(x + 2, wy + 2, wlen - 4, 1);
      };
      
      drawSegment(wx);
      if (wx + wlen > width) {
        drawSegment(wx - width);
      }
    };
    
    // Waves pattern (cyan highlights, sunset orange reflections, dark water depths)
    const waves = [
      { x: 10, y: 10, len: 30, c: '#1c3d5a' },
      { x: 70, y: 15, len: 40, c: '#1c3d5a' },
      { x: 40, y: 25, len: 25, c: '#00d2d3' },
      { x: 95, y: 30, len: 35, c: '#1c3d5a' },
      { x: 5, y: 40, len: 45, c: '#ff9f43' },
      { x: 80, y: 45, len: 20, c: '#00d2d3' },
      { x: 30, y: 55, len: 35, c: '#1c3d5a' },
      { x: 110, y: 60, len: 25, c: '#ff9f43' },
      { x: 50, y: 70, len: 50, c: '#00d2d3' },
      { x: 5, y: 80, len: 30, c: '#1c3d5a' },
      { x: 90, y: 85, len: 30, c: '#ff9f43' }
    ];
    waves.forEach(w => drawWave(w.x, w.y, w.len, w.c));
    
    canvasTexture.refresh();
  }

  // 5. Generate Parallax Background Layer 3: Wood Pier (Ground)
  if (!scene.textures.exists('bg_ground')) {
    const width = 64;
    const height = 64;
    const canvasTexture = scene.textures.createCanvas('bg_ground', width, height);
    const ctx = canvasTexture.context;
    
    ctx.fillStyle = '#2c1a16'; // Dark wood brown
    ctx.fillRect(0, 0, width, height);
    
    // Horizontal borders of planks (Y = 0, 16, 32, 48, 64)
    ctx.fillStyle = '#140c0a'; // Black outline
    for (let y = 0; y < height; y += 16) {
      ctx.fillRect(0, y, width, 2);
    }
    
    // Highlight edges on planks
    ctx.fillStyle = '#422a25'; // Light brown highlight
    for (let y = 2; y < height; y += 16) {
      ctx.fillRect(0, y, width, 1);
    }
    
    // Glowing neon yellow screw/nail heads matching brand accent
    ctx.fillStyle = '#DFFF00';
    for (let x = 12; x < width; x += 32) {
      for (let y = 8; y < height; y += 16) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
    
    // Subtle vertical wood gaps (offset per row)
    ctx.fillStyle = '#140c0a';
    ctx.fillRect(20, 0, 2, 16);
    ctx.fillRect(48, 16, 2, 16);
    ctx.fillRect(10, 32, 2, 16);
    ctx.fillRect(38, 48, 2, 16);
    
    canvasTexture.refresh();
  }

  // 6. Generate Kitchen Knife Sprite (32x32 canvas, centered knife to rotate without clipping)
  if (!scene.textures.exists('kitchen_knife')) {
    const width = 32;
    const height = 32;
    const canvasTexture = scene.textures.createCanvas('kitchen_knife', width, height);
    const ctx = canvasTexture.context;
    
    const colors = {
      'W': '#FFFFFF', // Blade highlights
      'S': '#A5B1C2', // Silver blade
      'D': '#778CA3', // Dark blade shadow
      'B': '#1E272E', // Black outline
      'H': '#8C5A3C', // Wooden handle
      'K': '#5C3A21', // Dark handle shadow
      '.': null
    };

    const knifePattern = [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      ".............BBBBBBBBBB.........",
      "...........BBWWWWWWWWWSB........",
      "..........BWWWWWWWWWWWSB........",
      "...BBBBBBBWWWWWWWWWWWDDB........",
      "..BHHHHHHHWWWWWWWWWWWDDB........",
      "..BKKKKKKKBBBBBBBBBBBBB.........",
      "...BBBBBBB......................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................"
    ];

    ctx.clearRect(0, 0, width, height);
    for (let r = 0; r < 32; r++) {
      for (let c = 0; c < 32; c++) {
        const char = knifePattern[r][c];
        const color = colors[char];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c, r, 1, 1);
        }
      }
    }
    canvasTexture.refresh();
  }

  // 7. Generate Warning Icon Sprite (32x32 warning sign)
  if (!scene.textures.exists('warning_icon')) {
    const width = 32;
    const height = 32;
    const canvasTexture = scene.textures.createCanvas('warning_icon', width, height);
    const ctx = canvasTexture.context;
    
    const colors = {
      'Y': '#DFFF00', // Brand Lime-yellow
      'B': '#000000', // Black text/outline
      '.': null
    };

    const warningPattern = [
      "...............BB...............",
      "..............BYYB..............",
      ".............BYYYYB.............",
      "............BYYYYYYB............",
      "...........BYYYBYYYYB...........",
      "..........BYYYBBBYYYYB..........",
      ".........BYYYBBBBYYYYB..........",
      "........BYYYBBBBBYYYYBB.........",
      ".......BYYYYBBBBBYYYYYBB........",
      "......BYYYYYBBBBBYYYYYYBB.......",
      ".....BYYYYYYBBBBBYYYYYYYBB......",
      "....BYYYYYYYBBBBBYYYYYYYYBB.....",
      "...BYYYYYYYYYBBYYYYYYYYYYBB....",
      "..BYYYYYYYYYYBYYYYYYYYYYYYBB...",
      "..BYYYYYYYYYYBYYYYYYYYYYYYBB...",
      "..BYYYYYYYYYBBBYYYYYYYYYYYBB...",
      "..BYYYYYYYYYBBBYYYYYYYYYYYBB...",
      "..BYYYYYYYYYYBYYYYYYYYYYYYBB...",
      "..BYYYYYYYYYYYYYYYYYYYYYYYBB...",
      "...BYYYYYYYYYBBBYYYYYYYYYYBB....",
      "....BYYYYYYYYBBBYYYYYYYYYBB.....",
      ".....BYYYYYYYBBBYYYYYYYYBB......",
      "......BYYYYYYBBBYYYYYYYBB.......",
      ".......BYYYYYYYYYYYYYYBB........",
      "........BYYYYYYYYYYYYBB.........",
      ".........BYYYYYYYYYYBB..........",
      "..........BYYYYYYYYBB...........",
      "...........BYYYYYYBB............",
      "............BYYYYBB.............",
      ".............BYYBB..............",
      "..............BB................",
      "................................"
    ];

    ctx.clearRect(0, 0, width, height);
    for (let r = 0; r < 32; r++) {
      for (let c = 0; c < 32; c++) {
        const char = warningPattern[r][c];
        const color = colors[char];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c, r, 1, 1);
        }
      }
    }
    canvasTexture.refresh();
  }
}

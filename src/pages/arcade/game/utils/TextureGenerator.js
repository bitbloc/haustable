/**
 * TextureGenerator.js
 * Generates retro pixel art textures dynamically on an HTML Canvas.
 * This provides out-of-the-box assets for the game (Cat, Satow Obstacle, and Background)
 * without requiring external file loading.
 */

export function generateGameTextures(scene) {
  // 1. Generate Flappy Cat Spritesheet (64x32 canvas, two 32x32 Pop-Pixel frames)
  if (!scene.textures.exists('cat_sheet')) {
    const width = 64;
    const height = 32;
    const canvasTexture = scene.textures.createCanvas('cat_sheet', width, height);
    const ctx = canvasTexture.context;
    
    // Define Pop-Pixel color palette (Vibrant Orange Cat + Haus Terracotta Collar & Golden Bell)
    const colors = {
      'W': '#FF9F43', // Vibrant Pop Orange body
      'H': '#FFBE76', // Warm cream-orange highlight
      'B': '#181615', // Crisp ink black outline
      'P': '#FFA6B9', // Pink inner ears
      'R': '#FF6B81', // Rosy pop cheeks
      'C': '#BD4924', // Haus Terracotta collar
      'Y': '#E9F344', // Neon Yellow-Gold bell
      'G': '#D35400', // Deep orange tabby stripes / shading
      'E': '#FFFFFF', // Crisp white eye shine & wing feathers
      '.': null      // Transparent
    };
    
    // Frame 1: Wings Up / Legs Extended
    const frame1 = [
      "................................",
      "..........................BB....",
      ".........................BWWB...",
      "........................BWWB....",
      ".......................BWWB.....",
      "....B.......B.........BWWB......",
      "...BPB.....BPB.......BWWB.......",
      "..BPPB....BPPB......BWWB........",
      "..BPPBBBBBBPPB.....BWWB.........",
      ".BWWWWGWWGWWWWBBBBBWWB..........",
      "BWHHHHWWWWWWWWWWWWWWWB..........",
      "BWHWWWWWWWWWBEEBWWWWWWB.........",
      "BWWWWWWWWWWWBEEBWWWWWWWB........",
      "BWBEEBWBWWWWBEEBWWWWWWWWB.......",
      "BWBEEBWBWWWWBBBBWWWWWWWWWB......",
      "BWRRWWWWWWWWWWWWWWWWWWWWWWB.....",
      "BWWWWWWWWCCCYCCCWWWWWWWWWWWB....",
      ".BWWWWWWWCCCYCCCWWWWWWWWWWWWB...",
      "..BBWWWWWWWWWWWWWWWWWWWWWWWWWB..",
      "....BWWWWWWWWWWWWWWWWWWWWWWWWWB.",
      "....BWWWWWWWWWWWWWWWWWWWWWWWWB..",
      "....BWWWWWWWWWWWWWWWWWWWWWWWB...",
      "....BGGGGWWWBWWWWWBGGGGGGGGB....",
      "....BGGGGWB.BGGGWB.BGGGGGGb.....",
      "....BGGGGWB.BGGGWB.BGGGGGGb.....",
      "....BGGGGWB.BGGGWB.BGGGGGGb.....",
      "....BGGGGWB.BGGGWB.BGGGGGGb.....",
      "....BGGGGB...BGGB...BGGGGB......",
      "....BBBBB.....BB.....BBBBB......",
      "................................",
      "................................",
      "................................"
    ].map(line => line.replaceAll('b', 'B'));

    // Frame 2: Wings Down / Legs Bent (animation state)
    const frame2 = [
      "................................",
      ".........................BB.....",
      "........................BWWB....",
      ".......................BWWB.....",
      "......................BWWB......",
      "....B.......B........BWWB.......",
      "...BPB.....BPB......BWWB........",
      "..BPPB....BPPB.....BWWB.........",
      "..BPPBBBBBBPPB....BWWB..........",
      ".BWWWWGWWGWWWWBBBBWWB...........",
      "BWHHHHWWWWWWWWWWWWWWB...........",
      "BWHWWWWWWWWWWWWWWWWWWB..........",
      "BWWWWWWWWWWWWWWWWWWWWWB.........",
      "BWBEEBWBWWWWBBBBWWWWWWWB........",
      "BWBEEBWBWWWWBEEBWWWWWWWWB.......",
      "BWRRWWWWWWWWBEEBWWWWWWWWWB......",
      "BWWWWWWWWCCCYCCCWWWWWWWWWWB.....",
      ".BWWWWWWWCCCYCCCWWWWWWWWWWWB....",
      "..BBWWWWWWWWWWWWWWWWWWWWWWWWB...",
      "....BWWWWWWWWWWWWWWWWWWWWWWWWB..",
      "....BWWWWWWWWWWWWWWWWWWWWWWWWB..",
      "....BWWWWWWWWWWWWWWWWWWWWWWWB...",
      "....BGGGGWWWBWWWWWBGGGGGGGGB....",
      "....BGGGGWB.BGGGWB.BGGGGGGb.....",
      "....BGGGGWB.BGGGWB.BGGGGGGb.....",
      "....BGGGGWB.BGGGWB.BGGGGGGb.....",
      "....BGGGGWB.BGGGWB.BGGGGGGb.....",
      "....BGGGGB...BGGB...BGGGGB......",
      "....BBBBB.....BB.....BBBBB......",
      "................................",
      "................................",
      "................................"
    ].map(line => line.replaceAll('b', 'B'));

    const pixelSize = 1;
    
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

  // 2. Generate Giant Satow Obstacles (64x480 1:1 non-stretched Pop-Pixel Pod with Rim Cap)
  if (!scene.textures.exists('satow_pod')) {
    const width = 64;
    const height = 480;
    const canvasTexture = scene.textures.createCanvas('satow_pod', width, height);
    const ctx = canvasTexture.context;
    
    // Pop-Pixel Palette
    const colors = {
      'B': '#181615', // Crisp dark ink border
      'G': '#2ECC71', // Vibrant Emerald Pod Green
      'L': '#7BED9F', // Left specular highlight green
      'Y': '#E9F344', // Pop Neon-Gold Satow Bean center
      'O': '#F39C12', // Warm Amber bean shading
      'K': '#1E824C', // Deep green inner shadow
      '.': null
    };

    // Wavy Satow pod segment (12x10 grid at 4px per cell = 48x40px per pod bulge)
    const pattern = [
      "...BBBBBB...",
      "..BLLGGGGB..",
      ".BLLGYYYGGKB",
      "BLLGYYYYYOGB",
      "BLGGYYYYOOKB",
      "BLGGYYYOOKKB",
      ".BLGGGGKKKB.",
      "..BKKKKKKB..",
      "...BBBBBB...",
      "....BBBB...."
    ];

    const px = 4; // 4x4 canvas pixels per pattern cell
    ctx.clearRect(0, 0, width, height);

    // Central dark stem backbone
    ctx.fillStyle = '#181615';
    ctx.fillRect(26, 0, 12, height);
    ctx.fillStyle = '#1E824C';
    ctx.fillRect(28, 0, 8, height);

    // Draw Pop-Pixel Satow Rim Cap at the top edge (y = 0..24) so bottom pipes & flipped top pipes have a bold entrance cap
    ctx.fillStyle = '#181615';
    ctx.fillRect(6, 0, 52, 24);
    ctx.fillStyle = '#2ECC71';
    ctx.fillRect(8, 2, 48, 20);
    ctx.fillStyle = '#7BED9F';
    ctx.fillRect(8, 2, 48, 4);
    ctx.fillStyle = '#1E824C';
    ctx.fillRect(8, 18, 48, 4);

    // Three golden Satow bean studs on the rim cap
    [14, 28, 42].forEach((bx) => {
      ctx.fillStyle = '#181615';
      ctx.fillRect(bx, 4, 8, 8);
      ctx.fillStyle = '#E9F344';
      ctx.fillRect(bx + 1, 5, 6, 6);
    });

    // Alternating Yellow & Black Caution Hazard Chevrons across the rim lip (y = 18..23)
    // Clearly marks this pipe edge as an OBSTACLE / BARRIER to avoid
    for (let hx = 8; hx < 56; hx += 8) {
      ctx.fillStyle = (Math.floor(hx / 8) % 2 === 0) ? '#E9F344' : '#181615';
      ctx.fillRect(hx, 18, 8, 4);
    }

    // Tile the pod segments vertically below the cap (from y = 24 to 480)
    for (let yOffset = 24; yOffset < height; yOffset += 40) {
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < pattern[r].length; c++) {
          const char = pattern[r][c];
          const color = colors[char];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(8 + c * px, yOffset + r * px, px, px);
          }
        }
      }
    }
    
    canvasTexture.refresh();
  }

  // 3. Generate Parallax Background Layer 1: Bright Daytime Riverside Sky (Width 512 for single pixel sun)
  if (!scene.textures.exists('bg_wall')) {
    const width = 512;
    const height = 700;
    const canvasTexture = scene.textures.createCanvas('bg_wall', width, height);
    const ctx = canvasTexture.context;
    
    // Vibrant daytime sky gradient (vivid blue down to bright cyan/white horizon)
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0090ff');    // Vivid deep sky blue top
    grad.addColorStop(0.4, '#33b5e5');  // Vivid clear light sky blue middle
    grad.addColorStop(0.75, '#b3e5fc'); // Bright turquoise/cyan horizon blue
    grad.addColorStop(1.0, '#ffffff');  // Dazzling pure white near bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    
    // Draw bright summer sun (single pixelated sun)
    const sunX = 256;
    const sunY = 410;
    const sunR = 48;
    const pxSize = 4; // Blocky pixel art scale
    
    // Dazzling midday yellow/white gradient
    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, '#ffffff');    // Hot white center
    sunGrad.addColorStop(0.25, '#fff7c2'); // Warm light yellow
    sunGrad.addColorStop(1, '#ffea00');    // Brilliant sun yellow
    ctx.fillStyle = sunGrad;
    
    // Fill pixelated circle shape for the sun
    for (let y = sunY - sunR; y <= sunY + sunR; y += pxSize) {
      for (let x = sunX - sunR; x <= sunX + sunR; x += pxSize) {
        const dx = x - sunX;
        const dy = y - sunY;
        if (dx * dx + dy * dy <= sunR * sunR) {
          ctx.fillRect(x, y, pxSize, pxSize);
        }
      }
    }
    
    // Subtle pixelated sun halo
    ctx.fillStyle = 'rgba(255, 234, 0, 0.18)';
    const haloR = sunR + 12;
    for (let y = sunY - haloR; y <= sunY + haloR; y += pxSize) {
      for (let x = sunX - haloR; x <= sunX + haloR; x += pxSize) {
        const dx = x - sunX;
        const dy = y - sunY;
        const distSq = dx * dx + dy * dy;
        if (distSq <= haloR * haloR && distSq > sunR * sunR) {
          ctx.fillRect(x, y, pxSize, pxSize);
        }
      }
    }
    
    // Draw distant mountain layer 1 (Vibrant Forest green) - stretched to 512px
    ctx.fillStyle = '#10ac84';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(80, 505);
    ctx.lineTo(160, 540);
    ctx.lineTo(240, 515);
    ctx.lineTo(320, 540);
    ctx.lineTo(400, 500);
    ctx.lineTo(512, 540);
    ctx.lineTo(512, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    
    // Draw closer mountain layer 2 (Bright Lime green) - stretched to 512px and seamless
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(100, 522);
    ctx.lineTo(200, 540);
    ctx.lineTo(300, 528);
    ctx.lineTo(420, 540);
    ctx.lineTo(512, 540); // Seamlessly matches (0, 540)
    ctx.lineTo(512, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Draw Thai temple composition silhouette (เงาวัดไทยและพระพุทธรูปริมแม่น้ำตามภาพแบบใหม่)
    const pavilionPattern = [
      "........................#.......................",
      ".......................###......................",
      ".......................###......................",
      "......................#####.....................",
      ".....................#######....................",
      ".....................#######....................",
      "....................#########...................",
      "...................###########..................",
      ".................#############..................",
      "................###############.................",
      "...............#################................",
      "..............###################...............",
      ".............#####################..............",
      "............#######################.............",
      "...........#########################............",
      "..........###########################...........",
      ".........#############################..........",
      "........###############################.........",
      "......#..#############################..#.......",
      ".....##...###########################...##......",
      "....###....#########################....###.....",
      "....##......#######################......##.....",
      ".............#####################..............",
      "............#######################.............",
      "...........#########################............",
      "..........###########################...........",
      ".........#############################..........",
      "........###############################.........",
      ".......#################################........",
      "......###################################.......",
      "....#..#################################..#.....",
      "....##..###############################..##.....",
      "....###..#############################..###.....",
      ".....##...###########################...##......",
      "...........#########################............",
      "..........###########################...........",
      "..........###########################...........",
      "..........###...#####...#####...###...........",
      "..........###...#####...#####...###...........",
      "..........###...#####...#####...###...........",
      "..........###...#####...#####...###...........",
      "..........###...#####...#####...###...........",
      "..........###...#####...#####...###...........",
      "..........###...#####...#####...###...........",
      "..........###########################...........",
      "################################################"
    ];

    const buddhaPattern = [
      "............#...........",
      "...........###..........",
      "...........###..........",
      "..........#####.........",
      ".........#######........",
      ".........#######........",
      ".........#######........",
      "..........#####.........",
      "...........###..........",
      "...........###..........",
      ".........#######........",
      ".......###########......",
      ".....###############....",
      "....#################...",
      "....shape############...",
      "....#################...",
      "....#####..###..#####...",
      "....####...###...####...",
      "....####...###...####...",
      "....#####..###..#####...",
      "....#################...",
      ".....###############....",
      "......#############.....",
      ".......###########......",
      "........#########.......",
      "......#############.....",
      "....#################...",
      "....#################...",
      "....#################...",
      "....#################...",
      "########################",
      "########################"
    ].map(line => line.replaceAll('shape', '#####'));

    const chediPattern = [
      "........................#.......................",
      ".......................###......................",
      ".......................###......................",
      "......................#####.....................",
      ".....................#######....................",
      ".....................#######....................",
      "......................#####.....................",
      ".....................#######....................",
      "....................#########...................",
      "....................#########...................",
      ".....................#######....................",
      "....................#########...................",
      "...................###########..................",
      "...................###########..................",
      "..................#############.................",
      "..................#############.................",
      ".................###############................",
      ".................###############................",
      "................................................",
      "...............###################..............",
      "..............#####################.............",
      ".............#######################............",
      "............#########################...........",
      "...........###########################..........",
      "..........#############################.........",
      ".........###############################........",
      "........#################################.......",
      ".......###################################......",
      "......#####################################.....",
      ".....#######################################....",
      ".....#######################################....",
      ".....#######################################....",
      ".....#######################################....",
      "................................................",
      "......#####################################.....",
      ".......###################################......",
      "........#################################.......",
      ".........###############################........",
      "..........#############################.........",
      "..........#############################.........",
      ".........###############################........",
      "................................................",
      ".......###################################......",
      "......#####################################.....",
      ".....#######################################....",
      "....#########################################...",
      "....#########################################...",
      "....#########################################...",
      "....#########################################...",
      "################################################"
    ];

    const palmPattern = [
      "............####........",
      "..........########......",
      ".......#############....",
      "......###############...",
      ".....#################..",
      "....###..#########..###.",
      "....##...#########...##.",
      "....#....#########....#.",
      ".........#########......",
      "..........#######.......",
      "...........#####........",
      "............###.........",
      "............###.........",
      "............###.........",
      "............###.........",
      "...........###..........",
      "...........###..........",
      "...........###..........",
      "..........###...........",
      "..........###...........",
      "..........###...........",
      ".........###............",
      ".........###............",
      ".........###............",
      ".........###............",
      "........###.............",
      "........###.............",
      "........###.............",
      ".......###..............",
      ".......###..............",
      ".......###..............",
      "......###...............",
      "......###...............",
      "......###...............",
      ".....###................",
      ".....###................",
      ".....###................",
      "....###.................",
      "....###.................",
      "....###.................",
      "...###..................",
      "...###..................",
      "...###..................",
      "..###...................",
      "..###...................",
      "..###...................",
      ".###....................",
      "####...................."
    ];

    ctx.fillStyle = '#05180e'; // Deep dark temple charcoal-green silhouette

    // Draw the components using our drawing routine helper
    const drawComponent = (pattern, startX, startY, scale = 2) => {
      const rows = pattern.length;
      const cols = pattern[0].length;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c] === '#') {
            ctx.fillRect(
              startX + c * scale, 
              startY - (rows - r) * scale, 
              scale, 
              scale
            );
          }
        }
      }
    };

    // Place them from left to right as in the reference image composition
    drawComponent(pavilionPattern, 20, 540, 2);
    drawComponent(buddhaPattern, 125, 540, 2);
    drawComponent(chediPattern, 185, 540, 2);
    drawComponent(palmPattern, 290, 540, 2);

    // Draw some ground foliage/bushes to frame the composition
    ctx.fillRect(10, 532, 10, 8);
    ctx.fillRect(15, 528, 8, 12);
    ctx.fillRect(115, 534, 12, 6);
    ctx.fillRect(175, 536, 12, 4);
    ctx.fillRect(280, 530, 10, 10);
    ctx.fillRect(330, 528, 12, 12);
    ctx.fillRect(340, 534, 15, 6);

    // Draw cute pixel art clouds (adds to daytime sky atmosphere, spaced over 512px)
    const drawPixelCloud = (cx, cy, scale = 1) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const cloudLayout = [
        "....######....",
        "..##########..",
        "##############",
        "##############"
      ];
      const pxSize = Math.round(3 * scale);
      for (let r = 0; r < cloudLayout.length; r++) {
        for (let c = 0; c < cloudLayout[r].length; c++) {
          if (cloudLayout[r][c] === '#') {
            ctx.fillRect(cx + c * pxSize, cy + r * pxSize, pxSize, pxSize);
          }
        }
      }
    };
    drawPixelCloud(40, 80, 1.2);
    drawPixelCloud(300, 140, 1.0);
    drawPixelCloud(180, 60, 0.8);
    drawPixelCloud(420, 90, 0.7);
    
    canvasTexture.refresh();
  }

  // 4. Generate Parallax Background Layer 2: Sparkling Daylight River
  if (!scene.textures.exists('bg_river')) {
    const width = 128;
    const height = 96;
    const canvasTexture = scene.textures.createCanvas('bg_river', width, height);
    const ctx = canvasTexture.context;
    
    ctx.fillStyle = '#3498db'; // Vibrant bright blue river water
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
    
    // Waves pattern (vivid blue base, bright light blue water, and white sunlight shimmers)
    const waves = [
      { x: 10, y: 10, len: 30, c: '#2980b9' },
      { x: 70, y: 15, len: 40, c: '#2980b9' },
      { x: 40, y: 25, len: 25, c: '#ffffff' }, // Sparkling sun shimmer
      { x: 95, y: 30, len: 35, c: '#2980b9' },
      { x: 5, y: 40, len: 45, c: '#7ec8f8' }, // Light blue ripples
      { x: 80, y: 45, len: 20, c: '#ffffff' },
      { x: 30, y: 55, len: 35, c: '#2980b9' },
      { x: 110, y: 60, len: 25, c: '#7ec8f8' },
      { x: 50, y: 70, len: 50, c: '#ffffff' },
      { x: 5, y: 80, len: 30, c: '#2980b9' },
      { x: 90, y: 85, len: 30, c: '#ffffff' }
    ];
    waves.forEach(w => drawWave(w.x, w.y, w.len, w.c));
    
    canvasTexture.refresh();
  }

  // 5. Generate Parallax Background Layer 3: Warm Golden Wood Pier (Ground)
  if (!scene.textures.exists('bg_ground')) {
    const width = 64;
    const height = 64;
    const canvasTexture = scene.textures.createCanvas('bg_ground', width, height);
    const ctx = canvasTexture.context;
    
    ctx.fillStyle = '#e67e22'; // Warm bright golden-orange wood planks
    ctx.fillRect(0, 0, width, height);
    
    // Horizontal borders of planks (Y = 0, 16, 32, 48, 64)
    ctx.fillStyle = '#78281f'; // Rich dark brown outline
    for (let y = 0; y < height; y += 16) {
      ctx.fillRect(0, y, width, 2);
    }
    
    // Highlight edges on planks
    ctx.fillStyle = '#f1c40f'; // Shiny bright yellow highlight
    for (let y = 2; y < height; y += 16) {
      ctx.fillRect(0, y, width, 1);
    }
    
    // Shiny gold screw/nail heads (reflective white in sunlight)
    ctx.fillStyle = '#ffffff';
    for (let x = 12; x < width; x += 32) {
      for (let y = 8; y < height; y += 16) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
    
    // Subtle vertical gaps in golden wood
    ctx.fillStyle = '#78281f';
    ctx.fillRect(20, 0, 2, 16);
    ctx.fillRect(48, 16, 2, 16);
    ctx.fillRect(10, 32, 2, 16);
    ctx.fillRect(38, 48, 2, 16);
    
    canvasTexture.refresh();
  }

  // 6. Generate Kitchen Knife Hazard Sprite (32x32 canvas, Flying Chef Cleaver with Crimson Danger Glow)
  if (!scene.textures.exists('kitchen_knife')) {
    const width = 32;
    const height = 32;
    const canvasTexture = scene.textures.createCanvas('kitchen_knife', width, height);
    const ctx = canvasTexture.context;
    
    const colors = {
      'W': '#FFFFFF', // Blade specular shine
      'S': '#CBD5E1', // Polished steel blade
      'D': '#64748B', // Shadowed blade steel
      'R': '#EF4444', // Crimson Danger edge (clearly marks as ENEMY HAZARD)
      'F': '#991B1B', // Deep crimson gore/heat trail
      'B': '#181615', // Crisp ink outline
      'H': '#78350F', // Wooden handle
      'K': '#451A03', // Dark handle shadow
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
      "............BBBBBBBBBB..........",
      "..........BBRRRRRRRRRRB.........",
      ".........BBRWWWWWWWWWWSB........",
      "........BRWWWWWWWWWWWWWSB.......",
      "....BBBBBRWWWWWWWWWWWWWSB.......",
      "...BHHHHHHWWWWWWWWWWWWWDB.......",
      "...BHHHHHHWWWWWWWWWWWWWDDB......",
      "...BKKKKKKRFFFFFFFFFFFFFFB......",
      "....BBBBBBBBBBBBBBBBBBBBB.......",
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

  // 7. Generate Warning Icon Sprite (32x32 Crimson/Yellow Hazard Triangle)
  if (!scene.textures.exists('warning_icon')) {
    const width = 32;
    const height = 32;
    const canvasTexture = scene.textures.createCanvas('warning_icon', width, height);
    const ctx = canvasTexture.context;
    
    const colors = {
      'R': '#EF4444', // Danger Crimson Border
      'Y': '#E9F344', // High-Contrast Neon Yellow
      'B': '#181615', // Black ink
      'W': '#FFFFFF',
      '.': null
    };

    const warningPattern = [
      "...............BB...............",
      "..............BRRB..............",
      ".............BRYYRB.............",
      "............BRYYYYRB............",
      "...........BRYYBYYYRB...........",
      "..........BRYYBBBYYYRB..........",
      ".........BRYYBBBBYYYRB..........",
      "........BRYYBBBBBYYYYRB.........",
      ".......BRYYYBBBBBYYYYYRB........",
      "......BRYYYYBBBBBYYYYYYRB.......",
      ".....BRYYYYYBBBBBYYYYYYYRB......",
      "....BRYYYYYYBBBBBYYYYYYYYRB.....",
      "...BRYYYYYYYYBBYYYYYYYYYYRB.....",
      "..BRYYYYYYYYYBYYYYYYYYYYYYRB....",
      "..BRYYYYYYYYYBYYYYYYYYYYYYRB....",
      "..BRYYYYYYYYBBBYYYYYYYYYYYRB....",
      "..BRYYYYYYYYBBBYYYYYYYYYYYRB....",
      "..BRYYYYYYYYYBYYYYYYYYYYYYRB....",
      "..BRYYYYYYYYYYYYYYYYYYYYYYRB....",
      "...BRYYYYYYYYBBBYYYYYYYYYRB.....",
      "....BRYYYYYYYBBBYYYYYYYYRB......",
      ".....BRYYYYYYBBBYYYYYYYRB.......",
      "......BRYYYYYBBBYYYYYYRB........",
      ".......BRYYYYYYYYYYYYRB.........",
      "........BRYYYYYYYYYYRB..........",
      ".........BRYYYYYYYYRB...........",
      "..........BRYYYYYYRB............",
      "...........BRYYYYRB.............",
      "............BRYYRB..............",
      ".............BRRB...............",
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

  // 8. Generate Satow Bean Item Sprite (24x24 Pop-Pixel Luminous Star Bean)
  if (!scene.textures.exists('satow_bean')) {
    const width = 24;
    const height = 24;
    const canvasTexture = scene.textures.createCanvas('satow_bean', width, height);
    const ctx = canvasTexture.context;
    
    const colors = {
      'W': '#FFFFFF', // Diamond Catchlight
      'Y': '#FACC15', // Vibrant Gold
      'L': '#FEF08A', // Pale Gold Shine
      'G': '#22C55E', // Emerald Pod Accent
      'O': '#F97316', // Warm Orange Shading
      'B': '#181615', // Crisp Black Outline
      '.': null
    };

    const pattern = [
      ".........BB.............",
      ".......BBLLBB...........",
      "......BLLYYYYBB.........",
      ".....BLYYYYYYYYB........",
      "....BLYYYYYYYYYYOB......",
      "....BLYYYYYYYYYOOB......",
      "...BLYYYYYYYYYOOOB......",
      "...BLWWYYYYYYYOOOB......",
      "...BLWWYYYYYYYOOOB......",
      "...BLYYYYYYYYOOOOOB.....",
      "....BLYYYYYYOOOOOB......",
      "....BLYYYYOOOOOOB.......",
      ".....BLYYOOOOOOB........",
      "......BBLOOOOBB.........",
      "........BBBB............",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................"
    ];

    ctx.clearRect(0, 0, width, height);
    for (let r = 0; r < 24; r++) {
      for (let c = 0; c < 24; c++) {
        const char = pattern[r][c];
        const color = colors[char];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c, r, 1, 1);
        }
      }
    }

    // Four-point sparkling cross star on upper left of the bean
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(4, 3, 2, 6);
    ctx.fillRect(2, 5, 6, 2);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(4, 5, 2, 2);

    canvasTexture.refresh();
  }
}

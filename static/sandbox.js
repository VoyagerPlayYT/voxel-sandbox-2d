// VOXEL SANDBOX 2D // Procedural Generation, Fluid Automata & SQLite Persistence
(function() {
  const canvas = document.getElementById('sandboxCanvas');
  const ctx = canvas.getContext('2d');

  // DOM elements
  const metricSeed = document.getElementById('metricSeed');
  const metricCoords = document.getElementById('metricCoords');
  const metricTime = document.getElementById('metricTime');
  const lightLevelText = document.getElementById('lightLevelText');
  const activeToolText = document.getElementById('activeToolText');
  const hotbarContainer = document.getElementById('hotbarContainer');
  const recipesList = document.getElementById('recipesList');
  const btnSaveWorld = document.getElementById('btnSaveWorld');
  const btnWorldsList = document.getElementById('btnWorldsList');
  const saveIndicator = document.getElementById('saveIndicator');
  const worldsModal = document.getElementById('worldsModal');
  const btnCloseWorldsModal = document.getElementById('btnCloseWorldsModal');
  const worldsTableBody = document.getElementById('worldsTableBody');
  const btnCreateWorld = document.getElementById('btnCreateWorld');
  const newWorldName = document.getElementById('newWorldName');
  const newWorldSeed = document.getElementById('newWorldSeed');

  const WIDTH = 960;
  const HEIGHT = 640;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  // Grid Dimensions
  const GRID_W = 160;
  const GRID_H = 90;
  const TILE_SIZE = 16; // 160 * 16 = 2560px total world width

  // Block Definitions
  const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    COAL: 4,
    IRON: 5,
    GOLD: 6,
    DIAMOND: 7,
    WOOD: 8,
    LEAVES: 9,
    SAND: 10,
    WATER: 11,
    TORCH: 12,
    PLANKS: 13,
    BEDROCK: 14,
    STONE_BRICK: 15
  };

  const BLOCK_PROPS = {
    [BLOCKS.AIR]: { name: 'Air', solid: false, hardness: 0, color: 'transparent' },
    [BLOCKS.GRASS]: { name: 'Grass Block', solid: true, hardness: 0.3, color: '#10B981', drop: BLOCKS.DIRT },
    [BLOCKS.DIRT]: { name: 'Dirt', solid: true, hardness: 0.3, color: '#78350F', drop: BLOCKS.DIRT },
    [BLOCKS.STONE]: { name: 'Stone', solid: true, hardness: 0.9, color: '#4B5563', drop: BLOCKS.STONE },
    [BLOCKS.COAL]: { name: 'Coal Ore', solid: true, hardness: 1.0, color: '#1F2937', drop: 'item_coal' },
    [BLOCKS.IRON]: { name: 'Iron Ore', solid: true, hardness: 1.2, color: '#9A3412', drop: 'item_iron' },
    [BLOCKS.GOLD]: { name: 'Gold Ore', solid: true, hardness: 1.4, color: '#CA8A04', drop: 'item_gold' },
    [BLOCKS.DIAMOND]: { name: 'Diamond Ore', solid: true, hardness: 2.0, color: '#06B6D4', drop: 'item_diamond' },
    [BLOCKS.WOOD]: { name: 'Oak Wood', solid: true, hardness: 0.6, color: '#92400E', drop: BLOCKS.WOOD },
    [BLOCKS.LEAVES]: { name: 'Oak Leaves', solid: false, hardness: 0.1, color: '#15803D', drop: null },
    [BLOCKS.SAND]: { name: 'Sand', solid: true, sand: true, hardness: 0.25, color: '#FBBF24', drop: BLOCKS.SAND },
    [BLOCKS.WATER]: { name: 'Water', solid: false, fluid: true, hardness: 0, color: '#3B82F6' },
    [BLOCKS.TORCH]: { name: 'Torch', solid: false, light: 14, hardness: 0.1, color: '#F59E0B', drop: BLOCKS.TORCH },
    [BLOCKS.PLANKS]: { name: 'Wood Planks', solid: true, hardness: 0.5, color: '#B45309', drop: BLOCKS.PLANKS },
    [BLOCKS.BEDROCK]: { name: 'Bedrock', solid: true, hardness: 9999, color: '#111827', drop: null },
    [BLOCKS.STONE_BRICK]: { name: 'Stone Bricks', solid: true, hardness: 0.8, color: '#6B7280', drop: BLOCKS.STONE_BRICK }
  };

  // State
  let currentWorldId = 1;
  let worldSeed = 481516;
  let tiles = new Uint8Array(GRID_W * GRID_H);
  let timeOfDay = 0.25; // 0.0 to 1.0 (0.25 = noon, 0.75 = midnight)

  // Camera
  let camera = { x: 0, y: 0 };

  // Player Entity
  let player = {
    x: 80 * TILE_SIZE,
    y: 30 * TILE_SIZE,
    vx: 0,
    vy: 0,
    w: 12,
    h: 22,
    speed: 2.8,
    jumpForce: -6.4,
    grounded: false
  };

  // Mining interaction
  let mining = {
    active: false,
    tileX: 0,
    tileY: 0,
    progress: 0,
    maxTime: 1
  };

  // Inventory: 9 hotbar slots
  let selectedSlot = 0;
  let inventory = [
    { type: 'tool', id: 'pickaxe_wood', count: 1, label: 'Pickaxe' },
    { type: 'tool', id: 'axe_wood', count: 1, label: 'Axe' },
    { type: 'block', blockId: BLOCKS.DIRT, count: 64, label: 'Dirt' },
    { type: 'block', blockId: BLOCKS.WOOD, count: 24, label: 'Wood' },
    { type: 'block', blockId: BLOCKS.TORCH, count: 16, label: 'Torch' },
    { type: 'block', blockId: BLOCKS.SAND, count: 32, label: 'Sand' },
    { type: 'item', id: 'item_coal', count: 8, label: 'Coal' },
    { type: 'item', id: 'stick', count: 12, label: 'Sticks' },
    { type: 'empty', count: 0, label: 'Empty' }
  ];

  // Crafting Recipes
  const RECIPES = [
    {
      name: '4x Wood Planks',
      inputs: [{ blockId: BLOCKS.WOOD, count: 1 }],
      output: { type: 'block', blockId: BLOCKS.PLANKS, count: 4, label: 'Planks' }
    },
    {
      name: '4x Wooden Sticks',
      inputs: [{ blockId: BLOCKS.PLANKS, count: 2 }],
      output: { type: 'item', id: 'stick', count: 4, label: 'Sticks' }
    },
    {
      name: '4x Torches',
      inputs: [{ id: 'item_coal', count: 1 }, { id: 'stick', count: 1 }],
      output: { type: 'block', blockId: BLOCKS.TORCH, count: 4, label: 'Torch' }
    },
    {
      name: '4x Stone Bricks',
      inputs: [{ blockId: BLOCKS.STONE, count: 4 }],
      output: { type: 'block', blockId: BLOCKS.STONE_BRICK, count: 4, label: 'Stone Bricks' }
    },
    {
      name: 'Stone Pickaxe',
      inputs: [{ blockId: BLOCKS.STONE, count: 3 }, { id: 'stick', count: 2 }],
      output: { type: 'tool', id: 'pickaxe_stone', count: 1, label: 'Stone Pickaxe' }
    }
  ];

  // Keyboard & Mouse Listeners
  let keys = {};
  let mouse = { x: 0, y: 0, worldX: 0, worldY: 0, leftDown: false, rightDown: false };

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.key >= '1' && e.key <= '9') {
      selectedSlot = parseInt(e.key) - 1;
      renderHotbar();
    }
    if (e.code === 'KeyE') {
      // Toggle crafting / inventory
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.leftDown = true;
    if (e.button === 2) {
      mouse.rightDown = true;
      tryPlaceBlock();
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouse.leftDown = false;
      mining.active = false;
      mining.progress = 0;
    }
    if (e.button === 2) mouse.rightDown = false;
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Procedural Noise Generator
  function pseudoRandom(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  function generateWorld(seed) {
    worldSeed = seed;
    metricSeed.textContent = seed.toString();
    const rng = pseudoRandom(seed);

    // Height map using harmonic sines
    for (let x = 0; x < GRID_W; x++) {
      const nx = x / 24.0;
      const elevation = Math.sin(nx * 0.8) * 6 + Math.sin(nx * 2.1) * 3 + Math.cos(nx * 0.3) * 8;
      const surfaceY = Math.floor(40 + elevation);

      for (let y = 0; y < GRID_H; y++) {
        const idx = y * GRID_W + x;

        if (y === GRID_H - 1) {
          tiles[idx] = BLOCKS.BEDROCK;
        } else if (y < surfaceY) {
          // Check if water basin
          if (y >= 44) {
            tiles[idx] = BLOCKS.WATER;
          } else {
            tiles[idx] = BLOCKS.AIR;
          }
        } else if (y === surfaceY) {
          if (surfaceY >= 43) {
            tiles[idx] = BLOCKS.SAND;
          } else {
            tiles[idx] = BLOCKS.GRASS;
          }
        } else if (y < surfaceY + 4) {
          tiles[idx] = BLOCKS.DIRT;
        } else {
          // Deep subterranean
          tiles[idx] = BLOCKS.STONE;

          // Cave Carving
          const caveNoise = Math.sin(x * 0.15) * Math.cos(y * 0.15) + (rng() - 0.5) * 0.4;
          if (caveNoise > 0.45 && y < GRID_H - 3) {
            tiles[idx] = BLOCKS.AIR;
            continue;
          }

          // Stratified Ore Veins
          const oreRoll = rng();
          if (y > 70 && oreRoll < 0.02) {
            tiles[idx] = BLOCKS.DIAMOND;
          } else if (y > 58 && oreRoll < 0.04) {
            tiles[idx] = BLOCKS.GOLD;
          } else if (y > 48 && oreRoll < 0.07) {
            tiles[idx] = BLOCKS.IRON;
          } else if (oreRoll < 0.1) {
            tiles[idx] = BLOCKS.COAL;
          }
        }
      }
    }

    // Plant trees on grass surface
    for (let x = 4; x < GRID_W - 4; x += 5) {
      if (rng() > 0.4) {
        // find surface
        for (let y = 10; y < GRID_H - 10; y++) {
          if (tiles[y * GRID_W + x] === BLOCKS.GRASS) {
            // Spawn tree
            const trunkH = Math.floor(rng() * 3) + 4;
            for (let th = 1; th <= trunkH; th++) {
              if (y - th >= 0) tiles[(y - th) * GRID_W + x] = BLOCKS.WOOD;
            }
            // Leaves crown
            const crownY = y - trunkH;
            for (let lx = -2; lx <= 2; lx++) {
              for (let ly = -2; ly <= 0; ly++) {
                if (Math.abs(lx) === 2 && Math.abs(ly) === 2) continue;
                const idx = (crownY + ly) * GRID_W + (x + lx);
                if (tiles[idx] === BLOCKS.AIR) tiles[idx] = BLOCKS.LEAVES;
              }
            }
            break;
          }
        }
      }
    }

    // Place player on surface
    player.x = (GRID_W / 2) * TILE_SIZE;
    for (let y = 0; y < GRID_H; y++) {
      if (tiles[y * GRID_W + Math.floor(GRID_W / 2)] !== BLOCKS.AIR) {
        player.y = (y - 3) * TILE_SIZE;
        break;
      }
    }
  }

  function getTile(x, y) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return BLOCKS.BEDROCK;
    return tiles[y * GRID_W + x];
  }

  function setTile(x, y, block) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return;
    tiles[y * GRID_W + x] = block;
  }

  // Fluid Dynamics & Sand Physics
  let simTick = 0;
  function updatePhysicsVoxel() {
    simTick++;
    if (simTick % 4 !== 0) return; // update fluids/sand every 4 frames for performance

    // Scan from bottom to top for realistic falling
    for (let y = GRID_H - 2; y >= 0; y--) {
      for (let x = 0; x < GRID_W; x++) {
        const b = getTile(x, y);

        // Falling Sand
        if (b === BLOCKS.SAND) {
          const below = getTile(x, y + 1);
          if (below === BLOCKS.AIR || below === BLOCKS.WATER) {
            setTile(x, y, below);
            setTile(x, y + 1, BLOCKS.SAND);
          } else if (BLOCK_PROPS[below]?.solid) {
            // Check slide left-down / right-down
            if (getTile(x - 1, y + 1) === BLOCKS.AIR && getTile(x - 1, y) === BLOCKS.AIR) {
              setTile(x, y, BLOCKS.AIR);
              setTile(x - 1, y + 1, BLOCKS.SAND);
            } else if (getTile(x + 1, y + 1) === BLOCKS.AIR && getTile(x + 1, y) === BLOCKS.AIR) {
              setTile(x, y, BLOCKS.AIR);
              setTile(x + 1, y + 1, BLOCKS.SAND);
            }
          }
        }

        // Cellular Automata Water
        else if (b === BLOCKS.WATER) {
          const below = getTile(x, y + 1);
          if (below === BLOCKS.AIR) {
            setTile(x, y + 1, BLOCKS.WATER);
          } else if (below !== BLOCKS.AIR) {
            // Flow sideways
            const left = getTile(x - 1, y);
            const right = getTile(x + 1, y);
            if (left === BLOCKS.AIR && Math.random() < 0.5) {
              setTile(x - 1, y, BLOCKS.WATER);
            } else if (right === BLOCKS.AIR) {
              setTile(x + 1, y, BLOCKS.WATER);
            }
          }
        }
      }
    }
  }

  // Player Physics & Movement
  function updatePlayer() {
    // Input
    let moveX = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

    player.vx = moveX * player.speed;

    // Jump
    if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.grounded) {
      player.vy = player.jumpForce;
      player.grounded = false;
    }

    // Gravity
    player.vy += 0.32;
    if (player.vy > 9) player.vy = 9;

    // Horizontal Movement & Collisions
    player.x += player.vx;
    resolveCollisionX();

    // Vertical Movement & Collisions
    player.y += player.vy;
    resolveCollisionY();

    // Clamp inside world boundaries
    player.x = Math.max(0, Math.min((GRID_W - 1) * TILE_SIZE, player.x));

    // Update Telemetry
    const tileX = Math.floor(player.x / TILE_SIZE);
    const tileY = Math.floor(player.y / TILE_SIZE);
    metricCoords.textContent = `X: ${tileX} | Y: ${tileY}`;

    // Day/Night Progression
    timeOfDay = (timeOfDay + 0.0001) % 1.0;
    const hour = Math.floor(timeOfDay * 24);
    const minute = Math.floor((timeOfDay * 24 - hour) * 60);
    metricTime.textContent = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${hour >= 6 && hour < 20 ? 'DAY' : 'NIGHT'}`;
    const lightPct = Math.round((Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2) + 1) * 50);
    lightLevelText.textContent = `${lightPct}% Ambient`;

    // Active tool display
    const slot = inventory[selectedSlot];
    activeToolText.textContent = slot.count > 0 ? `${slot.label} (x${slot.count})` : 'Empty Hand';
  }

  function resolveCollisionX() {
    const left = Math.floor(player.x / TILE_SIZE);
    const right = Math.floor((player.x + player.w) / TILE_SIZE);
    const top = Math.floor(player.y / TILE_SIZE);
    const bottom = Math.floor((player.y + player.h) / TILE_SIZE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        const b = getTile(tx, ty);
        if (BLOCK_PROPS[b]?.solid) {
          if (player.vx > 0) {
            player.x = tx * TILE_SIZE - player.w - 0.01;
            player.vx = 0;
          } else if (player.vx < 0) {
            player.x = (tx + 1) * TILE_SIZE + 0.01;
            player.vx = 0;
          }
        }
      }
    }
  }

  function resolveCollisionY() {
    player.grounded = false;
    const left = Math.floor(player.x / TILE_SIZE);
    const right = Math.floor((player.x + player.w) / TILE_SIZE);
    const top = Math.floor(player.y / TILE_SIZE);
    const bottom = Math.floor((player.y + player.h) / TILE_SIZE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        const b = getTile(tx, ty);
        if (BLOCK_PROPS[b]?.solid) {
          if (player.vy > 0) {
            player.y = ty * TILE_SIZE - player.h - 0.01;
            player.vy = 0;
            player.grounded = true;
          } else if (player.vy < 0) {
            player.y = (ty + 1) * TILE_SIZE + 0.01;
            player.vy = 0;
          }
        }
      }
    }
  }

  // Mining Routine
  function updateMining() {
    mouse.worldX = mouse.x + camera.x;
    mouse.worldY = mouse.y + camera.y;

    const tx = Math.floor(mouse.worldX / TILE_SIZE);
    const ty = Math.floor(mouse.worldY / TILE_SIZE);

    const dist = Math.hypot(player.x + player.w / 2 - (tx * TILE_SIZE + 8), player.y + player.h / 2 - (ty * TILE_SIZE + 8));
    const inReach = dist <= 6.5 * TILE_SIZE;

    if (mouse.leftDown && inReach) {
      const b = getTile(tx, ty);
      if (b !== BLOCKS.AIR && b !== BLOCKS.BEDROCK && b !== BLOCKS.WATER) {
        if (!mining.active || mining.tileX !== tx || mining.tileY !== ty) {
          mining.active = true;
          mining.tileX = tx;
          mining.tileY = ty;
          mining.progress = 0;
          const tool = inventory[selectedSlot];
          let speedFactor = 1.0;
          if (tool.id === 'pickaxe_wood' && (b === BLOCKS.STONE || b >= BLOCKS.COAL)) speedFactor = 2.2;
          if (tool.id === 'pickaxe_stone' && (b === BLOCKS.STONE || b >= BLOCKS.COAL)) speedFactor = 3.6;
          if (tool.id === 'axe_wood' && (b === BLOCKS.WOOD || b === BLOCKS.PLANKS)) speedFactor = 2.5;
          mining.maxTime = Math.max(0.08, (BLOCK_PROPS[b].hardness || 0.5) / speedFactor);
        } else {
          mining.progress += 1 / 60;
          if (mining.progress >= mining.maxTime) {
            // Block Broken!
            giveDrop(BLOCK_PROPS[b].drop || b);
            setTile(tx, ty, BLOCKS.AIR);
            mining.active = false;
            mining.progress = 0;
          }
        }
      } else {
        mining.active = false;
      }
    } else {
      mining.active = false;
      mining.progress = 0;
    }
  }

  function giveDrop(drop) {
    if (!drop) return;
    for (let slot of inventory) {
      if (typeof drop === 'number' && slot.blockId === drop) {
        slot.count++;
        renderHotbar();
        return;
      } else if (typeof drop === 'string' && slot.id === drop) {
        slot.count++;
        renderHotbar();
        return;
      }
    }
    // Find empty slot
    for (let slot of inventory) {
      if (slot.count === 0 || slot.type === 'empty') {
        if (typeof drop === 'number') {
          slot.type = 'block';
          slot.blockId = drop;
          slot.label = BLOCK_PROPS[drop].name;
          slot.count = 1;
        } else {
          slot.type = 'item';
          slot.id = drop;
          slot.label = drop;
          slot.count = 1;
        }
        renderHotbar();
        return;
      }
    }
  }

  function tryPlaceBlock() {
    mouse.worldX = mouse.x + camera.x;
    mouse.worldY = mouse.y + camera.y;

    const tx = Math.floor(mouse.worldX / TILE_SIZE);
    const ty = Math.floor(mouse.worldY / TILE_SIZE);

    const dist = Math.hypot(player.x + player.w / 2 - (tx * TILE_SIZE + 8), player.y + player.h / 2 - (ty * TILE_SIZE + 8));
    if (dist > 6.5 * TILE_SIZE) return;

    const targetBlock = getTile(tx, ty);
    if (targetBlock !== BLOCKS.AIR && targetBlock !== BLOCKS.WATER) return;

    // Check player collision
    const pBounds = {
      l: player.x, r: player.x + player.w,
      t: player.y, b: player.y + player.h
    };
    const bBounds = {
      l: tx * TILE_SIZE, r: (tx + 1) * TILE_SIZE,
      t: ty * TILE_SIZE, b: (ty + 1) * TILE_SIZE
    };

    const slot = inventory[selectedSlot];
    if (slot && slot.type === 'block' && slot.count > 0) {
      if (BLOCK_PROPS[slot.blockId].solid &&
          pBounds.r > bBounds.l && pBounds.l < bBounds.r &&
          pBounds.b > bBounds.t && pBounds.t < bBounds.b) {
        return; // player is inside block
      }
      setTile(tx, ty, slot.blockId);
      slot.count--;
      if (slot.count <= 0) {
        slot.type = 'empty';
        slot.blockId = null;
        slot.label = 'Empty';
      }
      renderHotbar();
    }
  }

  // Camera tracking
  function updateCamera() {
    camera.x = player.x + player.w / 2 - WIDTH / 2;
    camera.y = player.y + player.h / 2 - HEIGHT / 2;

    camera.x = Math.max(0, Math.min(GRID_W * TILE_SIZE - WIDTH, camera.x));
    camera.y = Math.max(0, Math.min(GRID_H * TILE_SIZE - HEIGHT, camera.y));
  }

  // Render Loop
  function render() {
    // Sky gradient according to daylight
    const dayProgress = Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2);
    let skyColor = dayProgress > 0 ? '#1E293B' : '#09090D';
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));

    // Visible tile boundaries
    const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const endX = Math.min(GRID_W, Math.ceil((camera.x + WIDTH) / TILE_SIZE));
    const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const endY = Math.min(GRID_H, Math.ceil((camera.y + HEIGHT) / TILE_SIZE));

    // Draw Voxels
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const b = getTile(x, y);
        if (b === BLOCKS.AIR) continue;

        const prop = BLOCK_PROPS[b];
        ctx.fillStyle = prop.color;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // Voxel Detail Outlines
        if (b === BLOCKS.GRASS) {
          ctx.fillStyle = '#059669';
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, 3);
        } else if (b >= BLOCKS.COAL && b <= BLOCKS.DIAMOND) {
          ctx.fillStyle = b === BLOCKS.COAL ? '#000' : b === BLOCKS.IRON ? '#F97316' : b === BLOCKS.GOLD ? '#FACC15' : '#22D3EE';
          ctx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 4, 3, 3);
          ctx.fillRect(x * TILE_SIZE + 9, y * TILE_SIZE + 8, 3, 3);
        } else if (b === BLOCKS.TORCH) {
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 4, 4, 10);
        }
      }
    }

    // Player Avatar
    ctx.fillStyle = '#10B981';
    ctx.fillRect(player.x, player.y, player.w, player.h);
    // Face visor
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(player.x + (player.vx >= 0 ? 6 : 2), player.y + 4, 4, 4);

    // Mining Crack Overlay
    if (mining.active) {
      const pct = mining.progress / mining.maxTime;
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 2;
      ctx.strokeRect(mining.tileX * TILE_SIZE, mining.tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.fillRect(mining.tileX * TILE_SIZE, mining.tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE * pct);
    }

    // Reticle Target Box
    const hoverX = Math.floor(mouse.worldX / TILE_SIZE);
    const hoverY = Math.floor(mouse.worldY / TILE_SIZE);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hoverX * TILE_SIZE, hoverY * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    ctx.restore();
  }

  // Hotbar Rendering
  function renderHotbar() {
    hotbarContainer.innerHTML = '';
    inventory.forEach((slot, idx) => {
      const el = document.createElement('div');
      el.className = `hotbar-slot ${idx === selectedSlot ? 'active' : ''}`;
      el.innerHTML = `
        <span class="hotbar-num">${idx + 1}</span>
        <span class="hotbar-icon">${slot.type === 'empty' ? '' : '■'}</span>
        ${slot.count > 1 ? `<span class="hotbar-count">${slot.count}</span>` : ''}
      `;
      if (slot.type === 'block' && slot.blockId) {
        el.querySelector('.hotbar-icon').style.color = BLOCK_PROPS[slot.blockId].color;
      }
      el.addEventListener('click', () => {
        selectedSlot = idx;
        renderHotbar();
      });
      hotbarContainer.appendChild(el);
    });
  }

  // Crafting Recipes List
  function renderRecipes() {
    recipesList.innerHTML = '';
    RECIPES.forEach(rec => {
      const row = document.createElement('div');
      row.className = 'recipe-row';
      const costText = rec.inputs.map(i => `${i.count}x ${i.blockId ? BLOCK_PROPS[i.blockId].name : i.id}`).join(' + ');

      let canCraft = true;
      rec.inputs.forEach(req => {
        let have = 0;
        inventory.forEach(s => {
          if (req.blockId && s.blockId === req.blockId) have += s.count;
          if (req.id && s.id === req.id) have += s.count;
        });
        if (have < req.count) canCraft = false;
      });

      row.innerHTML = `
        <div>
          <div style="font-weight:700;">${rec.name}</div>
          <div class="recipe-cost">${costText}</div>
        </div>
        <button class="recipe-btn" ${!canCraft ? 'disabled' : ''}>CRAFT</button>
      `;

      if (canCraft) {
        row.querySelector('.recipe-btn').addEventListener('click', () => {
          // Consume items
          rec.inputs.forEach(req => {
            let needed = req.count;
            for (let s of inventory) {
              if ((req.blockId && s.blockId === req.blockId) || (req.id && s.id === req.id)) {
                const take = Math.min(needed, s.count);
                s.count -= take;
                needed -= take;
                if (s.count <= 0) {
                  s.type = 'empty';
                  s.blockId = null;
                  s.id = null;
                  s.label = 'Empty';
                }
                if (needed <= 0) break;
              }
            }
          });
          // Add output
          giveDrop(rec.output.blockId || rec.output.id);
          renderHotbar();
          renderRecipes();
        });
      }
      recipesList.appendChild(row);
    });
  }

  // SQLite Persistence API
  async function saveActiveWorld() {
    saveIndicator.textContent = "Saving to SQLite...";
    try {
      const res = await fetch(`/api/worlds/${currentWorldId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_x: player.x,
          player_y: player.y,
          time_of_day: timeOfDay,
          inventory: inventory
        })
      });
      if (res.ok) {
        saveIndicator.textContent = "✓ World saved to SQLite.";
        setTimeout(() => { saveIndicator.textContent = "World synced with SQLite"; }, 3000);
      }
    } catch (e) {
      saveIndicator.textContent = "Error saving to SQLite.";
    }
  }

  async function openWorldsModal() {
    worldsModal.classList.remove('hidden');
    try {
      const res = await fetch('/api/worlds');
      const data = await res.json();
      worldsTableBody.innerHTML = '';
      data.worlds.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${w.name}</td>
          <td class="text-emerald">${w.seed}</td>
          <td>${new Date(w.updated_at).toLocaleTimeString()}</td>
          <td>
            <button class="btn btn-emerald" style="padding:2px 8px;font-size:10px;" onclick="window.loadWorldById(${w.id})">LOAD</button>
          </td>
        `;
        worldsTableBody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  window.loadWorldById = async function(id) {
    try {
      const res = await fetch(`/api/worlds/${id}`);
      const data = await res.json();
      currentWorldId = data.id;
      generateWorld(data.seed);
      player.x = data.player_x;
      player.y = data.player_y;
      timeOfDay = data.time_of_day;
      if (data.inventory && data.inventory.length) {
        inventory = data.inventory;
      }
      renderHotbar();
      renderRecipes();
      worldsModal.classList.add('hidden');
    } catch (e) {
      console.error(e);
    }
  };

  btnSaveWorld.addEventListener('click', saveActiveWorld);
  btnWorldsList.addEventListener('click', openWorldsModal);
  btnCloseWorldsModal.addEventListener('click', () => worldsModal.classList.add('hidden'));

  btnCreateWorld.addEventListener('click', async () => {
    const name = newWorldName.value.trim() || 'Forest Outpost';
    const seed = newWorldSeed.value ? parseInt(newWorldSeed.value) : Math.floor(Math.random() * 900000 + 100000);

    const res = await fetch('/api/worlds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, seed })
    });
    const d = await res.json();
    if (d.status === 'created') {
      window.loadWorldById(d.id);
    }
  });

  // Game Loop (60 FPS)
  function loop() {
    updatePhysicsVoxel();
    updatePlayer();
    updateMining();
    updateCamera();
    render();
    requestAnimationFrame(loop);
  }

  // Boot
  generateWorld(worldSeed);
  renderHotbar();
  renderRecipes();
  requestAnimationFrame(loop);

})();

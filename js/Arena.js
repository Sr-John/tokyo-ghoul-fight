/**
 * A arena onde se luta: céu, horizonte, prédios e chão.
 *
 * Tudo é desenhado a código, mas gerado **uma só vez** no construtor. Se os
 * prédios e as janelas fossem sorteados a cada frame, o cenário tremia; o
 * gerador tem semente fixa, por isso a arena é sempre a mesma.
 *
 * O `groundY` é a linha onde os lutadores assentam os pés — não o fundo do
 * canvas. É o que permite ter chão desenhado por baixo deles.
 *
 * Com uma fotografia em `backdrop`, ela toma o lugar do céu e dos prédios:
 * o chão continua a ser o desenhado.
 */

const PALETTE = {
  skyTop: '#0b0d18',
  skyMid: '#1c1f35',
  moon: '#f3efe2',
  moonGlow: 'rgba(243, 239, 226, 0.12)',
  buildingsFar: '#171a2b',
  buildingsNear: '#0e1019',
  windowWarm: 'rgba(255, 196, 112, 0.75)',
  windowCold: 'rgba(150, 200, 255, 0.55)',
  groundTop: '#23212b',
  groundBottom: '#121218',
  groundLine: '#3d3a48',
  haze: 'rgba(224, 23, 51, 0.06)',
};

/** Gerador com semente: mesma semente, mesma arena, sempre. */
function createRandom(seed) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Arena {
  constructor({ width, height, groundY = Math.round(height * 0.82), seed = 20261 }) {
    this.width = width;
    this.height = height;
    this.groundY = groundY;

    /** Imagem de fundo, ou null para o cenário desenhado a código. */
    this.backdrop = null;

    const random = createRandom(seed);

    this.moon = { x: width * 0.78, y: height * 0.18, radius: 34 };

    // Duas camadas de prédios: a de trás mais clara e mais baixa, a da frente
    // mais escura e mais alta. É esse contraste que dá profundidade.
    this.farBuildings = this.generateSkyline(random, {
      count: 16,
      minWidth: 50,
      maxWidth: 110,
      minHeight: 110,
      maxHeight: 240,
      baseY: groundY - 26,
      windowChance: 0.35,
    });

    this.nearBuildings = this.generateSkyline(random, {
      count: 10,
      minWidth: 80,
      maxWidth: 150,
      minHeight: 180,
      maxHeight: 330,
      baseY: groundY,
      windowChance: 0.22,
    });
  }

  generateSkyline(random, config) {
    const buildings = [];
    let x = -40;

    while (x < this.width + 40 && buildings.length < config.count) {
      const width = config.minWidth + random() * (config.maxWidth - config.minWidth);
      const height = config.minHeight + random() * (config.maxHeight - config.minHeight);
      const windows = [];

      // Janelas em grelha, com só algumas acesas.
      for (let wy = config.baseY - height + 14; wy < config.baseY - 16; wy += 16) {
        for (let wx = x + 8; wx < x + width - 10; wx += 14) {
          if (random() > config.windowChance) continue;
          windows.push({
            x: wx,
            y: wy,
            cold: random() > 0.7,
          });
        }
      }

      buildings.push({ x, y: config.baseY - height, width, height, windows });
      x += width - random() * 12;
    }

    return buildings;
  }

  draw(ctx) {
    if (this.backdrop) {
      this.drawBackdrop(ctx);
    } else {
      this.drawSky(ctx);
      this.drawMoon(ctx);
      this.drawBuildings(ctx, this.farBuildings, PALETTE.buildingsFar);
      this.drawBuildings(ctx, this.nearBuildings, PALETTE.buildingsNear);
    }
    this.drawGround(ctx);
  }

  /**
   * A fotografia enche tudo o que fica acima do chão, sem deformar: o que
   * sobrar corta-se em cima, para a base dela assentar na linha do chão.
   */
  drawBackdrop(ctx) {
    const { naturalWidth, naturalHeight } = this.backdrop;
    const scale = Math.max(this.width / naturalWidth, this.groundY / naturalHeight);
    const cropWidth = this.width / scale;
    const cropHeight = this.groundY / scale;

    ctx.save();
    // Ao contrário da pixel art, uma fotografia quer-se suavizada.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.backdrop,
      (naturalWidth - cropWidth) / 2,
      naturalHeight - cropHeight,
      cropWidth,
      cropHeight,
      0,
      0,
      this.width,
      this.groundY,
    );
    ctx.restore();
  }

  drawSky(ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, this.groundY);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.65, PALETTE.skyMid);
    sky.addColorStop(1, '#2a2438');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.groundY);

    // Véu avermelhado sobre o horizonte, para o cenário não ler como azul frio.
    ctx.fillStyle = PALETTE.haze;
    ctx.fillRect(0, this.groundY - 180, this.width, 180);
  }

  drawMoon(ctx) {
    const { x, y, radius } = this.moon;

    const glow = ctx.createRadialGradient(x, y, radius * 0.6, x, y, radius * 4);
    glow.addColorStop(0, PALETTE.moonGlow);
    glow.addColorStop(1, 'rgba(243, 239, 226, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.moon;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBuildings(ctx, buildings, color) {
    ctx.fillStyle = color;
    for (const building of buildings) {
      ctx.fillRect(building.x, building.y, building.width, building.height);
    }

    for (const building of buildings) {
      for (const window of building.windows) {
        ctx.fillStyle = window.cold ? PALETTE.windowCold : PALETTE.windowWarm;
        ctx.fillRect(window.x, window.y, 5, 7);
      }
    }
  }

  drawGround(ctx) {
    const ground = ctx.createLinearGradient(0, this.groundY, 0, this.height);
    ground.addColorStop(0, PALETTE.groundTop);
    ground.addColorStop(1, PALETTE.groundBottom);
    ctx.fillStyle = ground;
    ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

    // Linha do chão: marca onde os pés assentam, e ajuda a leitura da altura
    // nos saltos.
    ctx.fillStyle = PALETTE.groundLine;
    ctx.fillRect(0, this.groundY, this.width, 2);
  }
}

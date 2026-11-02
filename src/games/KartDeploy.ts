import Phaser from 'phaser';
import kartUrl from '../assets/games/kart.webp';
import crateUrl from '../assets/games/crate.webp';
import rackUrl from '../assets/games/rack.webp';
import droneUrl from '../assets/games/drone.webp';
import coneUrl from '../assets/games/cone.webp';
import commitUrl from '../assets/games/commit.webp';
import musicUrl from '../assets/games/musica/kart.mp3';
import { ArcadeScene, COLORS, HEIGHT, SANS, WIDTH } from './ArcadeScene';
import { sfx } from './sfx';

const GROUND = 456;
const ROAD_TOP = 420;
const KART_X = 190;
const KART_SCALE = 0.33;
const COIN_SCALE = 0.36;
const GRAVITY = 2600;

type ObstacleKind = 'block' | 'rack' | 'drone' | 'cone';
type PowerKind = 'shield' | 'turbo' | 'magnet';

interface Thing {
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
    kind: ObstacleKind | 'coin' | PowerKind;
    w: number;
    h: number;
    /** Distância do chão até a base do objeto. */
    lift: number;
}

/** Cada etapa tem o próprio céu (de cima até o horizonte), sol e tom das silhuetas. */
const STAGES = [
    { name: 'Dev', at: 0, sub: 'Aquecendo os motores', sky: ['#0b1030', '#3b1f6b', '#c2477a', '#ff9a5c'], sun: 0xffb46b, far: 0x4a2a7a, mid: 0x1e1440 },
    { name: 'Staging', at: 600, sub: 'Testes rodando: a pista acelera', sky: ['#04202e', '#0f5566', '#3aa39a', '#ffdca6'], sun: 0xfff0c0, far: 0x1c6b70, mid: 0x0b3040 },
    { name: 'Produção', at: 1600, sub: 'Agora é para valer', sky: ['#14060f', '#4a0f2a', '#b5213a', '#ff7a3c'], sun: 0xff5a36, far: 0x6e1a30, mid: 0x2a0a18 },
    { name: 'Black Friday', at: 3000, sub: 'Pico de acessos!', sky: ['#120b02', '#4a2f06', '#a8740a', '#ffd84d'], sun: 0xffe58a, far: 0x7a5410, mid: 0x2e1e06 },
    { name: 'Escala global', at: 5000, sub: 'Milhões de requisições por minuto', sky: ['#020d14', '#063a3f', '#0e7a66', '#7df5c0'], sun: 0xc8ffe8, far: 0x0f5c54, mid: 0x062a2c },
];

/**
 * Kart Deploy: corrida infinita até o deploy. Pulo variável e duplo, agachar
 * sob drones, poderes (escudo, turbo e ímã) e fases que mudam o cenário.
 */
export class KartDeploy extends ArcadeScene {
    readonly gameId = 'kart-deploy';
    readonly title = 'Kart Deploy';
    readonly hint = 'Espaço, seta para cima ou toque para pular (segure para ir mais alto; dá para pular duas vezes). Seta para baixo ou deslize o dedo para baixo para agachar sob os drones.';
    readonly medals: [number, number, number] = [1000, 3000, 7000];
    protected music = musicUrl;

    private kart!: Phaser.GameObjects.Sprite;
    private kartShadow!: Phaser.GameObjects.Image;
    private flame!: Phaser.GameObjects.Particles.ParticleEmitter;
    private shieldRing!: Phaser.GameObjects.Arc;
    private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
    private lines!: Phaser.GameObjects.Particles.ParticleEmitter;
    private skies: Phaser.GameObjects.Image[] = [];
    private sun!: Phaser.GameObjects.Image;
    private stars!: Phaser.GameObjects.Graphics;
    private clouds!: Phaser.GameObjects.TileSprite;
    private layers: Phaser.GameObjects.TileSprite[] = [];
    private road!: Phaser.GameObjects.TileSprite;
    private things: Thing[] = [];
    private hudText!: Phaser.GameObjects.Text;
    private powerBar!: Phaser.GameObjects.Graphics;

    private y = GROUND;
    private vy = 0;
    private onGround = true;
    private jumpsUsed = 0;
    private lastGround = 0;
    private jumpPressedAt = -1000;
    private holding = false;
    private ducking = false;
    private swipeStart?: number;

    private speed = 380;
    private distance = 0;
    private coins = 0;
    private coinStreak = 0;
    private jumps = 0;
    private stage = 0;
    private nextObstacleAt = 0;
    private nextCoinsAt = 0;
    private nextPowerAt = 0;
    private shield = false;
    private turboUntil = 0;
    private magnetUntil = 0;

    constructor() {
        super('kart-deploy');
    }

    preload() {
        if (this.textures.exists('kart3d')) return;
        this.load.spritesheet('kart3d', kartUrl, { frameWidth: 300, frameHeight: 170 });
        this.load.image('ob-crate', crateUrl);
        this.load.image('ob-rack', rackUrl);
        this.load.image('ob-drone', droneUrl);
        this.load.image('ob-cone', coneUrl);
        this.load.image('commit', commitUrl);
    }

    protected build() {
        this.makeTextures();
        Object.assign(this, {
            things: [], y: GROUND, vy: 0, onGround: true, jumpsUsed: 0, lastGround: 0, jumpPressedAt: -1000, holding: false, ducking: false,
            speed: 380, distance: 0, coins: 0, coinStreak: 0, jumps: 0, stage: 0, shield: false, turboUntil: 0, magnetUntil: 0,
        });

        this.legend = [
            { key: 'ob-crate', label: 'Erro: pule', scale: 0.42 },
            { key: 'ob-drone', label: 'Drone: agache ou pule', scale: 0.42 },
            { key: 'commit', label: 'Commit: pontos', scale: COIN_SCALE },
            { key: 'pw-shield', label: 'Escudo de CI', scale: 0.8 },
            { key: 'pw-turbo', label: 'Turbo: atravessa tudo', scale: 0.8 },
            { key: 'pw-magnet', label: 'Ímã de commits', scale: 0.8 },
        ];

        this.skies = STAGES.map((_stage, i) => this.add.image(0, 0, `sky-${i}`).setOrigin(0).setAlpha(i ? 0 : 1));
        this.stars = this.add.graphics();
        for (let i = 0; i < 90; i++) {
            this.stars.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.15, 0.8)).fillCircle(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(0, 210), Phaser.Math.FloatBetween(0.6, 1.5));
        }
        this.sun = this.add.image(690, 262, 'sun').setTint(STAGES[0]!.sun);
        this.tweens.add({ targets: this.sun, scale: { from: 1, to: 1.05 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.clouds = this.add.tileSprite(0, 40, WIDTH, 180, 'clouds').setOrigin(0).setAlpha(0.32);
        this.layers = [
            this.add.tileSprite(0, 150, WIDTH, 270, 'bg-mount').setOrigin(0).setTint(STAGES[0]!.far),
            this.add.tileSprite(0, 150, WIDTH, 270, 'bg-city').setOrigin(0).setTint(STAGES[0]!.mid),
            this.add.tileSprite(0, 300, WIDTH, 120, 'bg-near').setOrigin(0),
        ];
        this.add.image(0, ROAD_TOP, 'road-shade').setOrigin(0);
        this.road = this.add.tileSprite(0, ROAD_TOP, WIDTH, HEIGHT - ROAD_TOP, 'road').setOrigin(0);

        this.dust = this.add.particles(0, 0, 'ui-dot', {
            speedX: { min: -260, max: -120 },
            speedY: { min: -60, max: -10 },
            lifespan: 420,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.5, end: 0 },
            tint: 0x9a9aa8,
            frequency: 40,
        });
        this.dust.setDepth(39);
        this.flame = this.add.particles(0, 0, 'ui-dot', {
            speedX: { min: -300, max: -160 },
            speedY: { min: -20, max: 20 },
            lifespan: 180,
            scale: { start: 0.42, end: 0 },
            tint: [0xfff0a0, 0xff9a2a, 0xff4a1a],
            blendMode: Phaser.BlendModes.ADD,
            frequency: 26,
        });
        this.flame.setDepth(39);
        this.lines = this.add.particles(0, 0, 'ui-square', {
            x: WIDTH + 10,
            y: { min: 60, max: GROUND - 20 },
            speedX: { min: -1600, max: -1100 },
            scaleX: { min: 6, max: 12 },
            scaleY: 0.25,
            lifespan: 700,
            alpha: 0.5,
            tint: COLORS.yellow,
            frequency: 30,
            emitting: false,
        });

        if (!this.anims.exists('kart-roll')) this.anims.create({ key: 'kart-roll', frames: this.anims.generateFrameNumbers('kart3d', { start: 0, end: 3 }), frameRate: 26, repeat: -1 });
        this.kartShadow = this.add.image(KART_X, GROUND + 3, 'shadow').setDepth(38);
        this.kart = this.add.sprite(KART_X, GROUND, 'kart3d').setOrigin(0.5, 0.87).setScale(KART_SCALE).setDepth(40).play('kart-roll');
        this.shieldRing = this.add.circle(KART_X, GROUND - 28, 58).setStrokeStyle(3, COLORS.green, 0.9).setFillStyle(COLORS.green, 0.12).setDepth(41).setVisible(false);

        this.hudText = this.add.text(24, 44, '', { fontFamily: SANS, fontSize: '13px', fontStyle: '400', color: '#d4d2cc' }).setDepth(80);
        this.powerBar = this.add.graphics().setDepth(80);

        // Controles.
        const press = () => this.press();
        const release = () => (this.holding = false);
        const kb = this.input.keyboard;
        kb?.on('keydown-SPACE', press).on('keydown-UP', press).on('keydown-W', press);
        kb?.on('keyup-SPACE', release).on('keyup-UP', release).on('keyup-W', release);
        kb?.on('keydown-DOWN', () => this.setDuck(true)).on('keydown-S', () => this.setDuck(true));
        kb?.on('keyup-DOWN', () => this.setDuck(false)).on('keyup-S', () => this.setDuck(false));
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            this.swipeStart = p.worldY;
            press();
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (p.isDown && this.swipeStart !== undefined && p.worldY - this.swipeStart > 40) this.setDuck(true);
        });
        this.input.on('pointerup', () => {
            release();
            this.swipeStart = undefined;
            this.setDuck(false);
        });
    }

    /** Tela desenhada à mão no canvas: dá para usar gradiente, que os Graphics do Phaser não fazem bem. */
    private paint(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
        const texture = this.textures.createCanvas(key, w, h)!;
        draw(texture.getContext());
        texture.refresh();
    }

    private makeTextures() {
        if (this.textures.exists('sky-0')) return;
        const rnd = new Phaser.Math.RandomDataGenerator(['kart']);

        STAGES.forEach((stage, i) =>
            this.paint(`sky-${i}`, WIDTH, ROAD_TOP, (c) => {
                const sky = c.createLinearGradient(0, 0, 0, ROAD_TOP);
                stage.sky.forEach((color, n) => sky.addColorStop([0, 0.42, 0.76, 1][n]!, color));
                c.fillStyle = sky;
                c.fillRect(0, 0, WIDTH, ROAD_TOP);
            }),
        );

        this.paint('sun', 340, 340, (c) => {
            const glow = c.createRadialGradient(170, 170, 40, 170, 170, 170);
            glow.addColorStop(0, 'rgba(255,255,255,0.8)');
            glow.addColorStop(0.5, 'rgba(255,255,255,0.14)');
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = glow;
            c.fillRect(0, 0, 340, 340);
            c.fillStyle = '#fff';
            c.beginPath();
            c.arc(170, 170, 78, 0, Math.PI * 2);
            c.fill();
            // Faixas horizontais na base do sol.
            c.globalCompositeOperation = 'destination-out';
            for (let i = 0; i < 6; i++) c.fillRect(0, 186 + i * 12, 340, 2 + i * 1.3);
        });

        this.paint('clouds', 1024, 180, (c) => {
            for (let i = 0; i < 22; i++) {
                const x = rnd.between(0, 1024);
                const y = rnd.between(20, 160);
                const w = rnd.between(120, 300);
                const puff = c.createRadialGradient(x, y, 0, x, y, w / 2);
                puff.addColorStop(0, 'rgba(255,255,255,0.5)');
                puff.addColorStop(1, 'rgba(255,255,255,0)');
                c.fillStyle = puff;
                c.save();
                c.translate(0, y);
                c.scale(1, 0.22);
                c.translate(0, -y);
                c.fillRect(x - w, y - w, w * 2, w * 2);
                c.restore();
            }
        });

        this.paint('bg-mount', 1024, 270, (c) => {
            const ridge = (base: number, height: number, alpha: number, seed: number) => {
                c.fillStyle = `rgba(255,255,255,${alpha})`;
                c.beginPath();
                c.moveTo(0, 270);
                for (let x = 0; x <= 1024; x += 8) {
                    // Só múltiplos inteiros da largura: o desenho emenda sem corte.
                    const a = (x / 1024) * Math.PI * 2;
                    const y = base - (Math.sin(a * 2 + seed) * 0.5 + Math.sin(a * 5 + seed * 2) * 0.3 + Math.sin(a * 11 + seed * 3) * 0.13 + 0.8) * height;
                    c.lineTo(x, y);
                }
                c.lineTo(1024, 270);
                c.closePath();
                c.fill();
            };
            ridge(230, 90, 0.55, 1.3);
            ridge(258, 70, 1, 4.1);
        });

        this.paint('bg-city', 1024, 270, (c) => {
            let x = 0;
            const lit = ['#ffd84d', '#fff3c4', '#7de8ff', '#ff9ec6'];
            while (x < 1024) {
                const w = Math.min(rnd.between(44, 96), 1024 - x);
                const h = rnd.between(70, 215);
                const top = 270 - h;
                c.fillStyle = '#fff';
                c.fillRect(x, top, w - 4, h);
                if (rnd.frac() > 0.65) c.fillRect(x + w / 2 - 2, top - 22, 3, 22);
                for (let y = top + 10; y < 262; y += 13) {
                    for (let lx = x + 7; lx < x + w - 12; lx += 11) {
                        if (rnd.frac() < 0.3) {
                            c.fillStyle = rnd.pick(lit);
                            c.fillRect(lx, y, 6, 6);
                        }
                    }
                }
                x += w;
            }
        });

        this.paint('bg-near', 1024, 120, (c) => {
            // Mureta com postes de luz.
            c.fillStyle = '#0a0a10';
            c.fillRect(0, 96, 1024, 24);
            c.fillStyle = 'rgba(255,255,255,0.1)';
            c.fillRect(0, 96, 1024, 2);
            for (let x = 40; x < 1024; x += 256) {
                c.fillStyle = '#0a0a10';
                c.fillRect(x, 8, 5, 96);
                c.fillRect(x, 8, 46, 4);
                const lamp = c.createRadialGradient(x + 44, 14, 0, x + 44, 14, 20);
                lamp.addColorStop(0, 'rgba(255,236,170,0.95)');
                lamp.addColorStop(1, 'rgba(255,236,170,0)');
                c.fillStyle = lamp;
                c.fillRect(x + 22, -6, 44, 42);
            }
            for (let x = 8; x < 1024; x += 32) {
                c.fillStyle = '#0a0a10';
                c.fillRect(x, 84, 3, 14);
            }
        });

        this.paint('road-shade', WIDTH, 26, (c) => {
            const shade = c.createLinearGradient(0, 0, 0, 26);
            shade.addColorStop(0, 'rgba(0,0,0,0.5)');
            shade.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = shade;
            c.fillRect(0, 0, WIDTH, 26);
        });

        this.paint('road', 256, HEIGHT - ROAD_TOP, (c) => {
            const h = HEIGHT - ROAD_TOP;
            const asphalt = c.createLinearGradient(0, 0, 0, h);
            asphalt.addColorStop(0, '#2a2a33');
            asphalt.addColorStop(0.5, '#1d1d25');
            asphalt.addColorStop(1, '#101016');
            c.fillStyle = asphalt;
            c.fillRect(0, 0, 256, h);
            for (let i = 0; i < 500; i++) {
                c.fillStyle = `rgba(255,255,255,${rnd.frac() * 0.045})`;
                c.fillRect(rnd.between(0, 255), rnd.between(10, h), 2, 1);
            }
            // Zebra da borda e faixa do meio.
            for (let x = 0; x < 256; x += 64) {
                c.fillStyle = '#e8352f';
                c.fillRect(x, 0, 32, 9);
                c.fillStyle = '#f4f4f2';
                c.fillRect(x + 32, 0, 32, 9);
            }
            c.fillStyle = 'rgba(255,255,255,0.14)';
            c.fillRect(0, 9, 256, 2);
            c.fillStyle = '#d9b000';
            c.fillRect(0, 76, 120, 5);
        });

        this.paint('shadow', 130, 22, (c) => {
            const blob = c.createRadialGradient(65, 11, 0, 65, 11, 65);
            blob.addColorStop(0, 'rgba(0,0,0,0.7)');
            blob.addColorStop(1, 'rgba(0,0,0,0)');
            c.save();
            c.scale(1, 22 / 130);
            c.translate(0, 0);
            c.fillStyle = blob;
            c.fillRect(0, 0, 130, 130);
            c.restore();
        });

        const g = this.add.graphics();
        const box = (key: string, color: number, glyph: () => void) => {
            g.fillStyle(color).fillRoundedRect(0, 0, 52, 52, 12);
            g.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(3, 3, 46, 46, 10);
            glyph();
            g.generateTexture(key, 52, 52);
            g.clear();
        };
        box('pw-shield', COLORS.green, () => {
            g.fillStyle(COLORS.black).fillPoints([new Phaser.Geom.Point(26, 11), new Phaser.Geom.Point(40, 17), new Phaser.Geom.Point(37, 33), new Phaser.Geom.Point(26, 42), new Phaser.Geom.Point(15, 33), new Phaser.Geom.Point(12, 17)], true);
        });
        box('pw-turbo', COLORS.yellow, () => {
            g.fillStyle(COLORS.black).fillPoints([new Phaser.Geom.Point(30, 9), new Phaser.Geom.Point(16, 29), new Phaser.Geom.Point(25, 29), new Phaser.Geom.Point(21, 44), new Phaser.Geom.Point(37, 22), new Phaser.Geom.Point(28, 22)], true);
        });
        box('pw-magnet', COLORS.cyan, () => {
            g.lineStyle(7, COLORS.black).beginPath().arc(26, 24, 11, Math.PI, 0, false).strokePath();
            g.fillStyle(COLORS.black).fillRect(11, 24, 8, 12).fillRect(33, 24, 8, 12);
            g.fillStyle(0xffffff).fillRect(11, 32, 8, 5).fillRect(33, 32, 8, 5);
        });
        g.destroy();
    }

    protected start() {
        this.nextObstacleAt = 900;
        this.nextCoinsAt = 500;
        this.nextPowerAt = 9000;
        this.banner('Dev', STAGES[0]!.sub);
    }

    protected onPause(paused: boolean) {
        this.dust.pause();
        this.flame.pause();
        if (!paused) {
            this.dust.resume();
            this.flame.resume();
        }
    }

    /* ---------- Controles ---------- */

    private press() {
        if (this.phase !== 'playing') return;
        this.holding = true;
        this.jumpPressedAt = this.elapsed;
    }

    private setDuck(on: boolean) {
        if (this.phase !== 'playing' || this.ducking === on) return;
        this.ducking = on;
        if (on) sfx.duck();
    }

    private tryJump() {
        const coyote = this.elapsed - this.lastGround < 100;
        const canFirst = this.onGround || (coyote && this.jumpsUsed === 0);
        if (!canFirst && this.jumpsUsed >= 2) return false;
        const second = !canFirst;
        this.vy = second ? -800 : -930;
        this.jumpsUsed = second ? 2 : 1;
        this.onGround = false;
        this.ducking = false;
        this.jumps++;
        sfx.jump(second);
        if (second) this.burst(this.kart.x - 20, this.y - 10, COLORS.yellow, 10, 160);
        if (second) this.tweens.add({ targets: this.kart, angle: { from: -360, to: 0 }, duration: 480, ease: 'Cubic.Out' });
        return true;
    }

    /* ---------- Objetos da pista ---------- */

    private track(thing: Thing) {
        this.things.push(thing);
        return thing;
    }

    /** Obstáculo apoiado no chão, com sombra própria. */
    private grounded(key: string, x: number, scale: number, originY: number, extra: Phaser.GameObjects.GameObject[] = []) {
        const shadow = this.add.image(0, 3, 'shadow').setScale(scale * 1.6, 1);
        const image = this.add.image(0, 0, key).setOrigin(0.5, originY).setScale(scale);
        return this.add.container(x, GROUND, [shadow, image, ...extra]).setDepth(30);
    }

    private spawnObstacle() {
        const level = this.stage;
        const roll = Math.random();
        const x = WIDTH + 60;
        let kind: ObstacleKind = 'block';
        if (level >= 1 && roll < 0.28) kind = 'drone';
        else if (level >= 1 && roll < 0.45) kind = 'rack';
        else if (roll < 0.72) kind = 'cone';

        if (kind === 'drone') {
            const drone = this.add.image(0, 0, 'ob-drone').setScale(0.42);
            const box = this.add.container(x, GROUND - 58, [drone]).setDepth(30);
            this.tweens.add({ targets: drone, y: -5, angle: { from: -3, to: 3 }, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
            this.track({ sprite: box, kind, w: 66, h: 30, lift: 42 });
        } else if (kind === 'rack') {
            this.track({ sprite: this.grounded('ob-rack', x, 0.42, 0.96), kind, w: 42, h: 110, lift: 0 });
        } else if (kind === 'cone') {
            // Fileira de cones: pede um pulo mais longo conforme a etapa.
            const count = Phaser.Math.Between(1, Math.min(3, 1 + level));
            for (let i = 0; i < count; i++) this.track({ sprite: this.grounded('ob-cone', x + i * 40, 0.42, 0.96), kind, w: 26, h: 42, lift: 0 });
        } else {
            const label = Phaser.Utils.Array.GetRandom(['500', 'BUG', '404', 'NaN']);
            const text = this.add.text(-3, -24, label, { fontFamily: SANS, fontSize: '14px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
            this.track({ sprite: this.grounded('ob-crate', x, 0.42, 0.85, [text]), kind, w: 50, h: 46, lift: 0 });
            if (level >= 2 && Math.random() < 0.35) this.track({ sprite: this.grounded('ob-crate', x + 58, 0.42, 0.85), kind, w: 50, h: 46, lift: 0 });
        }
        this.clearCoins();
    }

    /**
     * Altura (centro, acima do chão) em que uma moeda na posição x não fica dentro de nenhum obstáculo:
     * sobe por cima de blocos e racks; no drone, passa por baixo (pega agachado) ou por cima.
     */
    private safeLift(x: number, lift: number) {
        for (const thing of this.things) {
            if (thing.kind !== 'block' && thing.kind !== 'rack' && thing.kind !== 'drone' && thing.kind !== 'cone') continue;
            if (Math.abs(thing.sprite.x - x) > thing.w / 2 + 34) continue;
            if (thing.kind === 'drone') {
                const center = thing.lift + thing.h / 2;
                if (Math.abs(lift - center) < thing.h / 2 + 28) lift = lift < center ? 28 : center + thing.h / 2 + 34;
            } else {
                lift = Math.max(lift, thing.h + 38);
            }
        }
        return lift;
    }

    private placeCoin(thing: Thing, lift: number) {
        thing.sprite.y = GROUND - lift;
        thing.lift = lift - 15;
    }

    private spawnCoins() {
        const pattern = Phaser.Math.Between(0, 2);
        const count = Phaser.Math.Between(4, 7);
        for (let i = 0; i < count; i++) {
            let lift = 34;
            if (pattern === 1) lift = 60 + Math.sin((i / (count - 1)) * Math.PI) * 120;
            if (pattern === 2) lift = 170;
            const x = WIDTH + 40 + i * 46;
            const coin = this.add.image(x, 0, 'commit').setScale(COIN_SCALE).setDepth(35);
            this.tweens.add({ targets: coin, scaleX: { from: COIN_SCALE, to: COIN_SCALE * 0.25 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: i * 60 });
            this.placeCoin(this.track({ sprite: coin, kind: 'coin', w: 30, h: 30, lift: 0 }), this.safeLift(x, lift));
        }
    }

    /** Um obstáculo novo empurra as moedas que já estavam no caminho dele. */
    private clearCoins() {
        for (const thing of this.things) {
            if (thing.kind !== 'coin') continue;
            const lift = thing.lift + 15;
            const safe = this.safeLift(thing.sprite.x, lift);
            if (safe !== lift) this.placeCoin(thing, safe);
        }
    }

    private spawnPower() {
        const kind = Phaser.Utils.Array.GetRandom<PowerKind>(this.shield ? ['turbo', 'magnet'] : ['shield', 'turbo', 'magnet']);
        const icon = this.add.image(WIDTH + 40, GROUND - 150, `pw-${kind}`).setDepth(36);
        this.tweens.add({ targets: icon, y: GROUND - 170, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.track({ sprite: icon, kind, w: 48, h: 48, lift: 126 });
    }

    private collectPower(kind: PowerKind) {
        sfx.powerup();
        if (kind === 'shield') {
            this.shield = true;
            this.shieldRing.setVisible(true);
            this.banner('Escudo de CI', 'O próximo erro não derruba o deploy', COLORS.green);
        } else if (kind === 'turbo') {
            this.turboUntil = this.elapsed + 3500;
            this.lines.emitting = true;
            this.banner('Turbo!', 'Atravesse tudo por 3,5 segundos', COLORS.yellow);
        } else {
            this.magnetUntil = this.elapsed + 8000;
            this.banner('Ímã de commits', 'Os commits vêm até você', COLORS.cyan);
        }
    }

    private crash(thing: Thing) {
        if (this.elapsed < this.turboUntil) {
            sfx.hit(0.8);
            this.burst(thing.sprite.x, GROUND - thing.lift - thing.h / 2, COLORS.red, 16, 300);
            this.ring(thing.sprite.x, GROUND - thing.lift - thing.h / 2, COLORS.yellow, 70);
            this.addScore(25, thing.sprite.x, GROUND - thing.lift - thing.h - 10);
            this.remove(thing);
            return;
        }
        if (this.shield) {
            this.shield = false;
            this.shieldRing.setVisible(false);
            this.coinStreak = 0;
            sfx.shield();
            this.cameras.main.flash(200, 52, 211, 153);
            this.burst(this.kart.x, this.y - 40, COLORS.green, 26, 320);
            this.ring(this.kart.x, this.y - 30, COLORS.green, 110);
            this.remove(thing);
            return;
        }

        sfx.explode();
        this.hitStop(90);
        this.dust.stop();
        this.flame.stop();
        this.kart.stop();
        this.ring(this.kart.x, this.y - 30, COLORS.red, 130, 6);
        this.lines.emitting = false;
        this.burst(this.kart.x, this.y - 40, COLORS.red, 30, 420);
        this.burst(this.kart.x, this.y - 40, 0x5a5a62, 16, 300, 'ui-square');
        this.tweens.add({ targets: this.kart, angle: 200, x: this.kart.x + 80, y: this.y - 120, alpha: 0.6, duration: 600, ease: 'Cubic.Out' });
        this.kart.setTint(0xff9a9a);
        this.updateStats();
        this.endGame();
    }

    private remove(thing: Thing) {
        Phaser.Utils.Array.Remove(this.things, thing);
        thing.sprite.destroy();
    }

    private updateStats() {
        this.stats = {
            Distância: `${Math.floor(this.distance).toLocaleString('pt-BR')} m`,
            Commits: String(this.coins),
            Etapa: STAGES[this.stage]!.name,
            Pulos: String(this.jumps),
        };
    }

    /** Troca de etapa: o céu funde, e sol e silhuetas mudam de tom. */
    private changeScenery(index: number) {
        const stage = STAGES[index]!;
        const before = STAGES[index - 1]!;
        this.skies[index]!.setDepth(-1 + index * 0.001);
        this.tweens.add({ targets: this.skies[index], alpha: 1, duration: 1400 });
        const mix = (from: number, to: number, t: number) => {
            const a = Phaser.Display.Color.ValueToColor(from);
            const b = Phaser.Display.Color.ValueToColor(to);
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, t * 100);
            return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        };
        this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 1400,
            onUpdate: (tween) => {
                const t = tween.getValue() ?? 0;
                this.sun.setTint(mix(before.sun, stage.sun, t));
                this.layers[0]!.setTint(mix(before.far, stage.far, t));
                this.layers[1]!.setTint(mix(before.mid, stage.mid, t));
            },
        });
    }

    /* ---------- Quadro a quadro ---------- */

    protected step(time: number, delta: number) {
        const dt = delta / 1000;
        const turbo = time < this.turboUntil;
        if (!turbo && this.lines.emitting) this.lines.emitting = false;

        const base = Math.min(820, 380 + this.distance * 0.07);
        this.speed = base * (turbo ? 1.6 : 1);
        const before = Math.floor(this.distance);
        this.distance += (this.speed * dt) / 10;
        if (Math.floor(this.distance) > before) this.addScore(Math.floor(this.distance) - before);

        // Fases.
        const nextStage = STAGES[this.stage + 1];
        if (nextStage && this.distance >= nextStage.at) {
            this.stage++;
            sfx.levelUp();
            this.banner(nextStage.name, nextStage.sub);
            this.changeScenery(this.stage);
        }

        // Pulo com buffer e coyote time.
        if (time - this.jumpPressedAt < 130 && this.tryJump()) this.jumpPressedAt = -1000;

        // Física do kart.
        const fastFall = this.ducking && !this.onGround ? 2.4 : 1;
        this.vy += GRAVITY * fastFall * dt;
        if (!this.holding && this.vy < -380) this.vy = -380;
        this.y += this.vy * dt;
        if (this.y >= GROUND) {
            if (!this.onGround && this.vy > 400) {
                sfx.land();
                this.burst(this.kart.x, GROUND, 0x8a8a92, 8, 140);
                this.tweens.add({ targets: this.kart, scaleY: { from: this.kart.scaleX * 0.8, to: this.kart.scaleX }, duration: 160 });
            }
            this.y = GROUND;
            this.vy = 0;
            this.onGround = true;
            this.jumpsUsed = 0;
            this.lastGround = time;
        } else {
            this.onGround = false;
        }

        const duck = this.ducking && this.onGround;
        this.kart.setScale(duck ? KART_SCALE * 1.1 : KART_SCALE, duck ? KART_SCALE * 0.66 : this.kart.scaleY);
        if (!duck && this.kart.scaleY < KART_SCALE * 0.79) this.kart.scaleY = KART_SCALE;
        this.kart.y = this.y;
        // O bico acompanha o pulo: sobe ao subir, desce ao cair.
        if (!this.onGround && !this.tweens.isTweening(this.kart)) this.kart.angle = Phaser.Math.Clamp(this.vy / 60, -14, 12);
        else if (this.onGround && !this.tweens.isTweening(this.kart)) this.kart.angle = Math.sin(time / 50) * 0.5;
        this.kart.setAlpha(turbo ? 0.8 + Math.sin(time / 40) * 0.2 : 1);
        this.kart.anims.timeScale = this.speed / 400;

        const height = GROUND - this.y;
        this.kartShadow.setScale(Math.max(0.35, 1 - height / 260)).setAlpha(Math.max(0.25, 1 - height / 220));
        this.shieldRing.setPosition(this.kart.x, this.y - (duck ? 16 : 28));
        this.dust.setPosition(this.kart.x - 36, GROUND - 2);
        this.dust.emitting = this.onGround;
        this.flame.setPosition(this.kart.x - 49, this.y - 22 + (duck ? 6 : 0));
        this.flame.frequency = turbo ? 8 : 26;

        // Cenário.
        const scroll = this.speed * dt;
        this.clouds.tilePositionX += scroll * 0.02;
        this.layers[0]!.tilePositionX += scroll * 0.05;
        this.layers[1]!.tilePositionX += scroll * 0.14;
        this.layers[2]!.tilePositionX += scroll * 0.55;
        this.road.tilePositionX += scroll;

        // Novos objetos, com espaço mínimo que dê para reagir.
        if (time > this.nextObstacleAt) {
            this.spawnObstacle();
            const gap = Phaser.Math.FloatBetween(0.75, 1.5) * (1 - this.stage * 0.07);
            this.nextObstacleAt = time + Math.max(620, gap * 1000 * (520 / Math.max(this.speed, 380)) + 420);
        }
        if (time > this.nextCoinsAt) {
            this.spawnCoins();
            this.nextCoinsAt = time + Phaser.Math.Between(1600, 2800);
        }
        if (time > this.nextPowerAt) {
            this.spawnPower();
            this.nextPowerAt = time + Phaser.Math.Between(11000, 17000);
        }

        // Movimento e colisões.
        const kartH = duck ? 26 : 46;
        const kart = new Phaser.Geom.Rectangle(this.kart.x - 34, this.y - kartH, 68, kartH - 3);
        const magnet = time < this.magnetUntil;
        for (const thing of [...this.things]) {
            thing.sprite.x -= this.speed * dt;
            if (thing.kind === 'coin' && magnet) {
                const sprite = thing.sprite as Phaser.GameObjects.Image;
                const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, this.kart.x, this.y - 40);
                if (dist < 260) {
                    sprite.x += (this.kart.x - sprite.x) * 6 * dt;
                    sprite.y += (this.y - 40 - sprite.y) * 6 * dt;
                    thing.lift = GROUND - sprite.y - 15;
                }
            }
            if (thing.sprite.x < -100) {
                this.remove(thing);
                continue;
            }
            const box = new Phaser.Geom.Rectangle(thing.sprite.x - thing.w / 2, GROUND - thing.lift - thing.h, thing.w, thing.h);
            if (!Phaser.Geom.Intersects.RectangleToRectangle(kart, box)) continue;

            if (thing.kind === 'coin') {
                this.coins++;
                this.coinStreak++;
                const mult = Math.min(5, 1 + Math.floor(this.coinStreak / 8));
                sfx.coin(this.coinStreak % 12);
                this.addScore(10 * mult, thing.sprite.x, thing.sprite.y - 20);
                this.burst(thing.sprite.x, thing.sprite.y, COLORS.yellow, 6, 120);
                this.remove(thing);
            } else if (thing.kind === 'shield' || thing.kind === 'turbo' || thing.kind === 'magnet') {
                this.burst(thing.sprite.x, thing.sprite.y, 0xffffff, 18, 260);
                this.collectPower(thing.kind);
                this.remove(thing);
            } else {
                this.crash(thing);
                if (this.phase !== 'playing') return;
            }
        }

        // Barra do poder ativo.
        this.powerBar.clear();
        const active = turbo ? { left: this.turboUntil - time, total: 3500, color: COLORS.yellow } : magnet ? { left: this.magnetUntil - time, total: 8000, color: COLORS.cyan } : null;
        if (active) {
            this.powerBar.fillStyle(0x000000, 0.6).fillRect(WIDTH / 2 - 120, 70, 240, 8);
            this.powerBar.fillStyle(active.color).fillRect(WIDTH / 2 - 120, 70, 240 * (active.left / active.total), 8);
        }

        const mult = Math.min(5, 1 + Math.floor(this.coinStreak / 8));
        this.hudText.setText(`${Math.floor(this.distance).toLocaleString('pt-BR')} m  ·  ${this.coins} ${this.coins === 1 ? 'commit' : 'commits'}  ·  x${mult}  ·  ${STAGES[this.stage]!.name.toUpperCase()}`);
        this.updateStats();
    }
}

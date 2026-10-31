import Phaser from 'phaser';
import kartUrl from '../assets/erickcarrinho.png';
import { ArcadeScene, COLORS, HEIGHT, SANS, WIDTH } from './ArcadeScene';
import { sfx } from './sfx';

const GROUND = 456;
const KART_X = 190;
const GRAVITY = 2600;

type ObstacleKind = 'block' | 'rack' | 'drone';
type PowerKind = 'shield' | 'turbo' | 'magnet';

interface Thing {
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
    kind: ObstacleKind | 'coin' | PowerKind;
    w: number;
    h: number;
    /** Distância do chão até a base do objeto. */
    lift: number;
}

const STAGES = [
    { name: 'Dev', at: 0, sky: 0x0a0a0b, sub: 'Aquecendo os motores' },
    { name: 'Staging', at: 600, sky: 0x0b1424, sub: 'Testes rodando: a pista acelera' },
    { name: 'Produção', at: 1600, sky: 0x1a0b10, sub: 'Agora é para valer' },
    { name: 'Black Friday', at: 3000, sky: 0x1a1404, sub: 'Pico de acessos!' },
    { name: 'Escala global', at: 5000, sky: 0x08141a, sub: 'Milhões de requisições por minuto' },
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

    private kart!: Phaser.GameObjects.Image;
    private shieldRing!: Phaser.GameObjects.Arc;
    private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
    private lines!: Phaser.GameObjects.Particles.ParticleEmitter;
    private sky!: Phaser.GameObjects.Rectangle;
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
        if (!this.textures.exists('kart')) this.load.image('kart', kartUrl);
    }

    protected build() {
        this.makeTextures();
        Object.assign(this, {
            things: [], y: GROUND, vy: 0, onGround: true, jumpsUsed: 0, lastGround: 0, jumpPressedAt: -1000, holding: false, ducking: false,
            speed: 380, distance: 0, coins: 0, coinStreak: 0, jumps: 0, stage: 0, shield: false, turboUntil: 0, magnetUntil: 0,
        });

        this.legend = [
            { key: 'ob-block', label: 'Erro: pule', scale: 0.8 },
            { key: 'ob-drone', label: 'Drone: agache', scale: 0.8 },
            { key: 'commit', label: 'Commit: pontos' },
            { key: 'pw-shield', label: 'Escudo de CI', scale: 0.8 },
            { key: 'pw-turbo', label: 'Turbo: atravessa tudo', scale: 0.8 },
            { key: 'pw-magnet', label: 'Ímã de commits', scale: 0.8 },
        ];

        this.sky = this.add.rectangle(0, 0, WIDTH, HEIGHT, STAGES[0]!.sky).setOrigin(0);
        const stars = this.add.graphics();
        for (let i = 0; i < 70; i++) {
            stars.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.1, 0.5)).fillCircle(Phaser.Math.Between(0, WIDTH), Phaser.Math.Between(0, 260), Phaser.Math.FloatBetween(0.6, 1.6));
        }
        this.layers = [
            this.add.tileSprite(0, 130, WIDTH, 260, 'city-far').setOrigin(0).setAlpha(0.45),
            this.add.tileSprite(0, 196, WIDTH, 260, 'city-near').setOrigin(0),
        ];
        this.add.rectangle(0, GROUND, WIDTH, HEIGHT - GROUND, 0x18181c).setOrigin(0);
        this.add.rectangle(0, GROUND, WIDTH, 5, COLORS.yellow).setOrigin(0);
        this.road = this.add.tileSprite(0, GROUND + 36, WIDTH, 8, 'road-dash').setOrigin(0);

        this.dust = this.add.particles(0, 0, 'ui-dot', {
            speedX: { min: -260, max: -120 },
            speedY: { min: -60, max: -10 },
            lifespan: 420,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.5, end: 0 },
            tint: 0x8a8a92,
            frequency: 40,
        });
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

        this.kart = this.add.image(KART_X, GROUND, 'kart').setOrigin(0.5, 1).setDepth(40);
        const k = this.kart.width;
        this.kart.setScale(124 / k);
        this.shieldRing = this.add.circle(KART_X, GROUND - 46, 66).setStrokeStyle(4, COLORS.green, 0.9).setFillStyle(COLORS.green, 0.12).setDepth(41).setVisible(false);

        this.hudText = this.add.text(24, 44, '', { fontFamily: SANS, fontSize: '13px', fontStyle: '800', color: '#a3a3ab' }).setDepth(80);
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
            this.swipeStart = p.y;
            press();
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (p.isDown && this.swipeStart !== undefined && p.y - this.swipeStart > 40) this.setDuck(true);
        });
        this.input.on('pointerup', () => {
            release();
            this.swipeStart = undefined;
            this.setDuck(false);
        });
    }

    private makeTextures() {
        if (this.textures.exists('city-far')) return;

        const city = (key: string, color: number, light: number, seed: number) => {
            const g = this.add.graphics();
            const rnd = new Phaser.Math.RandomDataGenerator([String(seed)]);
            let x = 0;
            while (x < 512) {
                const w = rnd.between(38, 86);
                const h = rnd.between(80, 240);
                g.fillStyle(color).fillRect(x, 260 - h, w - 6, h);
                if (rnd.frac() > 0.6) g.fillStyle(light).fillRect(x + w / 2 - 4, 260 - h - 14, 2, 14);
                for (let y = 260 - h + 12; y < 250; y += 14) {
                    for (let lx = x + 8; lx < x + w - 14; lx += 12) {
                        g.fillStyle(rnd.frac() > 0.72 ? light : 0x2c2c33).fillRect(lx, y, 6, 4);
                    }
                }
                x += w;
            }
            g.generateTexture(key, 512, 260);
            g.destroy();
        };
        city('city-far', 0x15151a, 0x5a4b12, 1);
        city('city-near', 0x1d1d23, COLORS.yellow, 2);

        const g = this.add.graphics();
        g.fillStyle(0x4a4a52).fillRect(0, 0, 44, 8);
        g.generateTexture('road-dash', 88, 8);
        g.clear();

        g.fillStyle(COLORS.red).fillRoundedRect(0, 0, 56, 56, 6);
        g.fillStyle(0x7a1f1f).fillRect(0, 46, 56, 10);
        g.fillStyle(0xffffff).fillRect(10, 10, 36, 4);
        g.generateTexture('ob-block', 56, 56);
        g.clear();

        g.fillStyle(0x34343c).fillRect(0, 0, 48, 112);
        for (let y = 10; y < 104; y += 16) {
            g.fillStyle(0x24242a).fillRect(6, y, 36, 11);
            g.fillStyle(COLORS.red).fillCircle(36, y + 5, 2.5);
        }
        g.generateTexture('ob-rack', 48, 112);
        g.clear();

        // Drone: um bug com hélices.
        g.lineStyle(3, 0x9a9aa3).lineBetween(14, 10, 14, 2).lineBetween(62, 10, 62, 2);
        g.fillStyle(0x9a9aa3).fillRect(2, 0, 24, 3).fillRect(50, 0, 24, 3);
        g.fillStyle(COLORS.purple).fillEllipse(38, 24, 56, 28);
        g.fillStyle(0x3a3a42).fillCircle(64, 24, 9);
        g.fillStyle(0xffffff).fillCircle(66, 20, 2.5).fillCircle(66, 28, 2.5);
        g.fillStyle(0x5b3fa8).fillRect(36, 12, 3, 24);
        g.generateTexture('ob-drone', 76, 40);
        g.clear();

        g.fillStyle(COLORS.yellow).fillCircle(16, 16, 16);
        g.fillStyle(COLORS.black).fillCircle(16, 16, 6);
        g.lineStyle(4, COLORS.black).lineBetween(0, 16, 9, 16).lineBetween(23, 16, 32, 16);
        g.generateTexture('commit', 32, 32);
        g.clear();

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
        if (!paused) this.dust.resume();
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
        this.tweens.add({ targets: this.kart, angle: { from: second ? -360 : -10, to: 0 }, duration: second ? 480 : 380, ease: 'Cubic.Out' });
        return true;
    }

    /* ---------- Objetos da pista ---------- */

    private track(thing: Thing) {
        this.things.push(thing);
        return thing;
    }

    private spawnObstacle() {
        const level = this.stage;
        const roll = Math.random();
        let kind: ObstacleKind = 'block';
        if (level >= 1 && roll < 0.3) kind = 'drone';
        else if (level >= 1 && roll < 0.5) kind = 'rack';

        if (kind === 'drone') {
            const drone = this.add.image(WIDTH + 60, GROUND - 98, 'ob-drone').setDepth(30);
            this.tweens.add({ targets: drone, y: GROUND - 104, duration: 300, yoyo: true, repeat: -1 });
            this.track({ sprite: drone, kind, w: 62, h: 30, lift: 84 });
        } else if (kind === 'rack') {
            const rack = this.add.image(WIDTH + 60, GROUND, 'ob-rack').setOrigin(0.5, 1).setDepth(30);
            this.track({ sprite: rack, kind, w: 40, h: 108, lift: 0 });
        } else {
            const label = Phaser.Utils.Array.GetRandom(['500', 'BUG', '404', 'NaN']);
            const box = this.add.container(WIDTH + 60, GROUND, [
                this.add.image(0, 0, 'ob-block').setOrigin(0.5, 1),
                this.add.text(0, -24, label, { fontFamily: SANS, fontSize: '15px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5),
            ]).setDepth(30);
            this.track({ sprite: box, kind, w: 48, h: 52, lift: 0 });
            if (level >= 2 && Math.random() < 0.35) {
                const second = this.add.container(WIDTH + 130, GROUND, [this.add.image(0, 0, 'ob-block').setOrigin(0.5, 1)]).setDepth(30);
                this.track({ sprite: second, kind, w: 48, h: 52, lift: 0 });
            }
        }
    }

    private spawnCoins() {
        const pattern = Phaser.Math.Between(0, 2);
        const count = Phaser.Math.Between(4, 7);
        for (let i = 0; i < count; i++) {
            let lift = 34;
            if (pattern === 1) lift = 60 + Math.sin((i / (count - 1)) * Math.PI) * 120;
            if (pattern === 2) lift = 170;
            const coin = this.add.image(WIDTH + 40 + i * 46, GROUND - lift, 'commit').setDepth(35);
            this.tweens.add({ targets: coin, scaleX: { from: 1, to: 0.3 }, duration: 380, yoyo: true, repeat: -1, delay: i * 60 });
            this.track({ sprite: coin, kind: 'coin', w: 30, h: 30, lift: lift - 15 });
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
            this.remove(thing);
            return;
        }

        sfx.explode();
        this.dust.stop();
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
            this.tweens.addCounter({
                from: 0,
                to: 1,
                duration: 1200,
                onUpdate: (tw) => {
                    const from = Phaser.Display.Color.ValueToColor(STAGES[this.stage - 1]!.sky);
                    const to = Phaser.Display.Color.ValueToColor(nextStage.sky);
                    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, (tw.getValue() ?? 0) * 100);
                    this.sky.setFillStyle(Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b));
                },
            });
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

        const s = 124 / this.kart.width;
        const duck = this.ducking && this.onGround;
        this.kart.setScale(duck ? s * 1.12 : s, duck ? s * 0.6 : this.kart.scaleY);
        if (!duck && this.kart.scaleY < s * 0.79) this.kart.scaleY = s;
        this.kart.y = this.y;
        this.kart.setAlpha(turbo ? 0.75 + Math.sin(time / 40) * 0.25 : 1);
        this.shieldRing.setPosition(this.kart.x, this.y - (duck ? 26 : 46));
        this.dust.setPosition(this.kart.x - 46, GROUND - 4);
        this.dust.emitting = this.onGround;

        // Cenário.
        this.layers[0]!.tilePositionX += this.speed * dt * 0.12;
        this.layers[1]!.tilePositionX += this.speed * dt * 0.32;
        this.road.tilePositionX += this.speed * dt;

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
        const kartH = duck ? 30 : 60;
        const kart = new Phaser.Geom.Rectangle(this.kart.x - 40, this.y - kartH, 80, kartH - 4);
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

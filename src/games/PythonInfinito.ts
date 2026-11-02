import Phaser from 'phaser';
import { ArcadeScene, COLORS, HEIGHT, SANS, WIDTH } from './ArcadeScene';
import { sfx } from './sfx';
import musicUrl from '../assets/games/musica/snake.mp3';
import commitUrl from '../assets/games/commit.webp';
import crateUrl from '../assets/games/crate.webp';
import coneUrl from '../assets/games/cone.webp';

const CELL = 34;
const CHUNK_W = 12;
const CHUNK_H = 8;
const BLUE = 0x3b78c9;
const YELLOW = 0xf2c200;

type ItemKind = 'commit' | 'gold' | 'shield' | 'crate' | 'rack';

interface Item {
    kind: ItemKind;
    x: number;
    y: number;
    chunk: string;
    sprite: Phaser.GameObjects.Image;
}

interface Cell {
    x: number;
    y: number;
}

const DIRS: Record<string, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const DIFFICULTY = [
    { step: 1.22, density: 0.7 },
    { step: 1, density: 1 },
    { step: 0.8, density: 1.35 },
];

const key = (x: number, y: number) => `${x},${y}`;
const mixColor = (a: number, b: number, t: number) => {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 100, t * 100);
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

/**
 * Python Infinito: a cobrinha num mapa sem bordas. O mundo é gerado em blocos conforme ela avança, sempre
 * igual na mesma partida, e fica mais cheio de obstáculos quanto mais longe da origem.
 */
export class PythonInfinito extends ArcadeScene {
    readonly gameId = 'python-infinito';
    readonly title = 'Python Infinito';
    readonly hint = 'Setas, WASD ou deslize para virar. Coma commits para crescer; bater em você mesmo ou em um obstáculo acaba o jogo. O mapa não tem fim, e quanto mais longe, mais perigoso.';
    readonly medals: [number, number, number] = [800, 2500, 6000];
    protected music = musicUrl;
    protected levels = [
        { name: 'Júnior', text: 'mais lenta e com poucos obstáculos' },
        { name: 'Pleno', text: 'equilibrado · pontos x1,5' },
        { name: 'Sênior', text: 'rápida e com mais obstáculos · pontos x2' },
    ];

    private seed = 0;
    private body: Cell[] = [];
    private previous: Cell[] = [];
    private dir = DIRS.right!;
    private turns: Cell[] = [];
    private grow = 0;
    private progress = 0;
    private items = new Map<string, Item>();
    private chunks = new Set<string>();
    private eaten = new Set<string>();
    private world!: Phaser.GameObjects.Container;
    private tube!: Phaser.GameObjects.Graphics;
    private grid!: Phaser.GameObjects.TileSprite;
    private far!: Phaser.GameObjects.TileSprite;
    private camX = 0;
    private camY = 0;
    private combo = 0;
    private comboUntil = 0;
    private eatenCount = 0;
    private farthest = 0;
    private shield = false;
    private swipe: Cell | null = null;
    private hudText!: Phaser.GameObjects.Text;

    constructor() {
        super('python-infinito');
    }

    private get tuning() {
        return DIFFICULTY[this.level]!;
    }

    /** Tempo de cada passo: acelera com o tamanho, até um limite jogável. */
    private get stepTime() {
        return Math.max(68, 150 - this.body.length * 0.9) * this.tuning.step;
    }

    preload() {
        if (this.textures.exists('py-commit')) return;
        this.load.image('py-commit', commitUrl);
        this.load.image('py-crate', crateUrl);
        this.load.image('py-cone', coneUrl);
    }

    protected build() {
        this.makeTextures();
        const start = Array.from({ length: 5 }, (_, i) => ({ x: -i, y: 0 }));
        Object.assign(this, {
            seed: Math.floor(Math.random() * 1e6), body: start, previous: start.map((c) => ({ ...c })), dir: DIRS.right, turns: [], grow: 0, progress: 0,
            items: new Map(), chunks: new Set(), eaten: new Set(), camX: 0, camY: 0, combo: 0, comboUntil: 0, eatenCount: 0, farthest: 0, shield: false, swipe: null,
        });
        this.legend = [
            { key: 'py-commit', label: 'commit: cresce', scale: 0.32 },
            { key: 'py-gold', label: 'merge: 5 vezes mais' },
            { key: 'py-shield', label: 'escudo: salva uma batida' },
            { key: 'py-crate', label: 'erro: evite', scale: 0.26 },
            { key: 'py-cone', label: 'cone: evite', scale: 0.34 },
        ];

        this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x07090a).setOrigin(0);
        this.far = this.add.tileSprite(0, 0, WIDTH, HEIGHT, 'py-far').setOrigin(0);
        this.grid = this.add.tileSprite(0, 0, WIDTH, HEIGHT, 'py-grid').setOrigin(0);
        this.world = this.add.container(0, 0).setDepth(10);
        this.tube = this.add.graphics();
        this.world.add(this.tube);
        this.hudText = this.add.text(24, 42, '', { fontFamily: SANS, fontSize: '13px', fontStyle: '400', color: '#8d8c86' }).setDepth(80);

        const kb = this.input.keyboard;
        const bind: [string, string][] = [['UP', 'up'], ['W', 'up'], ['DOWN', 'down'], ['S', 'down'], ['LEFT', 'left'], ['A', 'left'], ['RIGHT', 'right'], ['D', 'right']];
        for (const [name, dir] of bind) kb?.on(`keydown-${name}`, () => this.turn(DIRS[dir]!));
        kb?.addCapture('UP,DOWN,LEFT,RIGHT');

        // Toque: deslizar vira; não precisa soltar o dedo.
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.swipe = { x: p.worldX, y: p.worldY }));
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!p.isDown || !this.swipe) return;
            const dx = p.worldX - this.swipe.x;
            const dy = p.worldY - this.swipe.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
            this.turn(Math.abs(dx) > Math.abs(dy) ? DIRS[dx > 0 ? 'right' : 'left']! : DIRS[dy > 0 ? 'down' : 'up']!);
            this.swipe = { x: p.worldX, y: p.worldY };
        });

        this.loadAround();
        this.follow(1);
        this.draw();
    }

    private makeTextures() {
        if (this.textures.exists('py-grid')) return;
        const rnd = new Phaser.Math.RandomDataGenerator(['python']);
        const paint = (name: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
            const texture = this.textures.createCanvas(name, w, h)!;
            draw(texture.getContext());
            texture.refresh();
        };
        paint('py-grid', CELL, CELL, (c) => {
            c.strokeStyle = 'rgba(242, 194, 0, 0.06)';
            c.strokeRect(0.5, 0.5, CELL, CELL);
        });
        paint('py-far', 512, 512, (c) => {
            for (let i = 0; i < 160; i++) {
                c.fillStyle = `rgba(232, 230, 223, ${rnd.realInRange(0.05, 0.3)})`;
                c.fillRect(rnd.between(0, 511), rnd.between(0, 511), 1, 1);
            }
        });
        paint('py-gold', 44, 44, (c) => {
            c.strokeStyle = '#f2c200';
            c.lineWidth = 3;
            c.beginPath();
            c.arc(22, 22, 13, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = '#f2c200';
            c.beginPath();
            c.arc(22, 22, 5, 0, Math.PI * 2);
            c.fill();
        });
        paint('py-shield', 44, 44, (c) => {
            c.fillStyle = '#34d399';
            c.beginPath();
            c.moveTo(22, 6);
            c.lineTo(36, 12);
            c.quadraticCurveTo(36, 30, 22, 38);
            c.quadraticCurveTo(8, 30, 8, 12);
            c.closePath();
            c.fill();
        });
    }

    protected start() {
        this.banner('Mapa sem fim', 'coma commits para crescer');
    }

    /* ---------- Mundo infinito ---------- */

    /** Gera o bloco uma vez por partida: o mesmo lugar sempre tem as mesmas coisas. */
    private makeChunk(cx: number, cy: number) {
        const id = key(cx, cy);
        if (this.chunks.has(id)) return;
        this.chunks.add(id);
        const rnd = new Phaser.Math.RandomDataGenerator([`${this.seed}:${id}`]);
        const far = Math.max(Math.abs(cx), Math.abs(cy));
        const place = (kind: ItemKind) => {
            const x = cx * CHUNK_W + rnd.between(0, CHUNK_W - 1);
            const y = cy * CHUNK_H + rnd.between(0, CHUNK_H - 1);
            const spot = key(x, y);
            // Longe da largada, e nunca em cima da cobra nem de outra coisa.
            if (this.items.has(spot) || this.eaten.has(spot) || (Math.abs(x) < 7 && Math.abs(y) < 4)) return;
            const sprite = this.makeSprite(kind, x, y);
            this.items.set(spot, { kind, x, y, chunk: id, sprite });
        };
        for (let i = 0; i < 3; i++) place('commit');
        if (rnd.frac() < 0.22) place('gold');
        if (rnd.frac() < 0.1) place('shield');
        const hazards = Math.min(9, (1 + far * 0.9) * this.tuning.density);
        for (let i = 0; i < hazards; i++) place(rnd.frac() < 0.6 ? 'crate' : 'rack');
    }

    private makeSprite(kind: ItemKind, x: number, y: number) {
        const textures = { commit: ['py-commit', 0.3], gold: ['py-gold', 0.8], shield: ['py-shield', 0.7], crate: ['py-crate', 0.25], rack: ['py-cone', 0.3] } as const;
        const [texture, scale] = textures[kind];
        const sprite = this.add.image((x + 0.5) * CELL, (y + 0.5) * CELL, texture).setScale(scale);
        this.world.addAt(sprite, 0);
        if (kind === 'commit' || kind === 'gold' || kind === 'shield') {
            this.tweens.add({ targets: sprite, scale: scale * 1.14, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        }
        return sprite;
    }

    private dropItem(item: Item) {
        this.items.delete(key(item.x, item.y));
        this.tweens.killTweensOf(item.sprite);
        item.sprite.destroy();
    }

    /** Mantém gerados os blocos em volta da cabeça e solta os que ficaram longe. */
    private loadAround() {
        const head = this.body[0]!;
        const cx = Math.floor(head.x / CHUNK_W);
        const cy = Math.floor(head.y / CHUNK_H);
        for (let x = cx - 2; x <= cx + 2; x++) for (let y = cy - 2; y <= cy + 2; y++) this.makeChunk(x, y);

        for (const id of [...this.chunks]) {
            const [x, y] = id.split(',').map(Number) as [number, number];
            if (Math.abs(x - cx) <= 4 && Math.abs(y - cy) <= 4) continue;
            this.chunks.delete(id);
            for (const item of [...this.items.values()]) {
                if (item.chunk !== id) continue;
                // O que foi deixado para trás volta igual, menos o que já foi comido.
                this.dropItem(item);
            }
        }
    }

    /* ---------- Movimento ---------- */

    private turn(dir: Cell) {
        if (this.phase !== 'playing') return;
        const last = this.turns[this.turns.length - 1] ?? this.dir;
        if (dir === last || (dir.x === -last.x && dir.y === -last.y) || this.turns.length >= 2) return;
        this.turns.push(dir);
    }

    private advance(time: number) {
        this.dir = this.turns.shift() ?? this.dir;
        const head = this.body[0]!;
        const next = { x: head.x + this.dir.x, y: head.y + this.dir.y };
        const spot = key(next.x, next.y);
        const item = this.items.get(spot);

        if (item?.kind === 'crate' || item?.kind === 'rack') {
            if (!this.shield) return this.die();
            this.shield = false;
            this.eaten.add(spot);
            sfx.shield();
            this.effect(item, COLORS.green);
            this.dropItem(item);
        }
        // A ponta do rabo sai do lugar neste passo, a não ser que a cobra esteja crescendo.
        const solid = this.grow > 0 ? this.body : this.body.slice(0, -1);
        if (solid.some((part) => part.x === next.x && part.y === next.y)) return this.die();

        this.previous = this.body.map((part) => ({ ...part }));
        this.body.unshift(next);
        if (this.grow > 0) {
            this.grow--;
            this.previous.push({ ...this.previous[this.previous.length - 1]! });
        } else {
            this.body.pop();
        }

        if (item?.kind === 'commit' || item?.kind === 'gold' || item?.kind === 'shield') this.eat(item, time);
        this.farthest = Math.max(this.farthest, Math.abs(next.x) + Math.abs(next.y));
        this.loadAround();
    }

    private eat(item: Item, time: number) {
        this.eaten.add(key(item.x, item.y));
        if (item.kind === 'shield') {
            this.shield = true;
            sfx.powerup();
            this.banner('Escudo', 'a próxima batida não conta', COLORS.green);
            this.effect(item, COLORS.green);
        } else {
            this.combo = time < this.comboUntil ? this.combo + 1 : 1;
            this.comboUntil = time + 2600;
            this.eatenCount++;
            this.grow += item.kind === 'gold' ? 4 : 2;
            const mult = Math.min(5, 1 + Math.floor(this.combo / 3));
            this.addScore((item.kind === 'gold' ? 50 : 10) * mult);
            sfx.note(this.combo);
            this.effect(item, YELLOW);
            this.cameras.main.shake(60, 0.0018);
        }
        this.dropItem(item);
    }

    private screenOf(cell: Cell) {
        return { x: (cell.x + 0.5) * CELL + this.world.x, y: (cell.y + 0.5) * CELL + this.world.y };
    }

    private effect(cell: Cell, color: number) {
        const { x, y } = this.screenOf(cell);
        this.burst(x, y, color, 10, 150, 'ui-square');
        this.ring(x, y, color, 44, 1);
    }

    private die() {
        sfx.explode();
        this.hitStop(100);
        this.updateStats();
        this.endGame();
        // A cobra se desfaz da cabeça para o rabo.
        this.body.slice(0, 40).forEach((part, i) => {
            this.time.delayedCall(i * 18, () => {
                const { x, y } = this.screenOf(part);
                this.burst(x, y, i % 2 ? BLUE : YELLOW, 4, 140, 'ui-square');
            });
        });
    }

    /* ---------- Desenho ---------- */

    private follow(amount: number) {
        const point = this.point(0);
        this.camX += (point.x - WIDTH / 2 - this.camX) * amount;
        this.camY += (point.y - HEIGHT / 2 - this.camY) * amount;
        this.world.setPosition(-this.camX, -this.camY);
        this.grid.setTilePosition(this.camX, this.camY);
        this.far.setTilePosition(this.camX * 0.25, this.camY * 0.25);
    }

    /** Posição suave do gomo `i`, entre a célula anterior e a atual. */
    private point(i: number) {
        const to = this.body[i]!;
        const from = this.previous[i] ?? to;
        const t = this.progress;
        return { x: (from.x + (to.x - from.x) * t + 0.5) * CELL, y: (from.y + (to.y - from.y) * t + 0.5) * CELL };
    }

    private draw() {
        const g = this.tube;
        g.clear();
        const count = this.body.length;
        if (this.shield) {
            const head = this.point(0);
            g.lineStyle(1.5, COLORS.green, 0.8).strokeCircle(head.x, head.y, 22);
        }
        // Do rabo para a cabeça: azul na frente e amarelo atrás, como o logo do Python.
        for (let i = count - 1; i >= 0; i--) {
            const a = this.point(i);
            const b = i < count - 1 ? this.point(i + 1) : a;
            const t = i / Math.max(1, count - 1);
            const r = 13 - t * 6;
            const color = mixColor(BLUE, YELLOW, Math.min(1, t * 1.4));
            g.fillStyle(color);
            for (let s = 0; s < 3; s++) g.fillCircle(a.x + ((b.x - a.x) * s) / 3, a.y + ((b.y - a.y) * s) / 3, r);
            g.fillStyle(0xffffff, 0.14).fillCircle(a.x - 2, a.y - 3, r * 0.5);
        }
        const head = this.point(0);
        const { x: dx, y: dy } = this.dir;
        const side = { x: -dy, y: dx };
        for (const s of [-1, 1]) {
            const ex = head.x + dx * 5 + side.x * s * 6;
            const ey = head.y + dy * 5 + side.y * s * 6;
            g.fillStyle(0xffffff).fillCircle(ex, ey, 4);
            g.fillStyle(0x07090a).fillCircle(ex + dx * 1.4, ey + dy * 1.4, 2);
        }
        // Língua de vez em quando.
        if (Math.sin(this.elapsed / 180) > 0.55) {
            g.lineStyle(2, COLORS.red).lineBetween(head.x + dx * 13, head.y + dy * 13, head.x + dx * 21, head.y + dy * 21);
        }
    }

    private updateStats() {
        this.stats = {
            Tamanho: String(this.body.length),
            Commits: String(this.eatenCount),
            'Mais longe': `${this.farthest} casas`,
        };
    }

    /* ---------- Quadro a quadro ---------- */

    protected step(time: number, delta: number) {
        this.progress += delta / this.stepTime;
        while (this.progress >= 1 && this.phase === 'playing') {
            this.progress -= 1;
            this.advance(time);
        }
        if (this.phase !== 'playing') return;

        this.follow(0.14);
        this.draw();
        if (time > this.comboUntil) this.combo = 0;
        const mult = Math.min(5, 1 + Math.floor(this.combo / 3));
        this.hudText.setText(`TAMANHO ${this.body.length}   x${mult}`);
        this.updateStats();
    }
}

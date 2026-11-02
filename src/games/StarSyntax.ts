import Phaser from 'phaser';
import { ArcadeScene, COLORS, HEIGHT, SANS, WIDTH } from './ArcadeScene';
import { sfx } from './sfx';
import { WordBank, PHRASES, type Vocabulary } from './words';
import musicUrl from '../assets/games/musica/star.mp3';
import playerUrl from '../assets/games/player.webp';
import enemy0Url from '../assets/games/enemy-0.webp';
import enemy1Url from '../assets/games/enemy-1.webp';
import enemy2Url from '../assets/games/enemy-2.webp';
import enemy3Url from '../assets/games/enemy-3.webp';

const ARENA = { left: 270, right: 690 };
const SHIP = { x: WIDTH / 2, y: HEIGHT - 46 };

/** Papéis: cada tipo pede uma decisão diferente de quem digita. */
const ROLES = [
    { name: 'bug', speed: 30, sprite: 'enemy-0', scale: 0.36 },
    { name: 'servidor', speed: 19, sprite: 'enemy-1', scale: 0.34 },
    { name: 'chefe', speed: 14, sprite: 'enemy-2', scale: 0.34 },
    { name: 'nave-mãe', speed: 9, sprite: 'enemy-3', scale: 0.5 },
    { name: 'requisição', speed: 36, sprite: 'enemy-0', scale: 0.22 },
    { name: 'erro', speed: 62, sprite: 'ui-square', scale: 0.8 },
];
const BUG = 0;
const SERVER = 1;
const CHIEF = 2;
const MOTHER = 3;
const REQUEST = 4;
const ERROR = 5;

/** Acertos seguidos para cada multiplicador. */
const TIERS = [15, 40, 80];
const SPRITES = { player: playerUrl, 'enemy-0': enemy0Url, 'enemy-1': enemy1Url, 'enemy-2': enemy2Url, 'enemy-3': enemy3Url };
const GOLD = 0xf2c200;

/** Faixa de tamanho de palavra por nível: curto, médio, longo. */
const LENGTHS: [number, number][] = [[3, 5], [6, 8], [9, 12]];

const DIFFICULTY = [
    { speed: 0.72, gap: 1.3, lives: 5 },
    { speed: 1, gap: 1, lives: 3 },
    { speed: 1.32, gap: 0.78, lives: 2 },
];

interface Enemy {
    word: string;
    typed: number;
    x: number;
    y: number;
    vy: number;
    vx: number;
    seed: number;
    role: number;
    boss: boolean;
    fireAt: number;
    body: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
    back: Phaser.GameObjects.Rectangle;
}

/**
 * Sintaxe Estelar: palavras descem presas a naves inimigas e a sua nave atira a cada letra certa.
 * A letra acertada some da palavra. Uma palavra começa e fica travada até acabar.
 * Bomba EMP no Enter e nave-mãe a cada cinco ondas.
 */
export class StarSyntax extends ArcadeScene {
    readonly gameId = 'star-syntax';
    readonly title = 'Sintaxe Estelar';
    readonly hint = 'Digite a palavra de uma nave: cada letra certa dispara um tiro. Destrua antes que ela chegue até você. Enter usa a bomba EMP. Tecla V troca entre inglês, termos de dev e os dois. Tudo em minúsculas e sem acento.';
    readonly medals: [number, number, number] = [2000, 6000, 14000];
    protected pauseKey = false;
    protected music = musicUrl;
    protected levels = [
        { name: 'Júnior', text: '5 escudos e palavras curtas' },
        { name: 'Pleno', text: '3 escudos · pontos x1,5' },
        { name: 'Sênior', text: '2 escudos, palavras longas · pontos x2' },
    ];

    private enemies: Enemy[] = [];
    private target: Enemy | null = null;
    private ship!: Phaser.GameObjects.Image;
    private thrust!: Phaser.GameObjects.Particles.ParticleEmitter;
    private grid!: Phaser.GameObjects.TileSprite;
    private dust!: Phaser.GameObjects.TileSprite;
    private bombs = 3;
    private bombIcon!: Phaser.GameObjects.Text;
    private hudText!: Phaser.GameObjects.Text;
    private lives = 3;
    private setLives!: (n: number) => void;
    private wave = 1;
    private queue: number[] = [];
    private speedUp = 1;
    private pace = 1;
    private history: number[] = [];
    private waveTyped = 0;
    private waveStart = 0;
    private multBar!: Phaser.GameObjects.Graphics;
    private multText!: Phaser.GameObjects.Text;
    private nextSpawnAt = 0;
    private waveGap = 0;
    private correct = 0;
    private wrong = 0;
    private kills = 0;
    private streak = 0;
    /** Sacos de palavras: cada palavra só volta depois que todas do tamanho saíram. */
    private words = new WordBank('misto');
    /** Vocabulário escolhido, guardado entre partidas. */
    protected vocab: Vocabulary = 'misto';
    private startedAt = 0;
    private onType = (ch: string) => this.type(ch);

    constructor() {
        super('star-syntax');
    }

    private get tuning() {
        return DIFFICULTY[this.level]!;
    }

    preload() {
        if (this.textures.exists('player')) return;
        for (const [key, url] of Object.entries(SPRITES)) this.load.image(key, url);
    }

    protected build() {
        this.makeTextures();
        Object.assign(this, { enemies: [], target: null, bombs: 3, wave: 1, queue: [], speedUp: 1, pace: 1, history: [], waveTyped: 0, waveStart: 0, waveGap: 0, correct: 0, wrong: 0, kills: 0, streak: 0 });
        this.vocab = this.readVocab();
        this.words = new WordBank(this.vocab);
        this.legend = [
            { key: 'enemy-0', label: 'bug: vem direto', scale: 0.36 },
            { key: 'enemy-1', label: 'servidor: envia requisições', scale: 0.34 },
            { key: 'enemy-2', label: 'chefe: abre um leque de erros', scale: 0.34 },
            { key: 'enemy-3', label: 'nave-mãe: frases', scale: 0.2 },
        ];

        this.add.image(0, 0, 'space').setOrigin(0);
        this.dust = this.add.tileSprite(0, 0, WIDTH, HEIGHT, 'dust').setOrigin(0);
        // Grade levemente torta: a tela maior que o jogo esconde as pontas ao girar.
        this.grid = this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH * 1.3, HEIGHT * 1.6, 'grid').setAngle(-3).setAlpha(0.8);

        this.thrust = this.add.particles(0, 0, 'ui-dot', {
            speedY: { min: 40, max: 110 },
            speedX: { min: -8, max: 8 },
            lifespan: 240,
            scale: { start: 0.22, end: 0 },
            tint: [0xffffff, GOLD],
            blendMode: Phaser.BlendModes.ADD,
            frequency: 26,
        });
        this.thrust.setDepth(29);
        this.ship = this.add.image(SHIP.x, SHIP.y, 'player').setScale(0.24).setDepth(30);

        // A área de jogo é uma coluna em pé: as laterais guardam o placar.
        const side = this.add.graphics().setDepth(70);
        side.fillStyle(0x08090a, 0.94).fillRect(0, 0, ARENA.left, HEIGHT).fillRect(ARENA.right, 0, WIDTH - ARENA.right, HEIGHT);
        side.fillStyle(GOLD, 0.25).fillRect(ARENA.left, 0, 1, HEIGHT).fillRect(ARENA.right - 1, 0, 1, HEIGHT);
        this.multBar = this.add.graphics().setDepth(80);
        this.multText = this.add.text(24, 80, 'x1', { fontFamily: SANS, fontSize: '40px', fontStyle: '200', color: '#e8e6df' }).setDepth(80);

        this.lives = this.tuning.lives;
        this.setLives = this.lifeRow(this.lives, 5);
        const hud = { fontFamily: SANS, fontSize: '13px', fontStyle: '400', color: '#8d8c86' };
        this.hudText = this.add.text(24, 42, '', hud).setDepth(80);
        this.bombIcon = this.add.text(WIDTH - 24, 44, '', { ...hud, color: '#f2c200' }).setOrigin(1, 0).setDepth(80);
        this.showBombs();

        this.game.events.on('arcade-type', this.onType);
        this.input.keyboard?.on('keydown-V', () => { if (this.phase === 'ready' || this.phase === 'over') { this.cycleVocab(); this.banner('Palavras', this.vocab === 'ingles' ? 'inglês' : this.vocab === 'dev' ? 'termos de dev' : 'inglês + dev'); } });
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter') return this.useBomb();
            if ((document.activeElement as HTMLElement | null)?.dataset.typing === 'true') return;
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) this.type(event.key);
        });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('arcade-type', this.onType));
    }

    private makeTextures() {
        if (this.textures.exists('space')) return;
        const rnd = new Phaser.Math.RandomDataGenerator(['space']);
        const paint = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
            const texture = this.textures.createCanvas(key, w, h)!;
            draw(texture.getContext());
            texture.refresh();
        };

        paint('space', WIDTH, HEIGHT, (c) => {
            const back = c.createLinearGradient(0, 0, 0, HEIGHT);
            back.addColorStop(0, '#060807');
            back.addColorStop(1, '#14130e');
            c.fillStyle = back;
            c.fillRect(0, 0, WIDTH, HEIGHT);
        });

        // Poeira de nebulosa bem apagada, que emenda na vertical.
        paint('dust', 960, 1024, (c) => {
            for (let i = 0; i < 40; i++) {
                const x = rnd.between(0, 960);
                const y = rnd.between(0, 1024);
                const r = rnd.between(60, 240);
                for (const dy of [-1024, 0, 1024]) {
                    const cloud = c.createRadialGradient(x, y + dy, 0, x, y + dy, r);
                    cloud.addColorStop(0, 'rgba(170, 150, 90, 0.05)');
                    cloud.addColorStop(1, 'rgba(170, 150, 90, 0)');
                    c.fillStyle = cloud;
                    c.fillRect(x - r, y + dy - r, r * 2, r * 2);
                }
            }
            for (let i = 0; i < 260; i++) {
                c.fillStyle = `rgba(232, 230, 223, ${rnd.realInRange(0.06, 0.4)})`;
                c.fillRect(rnd.between(0, 960), rnd.between(0, 1024), 1, 1);
            }
        });

        paint('grid', 56, 56, (c) => {
            c.strokeStyle = 'rgba(242, 194, 0, 0.13)';
            c.lineWidth = 1;
            c.strokeRect(0.5, 0.5, 56, 56);
        });

        const g = this.add.graphics();
        g.fillStyle(0xffffff).fillRect(0, 0, 2, 12);
        g.generateTexture('bolt', 2, 12);
        g.destroy();
    }

    protected start() {
        this.startedAt = this.elapsed;
        this.beginWave();
    }

    protected onPause(paused: boolean) {
        this.thrust.pause();
        if (!paused) this.thrust.resume();
    }

    /* ---------- Ondas ---------- */

    private beginWave() {
        const boss = this.wave % 5 === 0;
        const servers = Math.floor(this.wave / 2);
        const chiefs = Math.max(0, Math.floor((this.wave - 2) / 3));
        const queue = boss ? [MOTHER] : [...Array<number>(4 + this.wave).fill(BUG), ...Array<number>(servers).fill(SERVER), ...Array<number>(chiefs).fill(CHIEF)];
        this.queue = Phaser.Utils.Array.Shuffle(queue);
        this.speedUp = Math.pow(1.04, this.wave - 1);
        this.pace = Math.max(0.42, Math.pow(0.96, this.wave - 1));
        this.waveGap = 1500 * this.pace * this.tuning.gap;
        this.nextSpawnAt = this.elapsed + 1800;
        this.waveTyped = 0;
        this.waveStart = this.elapsed;
        if (boss) {
            sfx.boss();
            this.banner('Nave-mãe', 'digite a frase inteira', COLORS.red);
        }
    }

    private pickWord(role: number) {
        const easier = this.level === 0 ? -1 : this.level === 2 ? 1 : 0;
        let level = role === CHIEF ? 2 : role === SERVER ? 1 : 0;
        if (role === BUG && this.level === 2 && Math.random() < 0.3) level = 1;
        level = Phaser.Math.Clamp(level + (role === BUG ? easier : 0), 0, 2);
        const [min, max] = LENGTHS[level]!;
        const used = new Set(this.enemies.map((e) => e.word[e.typed]).filter((ch): ch is string => !!ch));
        return this.words.pick(min, max, used);
    }

    /** Letra que ninguém na tela está esperando: nunca há dúvida sobre o alvo. */
    private readVocab(): Vocabulary {
        try {
            const value = localStorage.getItem('arcade:star-syntax:vocab');
            return value === 'ingles' || value === 'dev' ? value : 'misto';
        } catch {
            return 'misto';
        }
    }

    /** Alterna o vocabulário na tela inicial (tecla V); vale na próxima partida. */
    protected cycleVocab() {
        const order: Vocabulary[] = ['misto', 'ingles', 'dev'];
        this.vocab = order[(order.indexOf(this.vocab) + 1) % order.length]!;
        try {
            localStorage.setItem('arcade:star-syntax:vocab', this.vocab);
        } catch {
            /* sem armazenamento */
        }
        this.words = new WordBank(this.vocab);
    }

    private freeLetter() {
        const used = new Set(this.enemies.map((e) => e.word[e.typed]));
        const free = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((ch) => !used.has(ch));
        return Phaser.Utils.Array.GetRandom(free.length ? free : ['x']);
    }

    private spawnEnemy(role = BUG, from?: { x: number; y: number; vx: number; vy: number }) {
        const def = ROLES[role]!;
        const boss = role === MOTHER;
        const word = boss ? Phaser.Utils.Array.GetRandom(PHRASES) : role === ERROR ? this.freeLetter() : this.pickWord(role);
        const x = from?.x ?? (boss ? SHIP.x : Phaser.Math.Between(ARENA.left + 40, ARENA.right - 40));
        const y = from?.y ?? (boss ? -34 : -14); // a palavra já nasce visível
        const body = this.add.image(x, y, def.sprite).setScale(def.scale).setDepth(20);
        if (role === ERROR) body.setTint(COLORS.red);
        const label = this.add.text(x, y, word, { fontFamily: SANS, fontSize: role === ERROR ? '15px' : '16px', fontStyle: '300', color: role === ERROR ? '#ff8a8a' : '#f4f2ec' }).setOrigin(0.5).setDepth(26);
        const back = this.add.rectangle(x, y, label.width + 10, 22, 0x000000, 0.82).setDepth(25);
        const speed = def.speed * this.speedUp * this.tuning.speed;
        const time = (SHIP.y - y) / speed;
        this.enemies.push({ word, typed: 0, x, y, vy: from?.vy ?? speed, vx: from?.vx ?? (SHIP.x - x) / time, seed: Math.random() * 6, role, boss, fireAt: this.elapsed + 4200, body, label, back });
    }

    /** Servidor manda uma requisição; chefe e nave-mãe abrem um leque de erros. */
    private shootBack(enemy: Enemy) {
        if (enemy.y > SHIP.y - 150) return;
        enemy.fireAt = this.elapsed + (enemy.role === SERVER ? 5200 : 6500) * this.pace;
        if (enemy.role === SERVER) {
            this.spawnEnemy(REQUEST, { x: enemy.x, y: enemy.y + 16, vx: (SHIP.x - enemy.x) / 16, vy: (SHIP.y - enemy.y) / 16 });
            return;
        }
        const shots = enemy.boss ? 5 : 3;
        const speed = ROLES[ERROR]!.speed * this.speedUp;
        for (let i = 0; i < shots; i++) {
            const angle = Math.PI / 2 + ((i - (shots - 1) / 2) * 0.34);
            this.spawnEnemy(ERROR, { x: enemy.x, y: enemy.y + 20, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
        }
    }

    /* ---------- Digitação e tiros ---------- */

    private type(raw: string) {
        if (this.phase !== 'playing') return;
        const ch = raw.toLowerCase();

        // Letra certa do alvo atual segue nele; se for a de outra nave, o tiro troca de alvo. Nada fica preso.
        if (this.target?.word[this.target.typed] !== ch) {
            const found = this.enemies.filter((e) => e !== this.target && e.word[e.typed] === ch).sort((a, b) => b.y - a.y)[0];
            if (!found) return this.mistake();
            this.lock(found);
        }

        const enemy = this.target!;
        enemy.typed++;
        this.correct++;
        this.waveTyped++;
        this.streak++;
        if (TIERS.includes(this.streak)) {
            sfx.powerup();
            this.tweens.add({ targets: this.multText, scale: { from: 1.4, to: 1 }, duration: 260, ease: 'Back.Out' });
        }
        this.showMultiplier();
        sfx.note(enemy.typed + this.streak % 10);
        this.fire(enemy);
        // A letra acertada some na hora; a nave só morre quando o último tiro chega.
        const left = enemy.word.slice(enemy.typed);
        enemy.label.setText(left);
        enemy.back.setSize(left ? enemy.label.width + 12 : 0, 24);
        if (!left) this.target = null;
    }

    private lock(enemy: Enemy) {
        const before = this.target;
        before?.label.setColor('#f4f2ec').setDepth(26);
        before?.back.setDepth(25);
        this.target = enemy;
        enemy.label.setColor('#f2c200').setDepth(46);
        enemy.back.setDepth(45);
        enemy.body.setDepth(22);
    }

    private get multiplier() {
        return 1 + TIERS.filter((need) => this.streak >= need).length;
    }

    /** Barra do próximo multiplicador: a precisão vale mais que a pressa. */
    private showMultiplier() {
        const index = this.multiplier - 1;
        const from = TIERS[index - 1] ?? 0;
        const to = TIERS[index];
        const ratio = to ? (this.streak - from) / (to - from) : 1;
        this.multText.setText(`x${this.multiplier}`).setColor(index ? '#f2c200' : '#e8e6df');
        this.multBar.clear();
        this.multBar.fillStyle(0xffffff, 0.1).fillRect(24, 132, 210, 2);
        this.multBar.fillStyle(GOLD).fillRect(24, 132, 210 * ratio, 2);
    }

    private mistake() {
        this.wrong++;
        this.streak = 0;
        this.showMultiplier();
        sfx.miss();
        this.ship.setTintFill(COLORS.red);
        this.time.delayedCall(90, () => this.ship.clearTint());
    }

    private fire(enemy: Enemy) {
        const angle = Phaser.Math.Angle.Between(SHIP.x, SHIP.y, enemy.body.x, enemy.body.y);
        this.ship.setRotation(angle + Math.PI / 2);
        this.ship.y = SHIP.y + 3; // recuo
        const bolt = this.add.image(SHIP.x, SHIP.y - 14, 'bolt').setDepth(28).setRotation(angle + Math.PI / 2).setBlendMode(Phaser.BlendModes.ADD);
        const last = enemy.typed >= enemy.word.length;
        this.tweens.add({
            targets: bolt,
            x: () => enemy.body.x,
            y: () => enemy.body.y,
            duration: 110,
            ease: 'Quad.In',
            onComplete: () => {
                bolt.destroy();
                if (!this.enemies.includes(enemy)) return;
                enemy.y -= enemy.boss ? 0.6 : 5;
                enemy.body.setTintFill(0xffffff);
                this.time.delayedCall(36, () => enemy.body.active && enemy.body.clearTint());
                this.burst(enemy.body.x, enemy.body.y, GOLD, 3, 130, 'ui-square');
                if (last) this.destroyEnemy(enemy);
            },
        });
    }

    private destroyEnemy(enemy: Enemy) {
        const { x, y } = enemy.body;
        this.addScore(enemy.word.length * (enemy.boss ? 25 : 10) * this.multiplier);
        this.burst(x, y, 0xffffff, enemy.boss ? 50 : 8 + enemy.role * 6, enemy.boss ? 380 : 200, 'ui-square');
        this.burst(x, y, GOLD, enemy.boss ? 40 : 10, enemy.boss ? 320 : 150);
        this.ring(x, y, GOLD, enemy.boss ? 240 : 44 + enemy.role * 14, 1);
        this.hitStop(enemy.boss ? 120 : 30);
        this.cameras.main.shake(enemy.boss ? 500 : 90 + enemy.role * 40, enemy.boss ? 0.014 : 0.002 + (enemy.role === CHIEF ? 0.004 : 0));
        if (enemy.boss) {
            sfx.explode();
            this.cameras.main.flash(240, 255, 230, 170);
        } else {
            sfx.squash(3);
        }
        this.kills++;
        this.removeEnemy(enemy);
        this.checkWave();
    }

    private removeEnemy(enemy: Enemy) {
        Phaser.Utils.Array.Remove(this.enemies, enemy);
        if (this.target === enemy) this.target = null;
        [enemy.body, enemy.label, enemy.back].forEach((item) => item.destroy());
    }

    private checkWave() {
        if (this.phase !== 'playing' || this.queue.length || this.enemies.length) return;
        const minutes = (this.elapsed - this.waveStart) / 60000;
        this.history.push(minutes > 0 ? Math.round(this.waveTyped / 5 / minutes) : 0);
        this.addScore(50 * this.wave);
        this.bombs = Math.min(5, this.bombs + (this.wave % 3 === 0 ? 1 : 0));
        this.showBombs();
        sfx.levelUp();
        this.banner(`Onda ${String(this.wave).padStart(3, '0')} concluída`, `pontos ${String(this.score).padStart(6, '0')}`);
        this.wave++;
        this.beginWave();
    }

    private useBomb() {
        if (this.phase !== 'playing' || this.bombs <= 0) return;
        this.bombs--;
        this.showBombs();
        sfx.explode();
        this.ring(SHIP.x, SHIP.y, GOLD, 900, 2);
        this.cameras.main.flash(180, 242, 194, 0);
        for (const enemy of [...this.enemies]) {
            if (enemy.boss) enemy.y = Math.max(-40, enemy.y - 110);
            else this.destroyEnemy(enemy);
        }
    }

    private showBombs() {
        this.bombIcon.setText(`EMP ${this.bombs}`);
    }

    /* ---------- Quadro a quadro ---------- */

    protected step(time: number, delta: number) {
        const dt = delta / 1000;
        this.dust.tilePositionY -= dt * 5;
        this.grid.tilePositionY -= dt * 9;
        this.ship.y += (SHIP.y - this.ship.y) * 0.2;
        this.thrust.setPosition(SHIP.x, this.ship.y + 24);
        if (!this.target) this.ship.rotation *= 0.92;

        if (this.queue.length && time > this.nextSpawnAt && this.enemies.length < 9) {
            this.spawnEnemy(this.queue.pop());
            this.nextSpawnAt = time + this.waveGap * Phaser.Math.FloatBetween(0.8, 1.2);
        }

        for (const enemy of [...this.enemies]) {
            enemy.y += enemy.vy * dt;
            enemy.x += enemy.vx * dt;
            const x = enemy.x + (enemy.boss || enemy.role === ERROR ? 0 : Math.sin(time / 800 + enemy.seed) * 10);
            if (enemy.role !== BUG && enemy.role < REQUEST && time > enemy.fireAt) this.shootBack(enemy);
            if (enemy.role === ERROR && (enemy.x < ARENA.left + 6 || enemy.x > ARENA.right - 6)) enemy.vx = -enemy.vx;
            enemy.body.setPosition(x, enemy.y);
            const labelX = Phaser.Math.Clamp(x, ARENA.left + enemy.back.width / 2 + 6, ARENA.right - enemy.back.width / 2 - 6);
            const labelY = enemy.y + (enemy.boss ? 44 : enemy.role === ERROR ? 0 : 22);
            enemy.back.setPosition(labelX, labelY);
            enemy.label.setPosition(labelX, labelY);

            if (enemy.y >= SHIP.y - 16) {
                this.removeEnemy(enemy);
                this.hitShip(enemy);
                if (this.phase !== 'playing') return;
                this.checkWave();
            }
        }

        const minutes = (time - this.startedAt) / 60000;
        const wpm = minutes > 0.05 ? Math.round(this.correct / 5 / minutes) : 0;
        this.hudText.setText(`ONDA ${String(this.wave).padStart(3, '0')}   ${wpm} PPM`);
        this.updateStats(wpm);
    }

    private hitShip(enemy: Enemy) {
        this.lives -= enemy.boss ? 2 : 1;
        this.setLives(Math.max(0, this.lives));
        this.streak = 0;
        this.showMultiplier();
        sfx.hurt();
        this.burst(SHIP.x, SHIP.y, COLORS.red, 18, 220, 'ui-square');
        this.ring(SHIP.x, SHIP.y, COLORS.red, 90, 1.5);
        this.cameras.main.shake(240, 0.01);
        if (this.lives <= 0) {
            this.tweens.add({ targets: this.ship, alpha: 0, duration: 400 });
            this.thrust.stop();
            this.endGame();
        }
    }

    /** Gráfico simples: quantas palavras por minuto em cada onda. */
    protected overExtra(box: Phaser.GameObjects.Container) {
        if (!this.history.length) return;
        const x = 40;
        const y = 268;
        const w = 160;
        const h = 90;
        const top = Math.max(...this.history, 10);
        const g = this.add.graphics();
        g.lineStyle(1, 0xffffff, 0.12).lineBetween(x, y, x + w, y).lineBetween(x, y - h, x + w, y - h);
        g.lineStyle(1.5, GOLD);
        g.beginPath();
        this.history.forEach((value, i) => {
            const px = x + (this.history.length > 1 ? (i / (this.history.length - 1)) * w : w / 2);
            const py = y - (value / top) * h;
            if (i) g.lineTo(px, py);
            else g.moveTo(px, py);
        });
        g.strokePath();
        box.add([g, this.add.text(x, y + 8, 'PPM por onda', { fontFamily: SANS, fontSize: '11px', fontStyle: '400', color: '#8d8c86' }), this.add.text(x + w, y - h - 16, String(top), { fontFamily: SANS, fontSize: '11px', fontStyle: '400', color: '#8d8c86' }).setOrigin(1, 0)]);
    }

    private updateStats(wpm: number) {
        const total = this.correct + this.wrong;
        this.stats = {
            PPM: String(wpm),
            Precisão: `${total ? Math.round((this.correct / total) * 100) : 100}%`,
            Destruídas: String(this.kills),
            Onda: String(this.wave),
        };
    }
}

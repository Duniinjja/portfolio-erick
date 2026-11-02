import Phaser from 'phaser';
import { ArcadeScene, COLORS, HEIGHT, SANS, WIDTH } from './ArcadeScene';
import { sfx } from './sfx';
import rackUrl from '../assets/games/rack.webp';
import musicUrl from '../assets/games/musica/bug.mp3';
import redUrl from '../assets/games/bug-red.webp';
import purpleUrl from '../assets/games/bug-purple.webp';
import greenUrl from '../assets/games/bug-green.webp';
import orangeUrl from '../assets/games/bug-orange.webp';
import goldUrl from '../assets/games/bug-gold.webp';
import bossUrl from '../assets/games/bug-boss.webp';

const CODE = [
    'const lead = await crm.qualify(message);',
    'if (lead.score > 0.8) funnel.move(lead, "QUALIFICADO_IA");',
    'await queue.add("contrato", { saleId });',
    'export const caixa = receitas - despesas;',
    'io.to(tenant).emit("funil:update", card);',
    'const taxa = await bcb.serie("SELIC");',
    'return prisma.venda.update({ where, data });',
    'logger.info({ tenant, ms }, "deploy ok");',
    'for (const linha of planilha) dedupe(linha);',
    'cron.schedule("0 */6 * * *", sincronizar);',
    'res.json({ status: "PAID", total });',
    'grafana.alert("latência p95 > 300ms");',
    'await redis.set(`sessao:${id}`, token);',
    'const parcelas = tabelaPrice(valor, taxa, n);',
];

type BugKind = 'bug' | 'fast' | 'tank' | 'splitter' | 'mini' | 'gold';
type PowerKind = 'hotfix' | 'review' | 'test';

const KINDS: Record<BugKind, { texture: string; hp: number; speed: number; points: number; scale: number; radius: number }> = {
    bug: { texture: 'bug-red', hp: 1, speed: 1, points: 10, scale: 1, radius: 32 },
    fast: { texture: 'bug-purple', hp: 1, speed: 1.9, points: 20, scale: 0.85, radius: 30 },
    tank: { texture: 'bug-green', hp: 3, speed: 0.55, points: 40, scale: 1.45, radius: 44 },
    splitter: { texture: 'bug-orange', hp: 1, speed: 1.1, points: 15, scale: 1.1, radius: 34 },
    mini: { texture: 'bug-orange', hp: 1, speed: 2.1, points: 5, scale: 0.6, radius: 26 },
    gold: { texture: 'bug-gold', hp: 1, speed: 2.3, points: 50, scale: 1, radius: 32 },
};

const SPLASH: Record<BugKind, number> = {
    bug: COLORS.red,
    fast: COLORS.purple,
    tank: COLORS.green,
    splitter: COLORS.orange,
    mini: COLORS.orange,
    gold: COLORS.yellow,
};

const PROD_X = 100;
const SPRITES = { 'bug-red': redUrl, 'bug-purple': purpleUrl, 'bug-green': greenUrl, 'bug-orange': orangeUrl, 'bug-gold': goldUrl, 'bug-boss': bossUrl };
/** Os sprites 3D são maiores que a tela: ficam nítidos na resolução real. */
const BUG_SCALE = 0.72;
const MONO = 'Consolas, Menlo, monospace';

/** Cores de cada pedaço de código no editor. */
const SYNTAX = { keyword: '#c084fc', name: '#e4e4e7', text: '#86efac', fn: '#fcd34d', number: '#fb923c', plain: '#9ca3af' };

const tokenColor = (word: string) => {
    if (/^(const|await|if|return|for|export|of|res|cron)$/.test(word)) return SYNTAX.keyword;
    if (/^["'`]/.test(word)) return SYNTAX.text;
    if (/^\d/.test(word)) return SYNTAX.number;
    if (/^[a-zA-Z_]+\($/.test(word) || /\($/.test(word)) return SYNTAX.fn;
    return /^[a-zA-Z]/.test(word) ? SYNTAX.name : SYNTAX.plain;
};

/** Dificuldade: velocidade, intervalo entre bugs, vidas e resistência do chefão. */
const DIFFICULTY = [
    { speed: 0.8, spawn: 1.3, lives: 5, boss: 0.75 },
    { speed: 1, spawn: 1, lives: 3, boss: 1 },
    { speed: 1.3, spawn: 0.72, lives: 2, boss: 1.35 },
];

/**
 * Caça-Bugs: bugs atravessam o editor rumo à produção. Cada tipo se comporta
 * de um jeito, há poderes para pegar e um chefão a cada quatro sprints.
 */
export class BugHunt extends ArcadeScene {
    readonly gameId = 'bug-hunt';
    readonly title = 'Caça-Bugs';
    readonly hint = 'Clique ou toque nos bugs antes que cheguem à produção. Acertos seguidos multiplicam os pontos; errar o clique quebra o combo. A cada 4 sprints aparece o Bug de Produção.';
    readonly medals: [number, number, number] = [1500, 4000, 9000];
    protected music = musicUrl;
    protected levels = [
        { name: 'Júnior', text: '5 vidas e bugs mais lentos' },
        { name: 'Pleno', text: '3 vidas · pontos x1,5' },
        { name: 'Sênior', text: '2 vidas, bugs rápidos · pontos x2' },
    ];

    private bugs: Phaser.GameObjects.Image[] = [];
    private powers: Phaser.GameObjects.Image[] = [];
    private boss?: Phaser.GameObjects.Image;
    private bossBar?: Phaser.GameObjects.Graphics;
    private lives = 3;
    private setLives!: (n: number) => void;
    private combo = 0;
    private bestCombo = 0;
    private lastHit = 0;
    private hits = 0;
    private shots = 0;
    private kills = 0;
    private sprint = 1;
    private sprintKills = 0;
    private nextSpawn = 0;
    private slowUntil = 0;
    private freezeUntil = 0;
    private comboText!: Phaser.GameObjects.Text;
    private sprintText!: Phaser.GameObjects.Text;
    private reticle?: Phaser.GameObjects.Container;
    private comboBar!: Phaser.GameObjects.Graphics;
    private frost!: Phaser.GameObjects.Rectangle;
    private slowTint!: Phaser.GameObjects.Rectangle;
    private scan!: Phaser.GameObjects.Rectangle;
    private trail!: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor() {
        super('bug-hunt');
    }

    private get sprintGoal() {
        return 10 + this.sprint * 4;
    }

    private get tuning() {
        return DIFFICULTY[this.level]!;
    }

    private get isBossSprint() {
        return this.sprint % 4 === 0;
    }

    protected build() {
        this.makeTextures();
        Object.assign(this, { bugs: [], powers: [], boss: undefined, combo: 0, bestCombo: 0, hits: 0, shots: 0, kills: 0, sprint: 1, sprintKills: 0, slowUntil: 0, freezeUntil: 0 });

        this.legend = [
            { key: 'bug-red', label: 'Bug: 1 clique', scale: BUG_SCALE },
            { key: 'bug-purple', label: 'Segfault: rápido', scale: BUG_SCALE },
            { key: 'bug-green', label: 'Memory leak: 3 cliques', scale: BUG_SCALE * 1.2 },
            { key: 'bug-orange', label: 'Race condition: se divide', scale: BUG_SCALE },
            { key: 'bug-gold', label: 'Dourado: câmera lenta', scale: BUG_SCALE },
            { key: 'pu-hotfix', label: 'Poderes: clique para pegar' },
        ];

        this.drawEditor();
        this.drawProduction();

        this.trail = this.add.particles(0, 0, 'ui-dot', { lifespan: 420, scale: { start: 0.35, end: 0 }, alpha: { start: 0.35, end: 0 }, emitting: false }).setDepth(15);
        this.frost = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x7dd3fc, 0.1).setOrigin(0).setDepth(50).setVisible(false);
        this.slowTint = this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.yellow, 0.07).setOrigin(0).setDepth(50).setVisible(false);

        this.lives = this.tuning.lives;
        this.setLives = this.lifeRow(this.lives, 5);
        this.comboBar = this.add.graphics().setDepth(80);
        this.comboText = this.add.text(WIDTH / 2, 58, '', { fontFamily: SANS, fontSize: '14px', fontStyle: '400', color: '#f2c200' }).setOrigin(0.5).setDepth(80);
        this.sprintText = this.add.text(WIDTH - 24, 42, 'SPRINT 1', { fontFamily: SANS, fontSize: '13px', fontStyle: '400', color: '#8d8c86' }).setOrigin(1, 0).setDepth(80);

        // Mira própria no mouse; no toque, o dedo é a mira.
        if (!this.sys.game.device.input.touch) {
            this.input.setDefaultCursor('none');
            const ring = this.add.circle(0, 0, 18).setStrokeStyle(2, COLORS.yellow);
            const dot = this.add.circle(0, 0, 2.5, COLORS.yellow);
            const lines = this.add.graphics().lineStyle(2, COLORS.yellow);
            lines.lineBetween(-28, 0, -12, 0).lineBetween(12, 0, 28, 0).lineBetween(0, -28, 0, -12).lineBetween(0, 12, 0, 28);
            this.reticle = this.add.container(WIDTH / 2, HEIGHT / 2, [ring, dot, lines]).setDepth(200);
            this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.reticle?.setPosition(p.worldX, p.worldY));
        }

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.shoot(pointer, over));
    }

    preload() {
        if (this.textures.exists('rack3d')) return;
        this.load.image('rack3d', rackUrl);
        for (const [key, url] of Object.entries(SPRITES)) this.load.spritesheet(key, url, { frameWidth: 140, frameHeight: 112 });
    }

    /** O editor de código: abas, gutter, código colorido, minimapa e barra de status. */
    private drawEditor() {
        const left = PROD_X + 6;
        const back = this.add.graphics();
        back.fillGradientStyle(0x14141c, 0x14141c, 0x0d0d13, 0x0d0d13, 1).fillRect(0, 0, WIDTH, HEIGHT);
        back.fillStyle(0x0d0d12).fillRect(left, 0, 44, HEIGHT);
        back.fillStyle(0x0e0e13).fillRect(WIDTH - 64, 66, 64, HEIGHT - 90);
        back.fillStyle(0x191922).fillRect(left, 42, WIDTH - left, 24);

        ['funil.ts', 'caixa.py', 'deploy.yml'].forEach((name, i) => {
            const x = left + 46 + i * 112;
            if (!i) this.add.rectangle(x, 42, 108, 24, 0x14141c).setOrigin(0);
            if (!i) this.add.rectangle(x, 42, 108, 1, COLORS.yellow).setOrigin(0);
            this.add.text(x + 14, 47, name, { fontFamily: MONO, fontSize: '12px', color: i ? '#6b7280' : '#e4e4e7' });
        });

        for (let i = 0; i < 16; i++) {
            const y = 76 + i * 27;
            this.add.text(left + 34, y, String(i + 1), { fontFamily: MONO, fontSize: '13px', color: '#3f3f4a' }).setOrigin(1, 0);
            const indent = i % 4 === 1 || i % 4 === 2 ? 28 : 0;
            let x = left + 62 + indent;
            for (const word of CODE[(i * 5) % CODE.length]!.split(/(?<=\()|(?=[ .;,)])/)) {
                const token = this.add.text(x, y, word, { fontFamily: MONO, fontSize: '15px', color: tokenColor(word.trim()) }).setAlpha(0.3);
                x += token.width;
            }
            // Minimapa: o mesmo código, em barrinhas.
            const size = CODE[(i * 5) % CODE.length]!.length;
            for (let row = 0; row < 3; row++) {
                back.fillStyle(row === 1 ? 0x4b4b5a : 0x2c2c38, 0.9).fillRect(WIDTH - 58 + indent / 6, 72 + i * 27 + row * 5, Math.min(48, size * (0.9 - row * 0.15)), 2);
            }
        }

        // Linha do cursor: varre o código devagar.
        this.scan = this.add.rectangle(left + 44, 76, WIDTH - left - 108, 24, 0xffffff, 0.035).setOrigin(0);
        this.tweens.add({ targets: this.scan, y: 76 + 15 * 27, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

        back.fillStyle(0x17171e).fillRect(left, HEIGHT - 22, WIDTH - left, 22);
        this.add.text(left + 12, HEIGHT - 18, 'main  ·  TypeScript  ·  UTF-8', { fontFamily: MONO, fontSize: '12px', color: '#8d8c86' });
    }

    /** A produção: racks de verdade atrás de um firewall que pulsa. */
    private drawProduction() {
        const back = this.add.graphics();
        back.fillGradientStyle(0x2a0d12, 0x12060a, 0x2a0d12, 0x12060a, 1).fillRect(0, 0, PROD_X, HEIGHT);
        for (let i = 0; i < 2; i++) {
            const rack = this.add.image(PROD_X / 2 - 2, 150 + i * 232, 'rack3d').setDisplaySize(86, 172);
            rack.setTint(0xffd0d0);
        }
        for (let i = 0; i < 14; i++) {
            const led = this.add.rectangle(Phaser.Math.Between(66, 78), 70 + i * 32, 4, 3, i % 4 ? COLORS.green : COLORS.red).setDepth(2);
            this.tweens.add({ targets: led, alpha: 0.2, duration: Phaser.Math.Between(240, 900), yoyo: true, repeat: -1 });
        }
        const wall = this.add.rectangle(PROD_X - 3, 0, 8, HEIGHT, COLORS.red, 0.85).setOrigin(0.5, 0);
        const haze = this.add.rectangle(PROD_X + 14, 0, 30, HEIGHT, COLORS.red, 0.09).setOrigin(0.5, 0);
        this.tweens.add({ targets: [wall, haze], alpha: { from: 1, to: 0.35 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.add.text(PROD_X / 2, HEIGHT - 16, 'PRODUÇÃO', { fontFamily: SANS, fontSize: '11px', fontStyle: '400', color: '#ff8a8a' }).setOrigin(0.5);
    }

    /** Mancha que o bug deixa no código ao ser esmagado. */
    private splat(x: number, y: number, color: number) {
        const g = this.add.graphics({ x, y }).setDepth(10);
        g.fillStyle(color, 0.5).fillCircle(0, 0, 16);
        for (let i = 0; i < 7; i++) {
            const angle = Math.random() * Math.PI * 2;
            const far = Phaser.Math.Between(18, 36);
            g.fillCircle(Math.cos(angle) * far, Math.sin(angle) * far, Phaser.Math.Between(2, 6));
        }
        this.tweens.add({ targets: g, alpha: 0, delay: 1300, duration: 900, onComplete: () => g.destroy() });
    }

    /** Pedaços de sintaxe voando: o bug era código. */
    private glyphs(x: number, y: number, color: number) {
        for (const ch of Phaser.Utils.Array.Shuffle(['{', '}', ';', '(', ')', '=>', '//', '!=']).slice(0, 5)) {
            const label = this.add.text(x, y, ch, { fontFamily: MONO, fontSize: '16px', fontStyle: '700', color: `#${color.toString(16).padStart(6, '0')}` }).setOrigin(0.5).setDepth(59);
            const angle = Math.random() * Math.PI * 2;
            this.tweens.add({ targets: label, x: x + Math.cos(angle) * 90, y: y + Math.sin(angle) * 70, angle: Phaser.Math.Between(-180, 180), alpha: 0, duration: 620, ease: 'Cubic.Out', onComplete: () => label.destroy() });
        }
    }

    private makeTextures() {
        if (this.textures.exists('pu-hotfix')) return;

        const power = (key: string, color: number, glyph: (g: Phaser.GameObjects.Graphics) => void) => {
            const g = this.add.graphics();
            g.fillStyle(color).fillRoundedRect(0, 0, 48, 48, 10);
            g.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(3, 3, 42, 42, 8);
            glyph(g);
            g.generateTexture(key, 48, 48);
            g.destroy();
        };
        power('pu-hotfix', COLORS.red, (g) => {
            g.fillStyle(0x0a0a0b).fillCircle(24, 27, 11);
            g.lineStyle(3, 0x0a0a0b).lineBetween(30, 18, 36, 11);
            g.fillStyle(COLORS.yellow).fillCircle(37, 10, 3);
        });
        power('pu-review', COLORS.cyan, (g) => {
            g.lineStyle(4, 0x0a0a0b).strokeCircle(21, 21, 9).lineBetween(28, 28, 36, 36);
        });
        power('pu-test', COLORS.green, (g) => {
            g.lineStyle(5, 0x0a0a0b).lineBetween(13, 25, 21, 33).lineBetween(21, 33, 35, 15);
        });
    }

    protected start() {
        this.nextSpawn = 600;
        this.banner('Sprint 1', `Esmague ${this.sprintGoal} bugs para fechar a sprint`);
    }

    /* ---------- Bugs ---------- */

    private spawnBug(kind: BugKind, x = WIDTH + 40, y = Phaser.Math.Between(90, HEIGHT - 40)) {
        const def = KINDS[kind];
        const bug = this.add.image(x, y, def.texture).setFlipX(true).setDepth(20);
        bug.setInteractive(new Phaser.Geom.Circle(70, 56, def.radius * 1.5), Phaser.Geom.Circle.Contains);
        const level = (1 + (this.sprint - 1) * 0.12) * this.tuning.speed;
        bug.setData({ kind, hp: def.hp, base: def.scale, vy: Phaser.Math.FloatBetween(-35, 35), speed: 72 * def.speed * level * Phaser.Math.FloatBetween(0.9, 1.15), seed: Math.random() * 10, boss: false });
        bug.setScale(0);
        this.tweens.add({ targets: bug, scale: def.scale * BUG_SCALE, duration: 260, ease: 'Back.Out' });
        this.bugs.push(bug);
        return bug;
    }

    private pickKind(): BugKind {
        const roll = Math.random();
        const s = this.sprint;
        if (roll < 0.06) return 'gold';
        if (s >= 2 && roll < 0.22) return 'fast';
        if (s >= 3 && roll < 0.34) return 'tank';
        if (s >= 2 && roll < 0.46) return 'splitter';
        return 'bug';
    }

    private shoot(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
        if (this.phase !== 'playing') return;
        this.tweens.add({ targets: this.reticle, scale: { from: 0.7, to: 1 }, angle: { from: 45, to: 0 }, duration: 160 });
        this.ring(pointer.worldX, pointer.worldY, COLORS.yellow, 26, 1.5);
        const target = over[0] as Phaser.GameObjects.Image | undefined;
        this.shots++;

        if (target && this.powers.includes(target)) {
            this.hits++;
            this.collect(target);
        } else if (target && (this.bugs.includes(target) || target === this.boss)) {
            this.hits++;
            this.hitBug(target);
        } else {
            sfx.miss();
            if (this.combo > 2) this.popText(pointer.worldX, pointer.worldY, 'combo perdido', COLORS.muted, 14);
            this.combo = 0;
            this.comboText.setText('');
        }
        this.updateStats();
    }

    private hitBug(bug: Phaser.GameObjects.Image) {
        const hp = bug.getData('hp') - 1;
        bug.setData('hp', hp);
        bug.setTintFill(0xffffff);
        this.time.delayedCall(60, () => bug.active && bug.clearTint());
        bug.x += 14;

        if (bug === this.boss) {
            sfx.hit(0.6);
            this.burst(bug.x - 20 + Phaser.Math.Between(-30, 30), bug.y + Phaser.Math.Between(-30, 30), COLORS.red, 6, 180);
            this.drawBossBar();
            if (hp <= 0) this.killBoss();
            return;
        }

        if (hp > 0) {
            sfx.hit(1.4);
            this.popText(bug.x, bug.y - 30, `${hp}`, COLORS.green, 18);
            return;
        }
        this.killBug(bug);
    }

    private killBug(bug: Phaser.GameObjects.Image, viaPower = false) {
        const kind = bug.getData('kind') as BugKind;
        const now = this.elapsed;
        if (!viaPower) {
            this.combo = now - this.lastHit < 1200 ? this.combo + 1 : 1;
            this.lastHit = now;
            this.bestCombo = Math.max(this.bestCombo, this.combo);
        }
        const multiplier = viaPower ? 1 : Math.min(5, 1 + Math.floor(this.combo / 4));
        this.addScore(KINDS[kind].points * multiplier, bug.x, bug.y - 26);
        this.comboText.setText(multiplier > 1 ? `COMBO ${this.combo} · x${multiplier}` : this.combo >= 2 ? `COMBO ${this.combo}` : '');
        if (multiplier > 1) this.tweens.add({ targets: this.comboText, scale: { from: 1.4, to: 1 }, duration: 200 });

        sfx.squash(this.combo);
        this.burst(bug.x, bug.y, SPLASH[kind], 20, 300);
        this.burst(bug.x, bug.y, 0xffffff, 6, 120, 'ui-square');
        this.ring(bug.x, bug.y, SPLASH[kind], 60 + Math.min(this.combo, 12) * 4);
        this.splat(bug.x, bug.y, SPLASH[kind]);
        this.glyphs(bug.x, bug.y, SPLASH[kind]);
        this.hitStop(26);
        this.cameras.main.shake(70, 0.002);
        if (multiplier > 1) this.punch(1 + multiplier * 0.006);
        this.removeBug(bug, true);
        this.kills++;
        if (!this.isBossSprint || kind !== 'mini') this.sprintKills++;

        if (kind === 'splitter') {
            for (const dy of [-30, 30]) {
                const mini = this.spawnBug('mini', bug.x, Phaser.Math.Clamp(bug.y + dy, 90, HEIGHT - 40));
                mini.setData('vy', dy * 3);
            }
        }
        if (kind === 'gold') {
            this.slowUntil = this.elapsed + 3500;
            this.banner('Câmera lenta', 'Bug dourado: 3 segundos para respirar', COLORS.yellow);
        }
        if (Math.random() < 0.07 && this.powers.length < 2) this.dropPower(bug.x, bug.y);
        if (!this.isBossSprint && this.sprintKills >= this.sprintGoal) this.nextSprint();
    }

    private removeBug(bug: Phaser.GameObjects.Image, squash: boolean) {
        Phaser.Utils.Array.Remove(this.bugs, bug);
        bug.disableInteractive();
        if (squash) {
            this.tweens.add({ targets: bug, scaleX: bug.scaleX * 1.6, scaleY: 0.15, alpha: 0, duration: 200, onComplete: () => bug.destroy() });
        } else {
            bug.destroy();
        }
    }

    private loseLife(count = 1) {
        this.lives -= count;
        this.setLives(Math.max(0, this.lives));
        this.combo = 0;
        this.comboText.setText('');
        sfx.hurt();
        this.cameras.main.shake(200, 0.01);
        this.cameras.main.flash(180, 255, 60, 60);
        this.ring(PROD_X, HEIGHT / 2, COLORS.red, 260, 8);
        if (this.lives <= 0) {
            this.updateStats();
            this.endGame();
        }
    }

    /* ---------- Sprints e chefão ---------- */

    private nextSprint() {
        this.sprint++;
        this.sprintKills = 0;
        this.sprintText.setText(`SPRINT ${this.sprint}`);
        sfx.levelUp();
        this.addScore(100 * (this.sprint - 1));
        if (this.isBossSprint) {
            this.time.delayedCall(600, () => this.spawnBoss());
        } else {
            this.banner(`Sprint ${this.sprint}`, `Meta: ${this.sprintGoal} bugs · bônus de ${100 * (this.sprint - 1)} pontos`);
        }
    }

    private spawnBoss() {
        sfx.boss();
        this.banner('Bug de Produção!', 'Derrube o chefão antes que ele chegue ao servidor', COLORS.red);
        const hp = Math.round((26 + this.sprint * 5) * this.tuning.boss);
        const boss = this.add.image(WIDTH + 140, HEIGHT / 2, 'bug-boss').setFlipX(true).setScale(3.2 * BUG_SCALE).setDepth(25);
        boss.setInteractive(new Phaser.Geom.Circle(70, 56, 56), Phaser.Geom.Circle.Contains);
        boss.setData({ kind: 'bug', hp, maxHp: hp, spawnAt: 0 });
        this.boss = boss;
        this.bossBar = this.add.graphics().setDepth(85);
        this.drawBossBar();
        this.tweens.add({ targets: boss, angle: { from: -4, to: 4 }, duration: 500, yoyo: true, repeat: -1 });
    }

    private drawBossBar() {
        if (!this.boss || !this.bossBar) return;
        const ratio = Math.max(0, this.boss.getData('hp') / this.boss.getData('maxHp'));
        this.bossBar.clear();
        this.bossBar.fillStyle(0x000000, 0.75).fillRect(WIDTH / 2 - 202, 78, 404, 16);
        this.bossBar.fillStyle(0x4a0f14).fillRect(WIDTH / 2 - 199, 81, 398, 10);
        this.bossBar.fillStyle(ratio < 0.3 ? COLORS.yellow : COLORS.red).fillRect(WIDTH / 2 - 199, 81, 398 * ratio, 10);
    }

    private killBoss() {
        const boss = this.boss!;
        this.boss = undefined;
        this.bossBar?.destroy();
        sfx.explode();
        this.cameras.main.shake(500, 0.02);
        this.cameras.main.flash(300, 242, 194, 0);
        for (let i = 0; i < 4; i++) this.time.delayedCall(i * 110, () => this.ring(boss.x, boss.y, i % 2 ? COLORS.yellow : COLORS.red, 200 + i * 70, 6));
        for (let i = 0; i < 5; i++) {
            this.time.delayedCall(i * 90, () => this.burst(boss.x + Phaser.Math.Between(-60, 60), boss.y + Phaser.Math.Between(-50, 50), i % 2 ? COLORS.yellow : COLORS.red, 24, 360));
        }
        this.addScore(500 + this.sprint * 50, boss.x, boss.y - 80);
        boss.disableInteractive();
        this.tweens.add({ targets: boss, scale: 0, angle: 180, alpha: 0, duration: 600, ease: 'Back.In', onComplete: () => boss.destroy() });
        this.time.delayedCall(900, () => this.nextSprint());
    }

    /* ---------- Poderes ---------- */

    private dropPower(x: number, y: number) {
        const kind = Phaser.Utils.Array.GetRandom<PowerKind>(this.lives < 3 ? ['hotfix', 'review', 'test', 'test'] : ['hotfix', 'review', 'test']);
        const icon = this.add.image(x, y, `pu-${kind}`).setDepth(30).setData({ kind, born: this.elapsed });
        icon.setInteractive(new Phaser.Geom.Circle(24, 24, 34), Phaser.Geom.Circle.Contains);
        this.tweens.add({ targets: icon, y: y - 20, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.tweens.add({ targets: icon, scale: { from: 0, to: 1 }, duration: 300, ease: 'Back.Out' });
        this.powers.push(icon);
    }

    private collect(icon: Phaser.GameObjects.Image) {
        const kind = icon.getData('kind') as PowerKind;
        Phaser.Utils.Array.Remove(this.powers, icon);
        icon.destroy();
        sfx.powerup();
        this.burst(icon.x, icon.y, 0xffffff, 18, 280);

        if (kind === 'hotfix') {
            this.banner('Hotfix!', 'Todos os bugs da tela foram corrigidos', COLORS.red);
            sfx.explode();
            this.cameras.main.flash(250, 255, 255, 255);
            const sweep = this.add.rectangle(PROD_X, 0, 26, HEIGHT, 0xffffff, 0.8).setOrigin(0.5, 0).setDepth(56);
            this.tweens.add({ targets: sweep, x: WIDTH + 40, duration: 420, ease: 'Cubic.In', onComplete: () => sweep.destroy() });
            [...this.bugs].forEach((bug, i) => this.time.delayedCall(i * 40, () => bug.active && this.killBug(bug, true)));
            if (this.boss) {
                this.boss.setData('hp', Math.max(1, this.boss.getData('hp') - 8));
                this.drawBossBar();
            }
        } else if (kind === 'review') {
            this.freezeUntil = this.elapsed + 3500;
            this.banner('Code review', 'Bugs congelados por 3,5 segundos', COLORS.cyan);
        } else {
            this.lives = Math.min(5, this.lives + 1);
            this.setLives(this.lives);
            this.banner('Teste unitário', '+1 vida para a produção', COLORS.green);
        }
    }

    private updateStats() {
        this.stats = {
            Precisão: `${this.shots ? Math.round((this.hits / this.shots) * 100) : 0}%`,
            'Maior combo': String(this.bestCombo),
            Sprint: String(this.sprint),
            'Bugs esmagados': String(this.kills),
        };
    }

    /* ---------- Quadro a quadro ---------- */

    protected step(time: number, delta: number) {
        const frozen = time < this.freezeUntil;
        const slow = time < this.slowUntil ? 0.4 : 1;
        const dt = (delta / 1000) * (frozen ? 0 : slow);
        this.frost.setVisible(frozen);
        this.slowTint.setVisible(slow < 1 && !frozen);

        if (!this.isBossSprint && time > this.nextSpawn) {
            this.spawnBug(this.pickKind());
            this.nextSpawn = time + Math.max(330, 1150 - this.sprint * 70) * this.tuning.spawn * Phaser.Math.FloatBetween(0.7, 1.2);
        }

        for (const bug of [...this.bugs]) {
            // Só troca a cor quando o congelamento muda, para não apagar o piscar do acerto.
            if (bug.getData('frozen') !== frozen) {
                bug.setData('frozen', frozen);
                if (frozen) bug.setTint(0x9be8ff);
                else bug.clearTint();
            }
            const kind = bug.getData('kind') as BugKind;
            bug.x -= bug.getData('speed') * dt;
            const wobble = kind === 'fast' ? Math.sin(time / 90 + bug.getData('seed')) * 220 : Math.sin(time / 140 + bug.getData('seed')) * 30;
            bug.y += (bug.getData('vy') + wobble) * dt;
            // Andar: o corpo balança, e o rastro fica para trás.
            bug.rotation = Math.sin(time / 60 + bug.getData('seed')) * 0.06 * (frozen ? 0 : 1);
            if (!frozen) bug.setFrame(Math.floor(time / 90 + bug.getData('seed')) % 2);
            if (!frozen && Math.random() < 0.2) this.trail.emitParticleAt(bug.x + 20, bug.y, 1);
            if (bug.y < 84 || bug.y > HEIGHT - 30) {
                bug.setData('vy', -bug.getData('vy'));
                bug.y = Phaser.Math.Clamp(bug.y, 84, HEIGHT - 30);
            }
            if (bug.x < PROD_X + 10) {
                this.burst(PROD_X, bug.y, COLORS.red, 10);
                this.removeBug(bug, false);
                this.loseLife();
                if (this.phase !== 'playing') return;
            }
        }

        if (this.boss) {
            const boss = this.boss;
            if (boss.getData('frozen') !== frozen) {
                boss.setData('frozen', frozen);
                if (frozen) boss.setTint(0x9be8ff);
                else boss.clearTint();
            }
            boss.x -= (22 + this.sprint * 2) * dt;
            boss.y = HEIGHT / 2 + Math.sin(time / 900) * 140;
            if (time - boss.getData('spawnAt') > Math.max(1200, 2600 - this.sprint * 80) && !frozen) {
                boss.setData('spawnAt', time);
                this.spawnBug('mini', boss.x - 60, boss.y - 40);
                this.spawnBug('mini', boss.x - 60, boss.y + 40);
            }
            if (boss.x < PROD_X + 90) {
                this.boss = undefined;
                this.bossBar?.destroy();
                boss.destroy();
                this.loseLife(3);
                if (this.phase === 'playing') this.nextSprint();
            }
        }

        for (const icon of [...this.powers]) {
            const age = time - icon.getData('born');
            if (age > 4000) icon.setAlpha(Math.sin(age / 60) > 0 ? 1 : 0.3);
            if (age > 5500) {
                Phaser.Utils.Array.Remove(this.powers, icon);
                icon.destroy();
            }
        }

        // Barra do combo: esvazia até o próximo acerto.
        this.comboBar.clear();
        if (this.combo >= 2) {
            const left = Math.max(0, 1 - (time - this.lastHit) / 1200);
            this.comboBar.fillStyle(0x000000, 0.6).fillRect(WIDTH / 2 - 70, 70, 140, 4);
            this.comboBar.fillStyle(COLORS.yellow).fillRect(WIDTH / 2 - 70, 70, 140 * left, 4);
        }

        this.updateStats();
    }
}


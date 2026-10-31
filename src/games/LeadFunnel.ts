import Phaser from 'phaser';
import { ArcadeScene, COLORS, HEIGHT, SANS, WIDTH } from './ArcadeScene';
import { sfx } from './sfx';

type ItemKind = 'lead' | 'hot' | 'vip' | 'spam' | 'virus' | 'bot' | 'wide' | 'shield';

const GOOD: ItemKind[] = ['lead', 'hot', 'vip'];
const BAD: ItemKind[] = ['spam', 'virus'];
const POWERS: ItemKind[] = ['bot', 'wide', 'shield'];
const POINTS: Partial<Record<ItemKind, number>> = { lead: 10, hot: 30, vip: 100 };
const SPLASH: Record<ItemKind, number> = {
    lead: COLORS.whatsapp,
    hot: COLORS.yellow,
    vip: COLORS.gold,
    spam: COLORS.red,
    virus: COLORS.purple,
    bot: COLORS.cyan,
    wide: COLORS.orange,
    shield: COLORS.green,
};
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const FUNNEL_Y = HEIGHT - 70;

interface Item {
    sprite: Phaser.GameObjects.Image;
    kind: ItemKind;
    vy: number;
    seed: number;
    spin: number;
    prevY: number;
}

/**
 * Funil de Leads: capture leads, fuja de spam e vírus, bata a meta de cada mês.
 * Poderes: Bot de IA (puxa os leads), funil largo e escudo antispam.
 */
export class LeadFunnel extends ArcadeScene {
    readonly gameId = 'lead-funnel';
    readonly title = 'Funil de Leads';
    readonly hint = 'Arraste, mova o mouse ou use as setas. Capture leads para bater a meta do mês; spam tira uma vida e vírus trava o funil. Leads seguidos multiplicam os pontos.';
    readonly medals: [number, number, number] = [1200, 3500, 8000];

    private funnel!: Phaser.GameObjects.Container;
    private funnelImg!: Phaser.GameObjects.Image;
    private bubble!: Phaser.GameObjects.Arc;
    private items: Item[] = [];
    private lives = 3;
    private setLives!: (n: number) => void;
    private targetX = WIDTH / 2;
    private velocity = 0;
    private keys?: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA?: Phaser.Input.Keyboard.Key;
    private keyD?: Phaser.Input.Keyboard.Key;
    private streak = 0;
    private bestStreak = 0;
    private caught = 0;
    private missed = 0;
    private month = 0;
    private monthScore = 0;
    private nextDrop = 0;
    private botUntil = 0;
    private wideUntil = 0;
    private shieldUntil = 0;
    private stunUntil = 0;
    private goalBar!: Phaser.GameObjects.Graphics;
    private monthText!: Phaser.GameObjects.Text;
    private streakText!: Phaser.GameObjects.Text;

    constructor() {
        super('lead-funnel');
    }

    private get monthGoal() {
        return 300 + this.month * 260;
    }

    protected build() {
        this.makeTextures();
        Object.assign(this, { items: [], lives: 3, targetX: WIDTH / 2, velocity: 0, streak: 0, bestStreak: 0, caught: 0, missed: 0, month: 0, monthScore: 0, botUntil: 0, wideUntil: 0, shieldUntil: 0, stunUntil: 0 });

        this.legend = [
            { key: 'it-lead', label: 'Lead: 10' },
            { key: 'it-hot', label: 'Lead quente: 30' },
            { key: 'it-vip', label: 'Contrato VIP: 100' },
            { key: 'it-spam', label: 'Spam: perde vida' },
            { key: 'it-virus', label: 'Vírus: trava o funil' },
            { key: 'it-bot', label: 'Poderes' },
        ];

        this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.dark).setOrigin(0);
        const grid = this.add.graphics();
        grid.fillStyle(0xffffff, 0.05);
        for (let x = 12; x < WIDTH; x += 24) for (let y = 12; y < HEIGHT; y += 24) grid.fillRect(x, y, 2, 2);
        ['NOVO', 'QUALIFICADO', 'PROPOSTA', 'FECHADO'].forEach((label, i) => {
            this.add.rectangle(i * 240, 0, 238, HEIGHT, 0xffffff, 0.015).setOrigin(0);
            this.add.text(120 + i * 240, HEIGHT - 20, label, { fontFamily: SANS, fontSize: '12px', fontStyle: '800', color: '#3a3a42' }).setOrigin(0.5);
        });

        this.funnelImg = this.add.image(0, 0, 'funnel');
        this.bubble = this.add.circle(0, -10, 100).setStrokeStyle(3, COLORS.green, 0.8).setFillStyle(COLORS.green, 0.08).setVisible(false);
        this.funnel = this.add.container(WIDTH / 2, FUNNEL_Y, [this.bubble, this.funnelImg]).setDepth(20);

        this.setLives = this.lifeRow(3, 3);
        this.goalBar = this.add.graphics().setDepth(80);
        this.monthText = this.add.text(WIDTH / 2, 56, '', { fontFamily: SANS, fontSize: '13px', fontStyle: '800', color: '#d4d4d8' }).setOrigin(0.5).setDepth(80);
        this.streakText = this.add.text(24, 44, '', { fontFamily: SANS, fontSize: '14px', fontStyle: '800', color: '#f2c200', stroke: '#0a0a0b', strokeThickness: 4 }).setDepth(80);

        this.keys = this.input.keyboard?.createCursorKeys();
        this.keyA = this.input.keyboard?.addKey('A');
        this.keyD = this.input.keyboard?.addKey('D');
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => (this.targetX = p.x));
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.targetX = p.x));
    }

    private makeTextures() {
        if (this.textures.exists('funnel')) return;
        const g = this.add.graphics();

        g.fillStyle(COLORS.yellow).fillPoints([new Phaser.Geom.Point(0, 8), new Phaser.Geom.Point(160, 8), new Phaser.Geom.Point(102, 62), new Phaser.Geom.Point(58, 62)], true);
        g.fillStyle(0xc79f02).fillRect(66, 62, 28, 26);
        g.fillStyle(COLORS.yellow).fillRect(0, 0, 160, 10);
        g.fillStyle(0x0a0a0b, 0.35).fillRect(12, 14, 136, 5);
        g.generateTexture('funnel', 160, 88);
        g.clear();

        const bubble = (key: string, color: number, glyph: () => void) => {
            g.fillStyle(color).fillCircle(28, 26, 24);
            g.fillTriangle(10, 40, 6, 56, 24, 46);
            g.fillStyle(0xffffff, 0.25).fillEllipse(20, 16, 18, 9);
            glyph();
            g.generateTexture(key, 56, 58);
            g.clear();
        };
        bubble('it-lead', COLORS.whatsapp, () => {
            g.fillStyle(0xffffff);
            [17, 28, 39].forEach((x) => g.fillCircle(x, 26, 4));
        });
        bubble('it-hot', COLORS.yellow, () => {
            const star: Phaser.Geom.Point[] = [];
            for (let i = 0; i < 10; i++) {
                const r = i % 2 ? 7 : 15;
                const a = (Math.PI / 5) * i - Math.PI / 2;
                star.push(new Phaser.Geom.Point(28 + Math.cos(a) * r, 26 + Math.sin(a) * r));
            }
            g.fillStyle(COLORS.black).fillPoints(star, true);
        });
        bubble('it-spam', COLORS.red, () => {
            g.lineStyle(6, 0xffffff).lineBetween(18, 16, 38, 36).lineBetween(38, 16, 18, 36);
        });

        // Contrato VIP: documento dourado com selo.
        g.fillStyle(COLORS.gold).fillRoundedRect(8, 2, 40, 52, 4);
        g.fillStyle(0x0a0a0b, 0.5);
        [12, 20, 28].forEach((y) => g.fillRect(15, y, 26, 3));
        g.fillStyle(COLORS.red).fillCircle(38, 44, 9);
        g.fillStyle(COLORS.gold).fillCircle(38, 44, 4);
        g.generateTexture('it-vip', 56, 58);
        g.clear();

        // Vírus: esfera com espinhos.
        g.fillStyle(COLORS.purple);
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i;
            g.fillCircle(28 + Math.cos(a) * 22, 28 + Math.sin(a) * 22, 5);
        }
        g.fillCircle(28, 28, 18);
        g.fillStyle(0x0a0a0b).fillCircle(22, 25, 4).fillCircle(34, 25, 4).fillRect(21, 34, 14, 3);
        g.generateTexture('it-virus', 56, 58);
        g.clear();

        const power = (key: string, color: number, glyph: () => void) => {
            g.fillStyle(color).fillRoundedRect(2, 2, 52, 52, 12);
            g.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(5, 5, 46, 46, 10);
            glyph();
            g.generateTexture(key, 56, 58);
            g.clear();
        };
        power('it-bot', COLORS.cyan, () => {
            g.fillStyle(COLORS.black).fillRoundedRect(15, 18, 26, 20, 5).fillRect(27, 11, 2, 7).fillCircle(28, 10, 3);
            g.fillStyle(COLORS.cyan).fillCircle(22, 28, 3).fillCircle(34, 28, 3);
        });
        power('it-wide', COLORS.orange, () => {
            g.lineStyle(5, COLORS.black).lineBetween(12, 28, 44, 28).lineBetween(12, 28, 19, 21).lineBetween(12, 28, 19, 35).lineBetween(44, 28, 37, 21).lineBetween(44, 28, 37, 35);
        });
        power('it-shield', COLORS.green, () => {
            g.fillStyle(COLORS.black).fillPoints([new Phaser.Geom.Point(28, 12), new Phaser.Geom.Point(42, 18), new Phaser.Geom.Point(39, 34), new Phaser.Geom.Point(28, 44), new Phaser.Geom.Point(17, 34), new Phaser.Geom.Point(14, 18)], true);
        });
        g.destroy();
    }

    protected start() {
        this.nextDrop = 500;
        this.banner(MONTHS[0]!, `Meta do mês: ${this.monthGoal} pontos`);
    }

    /* ---------- Itens ---------- */

    private pick(): ItemKind {
        const m = this.month;
        const roll = Math.random();
        const spam = Math.min(0.3, 0.17 + m * 0.015);
        if (roll < spam) return 'spam';
        if (m >= 1 && roll < spam + 0.06) return 'virus';
        if (roll < spam + 0.1) return Phaser.Utils.Array.GetRandom(POWERS);
        if (m >= 1 && roll < spam + 0.14) return 'vip';
        if (roll < spam + 0.32) return 'hot';
        return 'lead';
    }

    private drop() {
        const kind = this.pick();
        const sprite = this.add.image(Phaser.Math.Between(60, WIDTH - 60), -40, `it-${kind}`).setDepth(15);
        const base = 165 + this.month * 24;
        const factor = kind === 'hot' ? 1.3 : kind === 'vip' ? 1.15 : kind === 'virus' ? 1.2 : POWERS.includes(kind) ? 0.8 : 1;
        this.items.push({ sprite, kind, vy: base * factor * Phaser.Math.FloatBetween(0.85, 1.2), seed: Math.random() * 10, spin: Phaser.Math.FloatBetween(-2, 2), prevY: -40 });
        sprite.setScale(0);
        this.tweens.add({ targets: sprite, scale: 1, duration: 220, ease: 'Back.Out' });
    }

    private removeItem(item: Item) {
        Phaser.Utils.Array.Remove(this.items, item);
        item.sprite.destroy();
    }

    private catch(item: Item) {
        const { kind, sprite } = item;
        this.removeItem(item);
        this.burst(sprite.x, FUNNEL_Y - 30, SPLASH[kind], 14);

        if (GOOD.includes(kind)) {
            this.streak++;
            this.caught++;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            const mult = this.streak >= 25 ? 4 : this.streak >= 16 ? 3 : this.streak >= 8 ? 2 : 1;
            const points = (POINTS[kind] ?? 0) * mult;
            this.addScore(points, sprite.x, FUNNEL_Y - 60);
            this.monthScore += points;
            sfx.coin(Math.min(this.streak, 12));
            if (kind === 'vip') {
                sfx.powerup();
                this.cameras.main.flash(150, 212, 175, 55);
            }
            this.tweens.add({ targets: this.funnelImg, scaleY: { from: 0.8, to: 1 }, duration: 160, ease: 'Back.Out' });
            if (this.monthScore >= this.monthGoal) this.nextMonth();
        } else if (BAD.includes(kind)) {
            if (this.elapsed < this.shieldUntil) {
                sfx.shield();
                this.popText(sprite.x, FUNNEL_Y - 60, 'bloqueado', COLORS.green, 16);
                return;
            }
            this.streak = 0;
            this.lives--;
            this.setLives(Math.max(0, this.lives));
            sfx.hurt();
            this.cameras.main.shake(220, 0.012);
            this.cameras.main.flash(160, 255, 60, 60);
            if (kind === 'virus') {
                this.stunUntil = this.elapsed + 1000;
                this.popText(sprite.x, FUNNEL_Y - 60, 'funil travado!', COLORS.purple, 16);
            }
            if (this.lives <= 0) {
                this.updateStats();
                this.endGame();
            }
        } else {
            sfx.powerup();
            if (kind === 'bot') {
                this.botUntil = this.elapsed + 6000;
                this.banner('Bot de IA', 'Os leads vêm até o funil por 6 segundos', COLORS.cyan);
            } else if (kind === 'wide') {
                this.wideUntil = this.elapsed + 7000;
                this.banner('Funil largo', 'Mais espaço para capturar por 7 segundos', COLORS.orange);
            } else {
                this.shieldUntil = this.elapsed + 6000;
                this.banner('Antispam', 'Spam e vírus bloqueados por 6 segundos', COLORS.green);
            }
        }
    }

    private nextMonth() {
        const done = MONTHS[this.month % 12]!;
        this.month++;
        this.monthScore = 0;
        const bonus = 50 * this.month;
        this.addScore(bonus);
        sfx.levelUp();
        this.banner(`Meta de ${done} batida!`, `+${bonus} de bônus · ${MONTHS[this.month % 12]}: meta de ${this.monthGoal} pontos`, COLORS.green);
        this.burst(WIDTH / 2, 70, COLORS.green, 30, 380);
    }

    private updateStats() {
        const total = this.caught + this.missed;
        this.stats = {
            'Leads captados': String(this.caught),
            Conversão: `${total ? Math.round((this.caught / total) * 100) : 0}%`,
            'Maior sequência': String(this.bestStreak),
            'Meses batidos': String(this.month),
        };
    }

    /* ---------- Quadro a quadro ---------- */

    protected step(time: number, delta: number) {
        const dt = delta / 1000;
        const stunned = time < this.stunUntil;
        const wide = time < this.wideUntil;
        const bot = time < this.botUntil;
        const shield = time < this.shieldUntil;

        // Funil: segue o mouse/dedo ou acelera pelas setas; inclina com a velocidade.
        const left = this.keys?.left.isDown || this.keyA?.isDown;
        const right = this.keys?.right.isDown || this.keyD?.isDown;
        if (left) this.targetX -= 820 * dt;
        if (right) this.targetX += 820 * dt;
        const half = wide ? 130 : 80;
        this.targetX = Phaser.Math.Clamp(this.targetX, half, WIDTH - half);
        const previous = this.funnel.x;
        if (!stunned) this.funnel.x += (this.targetX - this.funnel.x) * Math.min(1, dt * 14);
        this.velocity = (this.funnel.x - previous) / Math.max(dt, 0.001);
        this.funnel.angle += (Phaser.Math.Clamp(this.velocity * 0.012, -16, 16) - this.funnel.angle) * 0.25;
        this.funnelImg.scaleX += ((wide ? 1.65 : 1) - this.funnelImg.scaleX) * 0.15;
        this.funnelImg.setTint(stunned ? 0xb69cff : 0xffffff);
        if (stunned) this.funnel.x = previous + Math.sin(time / 20) * 3;
        this.bubble.setVisible(shield).setRadius(wide ? 140 : 96);

        // Novos itens.
        if (time > this.nextDrop) {
            this.drop();
            this.nextDrop = time + Math.max(260, 820 - this.month * 60) * Phaser.Math.FloatBetween(0.7, 1.25);
        }

        const mouthY = FUNNEL_Y - 32;
        for (const item of [...this.items]) {
            item.prevY = item.sprite.y;
            item.sprite.y += item.vy * dt;
            if (item.kind === 'vip') item.sprite.x += Math.sin(time / 260 + item.seed) * 160 * dt;
            if (bot && GOOD.includes(item.kind) && item.sprite.y > 120) item.sprite.x += (this.funnel.x - item.sprite.x) * 3 * dt;
            item.sprite.rotation += item.spin * dt;
            item.sprite.x = Phaser.Math.Clamp(item.sprite.x, 30, WIDTH - 30);

            // Só conta se entrar pela boca do funil, de cima para baixo.
            const inside = Math.abs(item.sprite.x - this.funnel.x) < half * 0.9;
            if (inside && item.prevY < mouthY && item.sprite.y >= mouthY) {
                this.catch(item);
                if (this.phase !== 'playing') return;
                continue;
            }
            if (item.sprite.y > HEIGHT + 40) {
                if (GOOD.includes(item.kind)) {
                    this.missed++;
                    if (this.streak >= 5) this.popText(item.sprite.x, HEIGHT - 40, 'sequência perdida', COLORS.muted, 14);
                    this.streak = 0;
                }
                this.removeItem(item);
            }
        }

        // Meta do mês.
        const ratio = Math.min(1, this.monthScore / this.monthGoal);
        this.goalBar.clear();
        this.goalBar.fillStyle(0x000000, 0.6).fillRect(WIDTH / 2 - 160, 74, 320, 10);
        this.goalBar.fillStyle(COLORS.green).fillRect(WIDTH / 2 - 160, 74, 320 * ratio, 10);
        this.monthText.setText(`${MONTHS[this.month % 12]!.toUpperCase()} · META ${this.monthScore}/${this.monthGoal}`);
        const mult = this.streak >= 25 ? 4 : this.streak >= 16 ? 3 : this.streak >= 8 ? 2 : 1;
        this.streakText.setText(this.streak >= 3 ? `SEQUÊNCIA ${this.streak}${mult > 1 ? ` · x${mult}` : ''}` : '');
        this.updateStats();
    }
}

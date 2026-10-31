import Phaser from 'phaser';
import { ArcadeScene, COLORS, HEIGHT, SANS, WIDTH } from './ArcadeScene';
import { sfx } from './sfx';

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

/**
 * Caça-Bugs: bugs atravessam o editor rumo à produção. Cada tipo se comporta
 * de um jeito, há poderes para pegar e um chefão a cada quatro sprints.
 */
export class BugHunt extends ArcadeScene {
    readonly gameId = 'bug-hunt';
    readonly title = 'Caça-Bugs';
    readonly hint = 'Clique ou toque nos bugs antes que cheguem à produção. Acertos seguidos multiplicam os pontos; errar o clique quebra o combo. A cada 4 sprints aparece o Bug de Produção.';
    readonly medals: [number, number, number] = [1500, 4000, 9000];

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

    constructor() {
        super('bug-hunt');
    }

    private get sprintGoal() {
        return 10 + this.sprint * 4;
    }

    private get isBossSprint() {
        return this.sprint % 4 === 0;
    }

    protected build() {
        this.makeTextures();
        Object.assign(this, { bugs: [], powers: [], boss: undefined, lives: 3, combo: 0, bestCombo: 0, hits: 0, shots: 0, kills: 0, sprint: 1, sprintKills: 0, slowUntil: 0, freezeUntil: 0 });

        this.legend = [
            { key: 'bug-red', label: 'Bug: 1 clique' },
            { key: 'bug-purple', label: 'Segfault: rápido' },
            { key: 'bug-green', label: 'Memory leak: 3 cliques', scale: 1.2 },
            { key: 'bug-orange', label: 'Race condition: se divide' },
            { key: 'bug-gold', label: 'Dourado: câmera lenta' },
            { key: 'pu-hotfix', label: 'Poderes: clique para pegar' },
        ];

        // Editor de código.
        this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.dark).setOrigin(0);
        this.add.rectangle(PROD_X, 0, 62, HEIGHT, 0x101013).setOrigin(0);
        for (let i = 0; i < 17; i++) {
            const y = 70 + i * 27;
            this.add.text(PROD_X + 48, y, String(i + 1), { fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#45454d' }).setOrigin(1, 0);
            this.add.text(PROD_X + 82, y, CODE[(i * 5) % CODE.length]!, { fontFamily: 'Consolas, monospace', fontSize: '15px', color: i % 3 ? '#55555f' : '#7a6a2a' });
        }

        // Produção: servidores à esquerda.
        this.add.rectangle(0, 0, PROD_X, HEIGHT, 0x1a0f10).setOrigin(0);
        const glow = this.add.rectangle(PROD_X - 4, 0, 6, HEIGHT, COLORS.red, 0.6).setOrigin(0);
        this.tweens.add({ targets: glow, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
        for (let i = 0; i < 6; i++) {
            const y = 80 + i * 72;
            this.add.rectangle(18, y, 64, 52, 0x2a1a1c).setOrigin(0);
            for (let j = 0; j < 3; j++) {
                const led = this.add.rectangle(28 + j * 14, y + 40, 6, 4, COLORS.green);
                this.tweens.add({ targets: led, alpha: 0.2, duration: Phaser.Math.Between(300, 900), yoyo: true, repeat: -1 });
            }
        }
        this.add.text(PROD_X / 2, HEIGHT - 22, 'PRODUÇÃO', { fontFamily: SANS, fontSize: '11px', fontStyle: '800', color: '#ff8a8a' }).setOrigin(0.5);

        this.setLives = this.lifeRow(3, 5);
        this.comboText = this.add.text(WIDTH / 2, 58, '', { fontFamily: SANS, fontSize: '15px', fontStyle: '800', color: '#f2c200', stroke: '#0a0a0b', strokeThickness: 4 }).setOrigin(0.5).setDepth(80);
        this.sprintText = this.add.text(WIDTH - 24, 44, 'SPRINT 1', { fontFamily: SANS, fontSize: '13px', fontStyle: '800', color: '#a3a3ab' }).setOrigin(1, 0).setDepth(80);

        // Mira própria no mouse; no toque, o dedo é a mira.
        if (!this.sys.game.device.input.touch) {
            this.input.setDefaultCursor('none');
            const ring = this.add.circle(0, 0, 18).setStrokeStyle(2, COLORS.yellow);
            const dot = this.add.circle(0, 0, 2.5, COLORS.yellow);
            const lines = this.add.graphics().lineStyle(2, COLORS.yellow);
            lines.lineBetween(-28, 0, -12, 0).lineBetween(12, 0, 28, 0).lineBetween(0, -28, 0, -12).lineBetween(0, 12, 0, 28);
            this.reticle = this.add.container(WIDTH / 2, HEIGHT / 2, [ring, dot, lines]).setDepth(200);
            this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.reticle?.setPosition(p.x, p.y));
        }

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.shoot(pointer, over));
    }

    private makeTextures() {
        if (this.textures.exists('bug-red')) return;

        // Besouro olhando para a direita: patas e antenas claras para aparecer no fundo escuro.
        const bug = (key: string, shell: number, dark: number, eye = 0xffffff) => {
            const g = this.add.graphics();
            g.lineStyle(4, 0x9a9aa3);
            [16, 26, 36].forEach((x, i) => {
                g.lineBetween(x, 18, x - 6 + i * 2, 4).lineBetween(x - 6 + i * 2, 4, x - 12 + i * 2, 2);
                g.lineBetween(x, 38, x - 6 + i * 2, 52).lineBetween(x - 6 + i * 2, 52, x - 12 + i * 2, 54);
            });
            g.lineStyle(3, 0x9a9aa3).lineBetween(56, 22, 66, 10).lineBetween(56, 34, 66, 46);
            g.fillStyle(0x3a3a42).fillCircle(52, 28, 11);
            g.fillStyle(shell).fillEllipse(28, 28, 44, 34);
            g.fillStyle(0xffffff, 0.25).fillEllipse(22, 20, 16, 8);
            g.fillStyle(dark).fillRect(27, 12, 3, 32).fillCircle(18, 22, 4).fillCircle(36, 34, 4).fillCircle(38, 20, 3);
            g.fillStyle(eye).fillCircle(56, 23, 3).fillCircle(56, 33, 3);
            g.generateTexture(key, 70, 56);
            g.destroy();
        };
        bug('bug-red', COLORS.red, 0x8f2626);
        bug('bug-purple', COLORS.purple, 0x5b3fa8);
        bug('bug-green', COLORS.green, 0x1d7a5a);
        bug('bug-orange', COLORS.orange, 0x9a4a12);
        bug('bug-gold', COLORS.yellow, 0x8a6e04);
        bug('bug-boss', 0x7a1020, 0x2a0508, COLORS.yellow);

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
        bug.setInteractive(new Phaser.Geom.Circle(35, 28, def.radius), Phaser.Geom.Circle.Contains);
        const level = 1 + (this.sprint - 1) * 0.12;
        bug.setData({ kind, hp: def.hp, vy: Phaser.Math.FloatBetween(-35, 35), speed: 72 * def.speed * level * Phaser.Math.FloatBetween(0.9, 1.15), seed: Math.random() * 10, boss: false });
        bug.setScale(0);
        this.tweens.add({ targets: bug, scale: def.scale, duration: 260, ease: 'Back.Out' });
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
        this.tweens.add({ targets: this.reticle, scale: { from: 0.7, to: 1 }, duration: 120 });
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
            if (this.combo > 2) this.popText(pointer.x, pointer.y, 'combo perdido', COLORS.muted, 14);
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
        this.burst(bug.x, bug.y, SPLASH[kind], 16);
        this.burst(bug.x, bug.y, 0xffffff, 6, 120, 'ui-square');
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
        const hp = 26 + this.sprint * 5;
        const boss = this.add.image(WIDTH + 140, HEIGHT / 2, 'bug-boss').setFlipX(true).setScale(3.2).setDepth(25);
        boss.setInteractive(new Phaser.Geom.Circle(35, 28, 28), Phaser.Geom.Circle.Contains);
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
        this.bossBar.fillStyle(0x000000, 0.7).fillRect(WIDTH / 2 - 200, 80, 400, 14);
        this.bossBar.fillStyle(COLORS.red).fillRect(WIDTH / 2 - 198, 82, 396 * ratio, 10);
    }

    private killBoss() {
        const boss = this.boss!;
        this.boss = undefined;
        this.bossBar?.destroy();
        sfx.explode();
        this.cameras.main.shake(500, 0.02);
        this.cameras.main.flash(300, 242, 194, 0);
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

        if (!this.isBossSprint && time > this.nextSpawn) {
            this.spawnBug(this.pickKind());
            this.nextSpawn = time + Math.max(330, 1150 - this.sprint * 70) * Phaser.Math.FloatBetween(0.7, 1.2);
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

        this.updateStats();
    }
}


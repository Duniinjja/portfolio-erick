import Phaser from 'phaser';
import { sfx } from './sfx';

export const WIDTH = 960;
export const HEIGHT = 540;

export const COLORS = {
    black: 0x0a0a0b,
    dark: 0x141417,
    dark2: 0x1f1f23,
    dark3: 0x2a2a30,
    yellow: 0xf2c200,
    gold: 0xd4af37,
    white: 0xffffff,
    muted: 0xa3a3ab,
    red: 0xff5c5c,
    green: 0x34d399,
    whatsapp: 0x25d366,
    purple: 0xa78bfa,
    orange: 0xfb923c,
    cyan: 0x22d3ee,
};

export const SANS = 'Montserrat, system-ui, sans-serif';
export const SERIF = '"Libre Baskerville", Georgia, serif';

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Recorde por jogo, guardado só neste navegador. */
export const getBest = (id: string) => {
    try {
        return Number(localStorage.getItem(`arcade:${id}`)) || 0;
    } catch {
        return 0;
    }
};

const setBest = (id: string, score: number) => {
    try {
        localStorage.setItem(`arcade:${id}`, String(score));
    } catch {
        /* navegação privada: o recorde vale só nesta partida */
    }
};

export interface LegendItem {
    key: string;
    label: string;
    scale?: number;
}

type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'over';

const MEDALS = [
    { name: 'Bronze', color: 0xcd7f32 },
    { name: 'Prata', color: 0xc0c0c8 },
    { name: 'Ouro', color: 0xf2c200 },
];

/**
 * Base dos jogos: placar, contagem, pausa, avisos de fase, fim de jogo com
 * medalha e estatísticas, e efeitos reutilizáveis (partículas, textos, tremor).
 * Cada jogo implementa `build` (cenário), `start` (partida) e `step` (quadro).
 * O `time` de `step` é o tempo de jogo: não corre durante a pausa.
 */
export abstract class ArcadeScene extends Phaser.Scene {
    abstract readonly gameId: string;
    abstract readonly title: string;
    abstract readonly hint: string;
    /** Pontos para bronze, prata e ouro. */
    abstract readonly medals: [number, number, number];
    protected legend: LegendItem[] = [];
    /** Jogos de digitação desligam o atalho P (a letra faz parte do texto). */
    protected pauseKey = true;

    protected phase: Phase = 'ready';
    protected score = 0;
    protected elapsed = 0;
    protected stats: Record<string, string> = {};

    private scoreText!: Phaser.GameObjects.Text;
    private bestText!: Phaser.GameObjects.Text;
    private overlay?: Phaser.GameObjects.Container;
    private pauseBox?: Phaser.GameObjects.Container;

    protected abstract build(): void;
    protected abstract start(): void;
    protected abstract step(time: number, delta: number): void;
    /** Chamado ao pausar e retomar, para o jogo congelar o que for dele. */
    protected onPause(_paused: boolean): void {}

    create() {
        this.phase = 'ready';
        this.score = 0;
        this.elapsed = 0;
        this.stats = {};
        this.makeBaseTextures();
        this.build();
        this.createHud();

        const togglePause = () => this.togglePause();
        this.game.events.on('arcade-toggle-pause', togglePause);
        if (this.pauseKey) this.input.keyboard?.on('keydown-P', togglePause);
        this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off('arcade-toggle-pause', togglePause);
            this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
        });

        if (this.registry.get('autostart')) {
            this.registry.set('autostart', false);
            this.countdown();
        } else {
            this.showReady();
        }
    }

    update(_time: number, delta: number) {
        if (this.phase !== 'playing') return;
        const dt = Math.min(delta, 50);
        this.elapsed += dt;
        this.step(this.elapsed, dt);
    }

    /* ---------- Efeitos reutilizáveis ---------- */

    private makeBaseTextures() {
        if (this.textures.exists('ui-dot')) return;
        const g = this.add.graphics();
        g.fillStyle(0xffffff);
        g.fillCircle(6, 6, 6);
        g.generateTexture('ui-dot', 12, 12);
        g.clear();
        g.fillStyle(0xffffff);
        g.fillRect(0, 0, 8, 8);
        g.generateTexture('ui-square', 8, 8);
        g.clear();
        g.fillStyle(COLORS.yellow);
        g.fillRoundedRect(0, 0, 22, 18, 3);
        g.fillStyle(COLORS.black);
        g.fillRect(4, 5, 14, 2);
        g.fillRect(4, 10, 9, 2);
        g.fillStyle(COLORS.green);
        g.fillCircle(17, 12, 2.5);
        g.generateTexture('ui-life', 22, 18);
        g.destroy();
    }

    protected burst(x: number, y: number, color: number, count = 14, speed = 240, texture = 'ui-dot') {
        const emitter = this.add.particles(x, y, texture, {
            speed: { min: speed * 0.3, max: speed },
            angle: { min: 0, max: 360 },
            lifespan: { min: 300, max: 650 },
            scale: { start: texture === 'ui-dot' ? 0.7 : 1, end: 0 },
            rotate: { min: 0, max: 360 },
            tint: color,
            emitting: false,
        });
        emitter.setDepth(60);
        emitter.explode(count);
        this.time.delayedCall(800, () => emitter.destroy());
    }

    protected popText(x: number, y: number, text: string, color = COLORS.yellow, size = 22) {
        const label = this.add
            .text(x, y, text, { fontFamily: SANS, fontSize: `${size}px`, fontStyle: '800', color: hex(color), stroke: '#0a0a0b', strokeThickness: 4 })
            .setOrigin(0.5)
            .setDepth(70);
        this.tweens.add({ targets: label, y: y - 56, alpha: { from: 1, to: 0 }, scale: { from: 1.3, to: 1 }, duration: 800, ease: 'Cubic.Out', onComplete: () => label.destroy() });
    }

    protected addScore(points: number, x?: number, y?: number) {
        this.score = Math.max(0, Math.round(this.score + points));
        this.scoreText.setText(`PONTOS ${this.score.toLocaleString('pt-BR')}`);
        this.tweens.add({ targets: this.scoreText, scale: { from: 1.2, to: 1 }, duration: 200, ease: 'Back.Out' });
        if (x !== undefined && y !== undefined) {
            this.popText(x, y, points > 0 ? `+${points}` : `${points}`, points > 0 ? COLORS.yellow : COLORS.red);
        }
    }

    /** Aviso grande no meio da tela: nova fase, chefão, poder. */
    protected banner(title: string, sub = '', color = COLORS.yellow) {
        const box = this.add.container(WIDTH / 2, HEIGHT / 2 - 40).setDepth(90);
        const bar = this.add.rectangle(0, 0, WIDTH, sub ? 110 : 80, COLORS.black, 0.75);
        const big = this.add.text(0, sub ? -16 : 0, title, { fontFamily: SERIF, fontSize: '40px', fontStyle: '700', color: hex(color) }).setOrigin(0.5);
        box.add([bar, big]);
        if (sub) box.add(this.add.text(0, 30, sub, { fontFamily: SANS, fontSize: '16px', fontStyle: '700', color: '#d4d4d8' }).setOrigin(0.5));
        box.setScale(1, 0);
        this.tweens.chain({
            targets: box,
            tweens: [
                { scaleY: 1, duration: 220, ease: 'Back.Out' },
                { scaleY: 1, duration: 1100 },
                { scaleY: 0, alpha: 0, duration: 220, ease: 'Cubic.In' },
            ],
            onComplete: () => box.destroy(),
        });
    }

    protected lifeRow(count: number, max: number) {
        const icons: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < max; i++) {
            icons.push(
                this.add
                    .image(WIDTH / 2 - ((max - 1) * 30) / 2 + i * 30, 30, 'ui-life')
                    .setDepth(80)
                    .setAlpha(i < count ? 1 : 0.15),
            );
        }
        return (value: number) =>
            icons.forEach((icon, i) => {
                const on = i < value;
                if ((icon.alpha === 1) !== on) {
                    this.tweens.add({ targets: icon, alpha: on ? 1 : 0.15, scale: { from: on ? 1.6 : 0.6, to: 1 }, duration: 260, ease: 'Back.Out' });
                }
            });
    }

    /* ---------- Fluxo da partida ---------- */

    private createHud() {
        const style = { fontFamily: SANS, fontSize: '16px', fontStyle: '800', color: '#ffffff', stroke: '#0a0a0b', strokeThickness: 4 };
        this.scoreText = this.add.text(24, 18, 'PONTOS 0', style).setDepth(80);
        this.bestText = this.add
            .text(WIDTH - 24, 18, `RECORDE ${getBest(this.gameId).toLocaleString('pt-BR')}`, { ...style, color: '#f2c200' })
            .setOrigin(1, 0)
            .setDepth(80);
    }

    private countdown() {
        this.phase = 'countdown';
        ['3', '2', '1', 'JÁ!'].forEach((label, i, all) => {
            this.time.delayedCall(i * 560, () => {
                const last = i === all.length - 1;
                sfx.count(last);
                const text = this.add
                    .text(WIDTH / 2, HEIGHT / 2, label, { fontFamily: SERIF, fontSize: last ? '90px' : '120px', fontStyle: '700', color: last ? '#f2c200' : '#ffffff', stroke: '#0a0a0b', strokeThickness: 8 })
                    .setOrigin(0.5)
                    .setDepth(110);
                this.tweens.add({ targets: text, scale: { from: 1.8, to: 0.9 }, alpha: { from: 1, to: 0 }, duration: 540, ease: 'Cubic.Out', onComplete: () => text.destroy() });
                if (last) {
                    this.phase = 'playing';
                    this.start();
                }
            });
        });
    }

    private autoPause() {
        if (this.phase === 'playing') this.togglePause();
    }

    protected togglePause() {
        if (this.phase === 'playing') {
            this.phase = 'paused';
            this.tweens.pauseAll();
            this.time.paused = true;
            this.physics?.world?.pause();
            this.onPause(true);
            this.pauseBox = this.add.container(0, 0).setDepth(120);
            this.pauseBox.add([
                this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.black, 0.7).setOrigin(0),
                this.add.text(WIDTH / 2, HEIGHT / 2 - 20, 'Pausado', { fontFamily: SERIF, fontSize: '52px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5),
                this.add.text(WIDTH / 2, HEIGHT / 2 + 40, 'P OU TOQUE PARA CONTINUAR', { fontFamily: SANS, fontSize: '15px', fontStyle: '800', color: '#f2c200' }).setOrigin(0.5),
            ]);
            this.input.once('pointerdown', () => this.phase === 'paused' && this.togglePause());
        } else if (this.phase === 'paused') {
            this.pauseBox?.destroy();
            this.tweens.resumeAll();
            this.time.paused = false;
            this.physics?.world?.resume();
            this.onPause(false);
            this.phase = 'playing';
        }
    }

    protected endGame() {
        if (this.phase !== 'playing') return;
        this.phase = 'over';
        this.cameras.main.shake(320, 0.012);
        this.physics?.world?.pause();

        const best = getBest(this.gameId);
        const record = this.score > best && this.score > 0;
        if (record) {
            setBest(this.gameId, this.score);
            this.bestText.setText(`RECORDE ${this.score.toLocaleString('pt-BR')}`);
        }
        this.time.delayedCall(250, () => (record ? sfx.record() : sfx.gameOver()));
        this.game.events.emit('arcade-score', { id: this.gameId, score: this.score, best: Math.max(best, this.score) });
        this.time.delayedCall(700, () => this.showOver(record));
    }

    private cta(y: number, label: string) {
        const cta = this.add
            .text(WIDTH / 2, y, label, { fontFamily: SANS, fontSize: '15px', fontStyle: '800', color: '#0a0a0b', backgroundColor: '#f2c200', padding: { x: 24, y: 14 } })
            .setOrigin(0.5);
        this.tweens.add({ targets: cta, scale: { from: 1, to: 1.06 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        return cta;
    }

    private waitForStart(onGo: () => void, delay: number) {
        let used = false;
        const go = () => {
            if (used) return;
            used = true;
            sfx.unlock();
            sfx.click();
            onGo();
        };
        this.time.delayedCall(delay, () => {
            this.input.once('pointerdown', go);
            this.input.keyboard?.once('keydown-SPACE', go);
            this.input.keyboard?.once('keydown-ENTER', go);
        });
    }

    private showReady() {
        const box = this.add.container(0, 0).setDepth(100);
        box.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.black, 0.78).setOrigin(0));
        box.add(this.add.text(WIDTH / 2, 110, this.title, { fontFamily: SERIF, fontSize: '50px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5));
        box.add(
            this.add
                .text(WIDTH / 2, 175, this.hint, { fontFamily: SANS, fontSize: '17px', color: '#d4d4d8', align: 'center', wordWrap: { width: 700 }, lineSpacing: 6 })
                .setOrigin(0.5, 0),
        );

        // Legenda: o que é cada coisa na tela.
        const items = this.legend.slice(0, 6);
        const gap = Math.min(150, (WIDTH - 120) / Math.max(1, items.length));
        items.forEach((item, i) => {
            const x = WIDTH / 2 - ((items.length - 1) * gap) / 2 + i * gap;
            const icon = this.add.image(x, 300, item.key).setScale(item.scale ?? 1);
            const label = this.add
                .text(x, 340, item.label, { fontFamily: SANS, fontSize: '13px', fontStyle: '700', color: '#a3a3ab', align: 'center', wordWrap: { width: gap - 10 } })
                .setOrigin(0.5, 0);
            box.add([icon, label]);
            this.tweens.add({ targets: icon, y: 292, duration: 900 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        });

        box.add(this.cta(450, 'TOQUE OU APERTE ESPAÇO PARA JOGAR'));
        box.setAlpha(0);
        this.tweens.add({ targets: box, alpha: 1, duration: 300 });
        this.overlay = box;
        this.waitForStart(() => {
            this.overlay?.destroy();
            this.countdown();
        }, 0);
    }

    private showOver(record: boolean) {
        const box = this.add.container(0, 0).setDepth(100);
        box.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.black, 0.85).setOrigin(0));
        box.add(
            this.add
                .text(WIDTH / 2, 80, record ? 'Novo recorde!' : 'Fim de jogo', { fontFamily: SERIF, fontSize: '44px', fontStyle: '700', color: record ? '#f2c200' : '#ffffff' })
                .setOrigin(0.5),
        );

        const scoreText = this.add.text(WIDTH / 2, 150, '0', { fontFamily: SERIF, fontSize: '64px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5);
        box.add([scoreText, this.add.text(WIDTH / 2, 196, 'PONTOS', { fontFamily: SANS, fontSize: '13px', fontStyle: '800', color: '#a3a3ab' }).setOrigin(0.5)]);
        const counter = { value: 0 };
        this.tweens.add({ targets: counter, value: this.score, duration: 900, ease: 'Cubic.Out', onUpdate: () => scoreText.setText(Math.round(counter.value).toLocaleString('pt-BR')) });

        // Medalha.
        const level = this.medals.reduce((acc, need, i) => (this.score >= need ? i : acc), -1);
        if (level >= 0) {
            const medal = MEDALS[level]!;
            const disc = this.add.circle(WIDTH / 2 - 120, 262, 22, medal.color);
            const ring = this.add.circle(WIDTH / 2 - 120, 262, 28).setStrokeStyle(3, medal.color);
            const label = this.add.text(WIDTH / 2 - 84, 262, `Medalha de ${medal.name}`, { fontFamily: SANS, fontSize: '20px', fontStyle: '800', color: hex(medal.color) }).setOrigin(0, 0.5);
            box.add([ring, disc, label]);
            this.tweens.add({ targets: [disc, ring], scale: { from: 0, to: 1 }, duration: 600, delay: 500, ease: 'Back.Out' });
            const next = this.medals[level + 1];
            if (next) box.add(this.add.text(WIDTH / 2, 298, `Próxima medalha: ${next.toLocaleString('pt-BR')} pontos`, { fontFamily: SANS, fontSize: '13px', color: '#a3a3ab' }).setOrigin(0.5));
        } else {
            box.add(this.add.text(WIDTH / 2, 268, `Bronze a partir de ${this.medals[0].toLocaleString('pt-BR')} pontos`, { fontFamily: SANS, fontSize: '15px', color: '#a3a3ab' }).setOrigin(0.5));
        }

        // Estatísticas da partida.
        const entries = Object.entries(this.stats).slice(0, 4);
        const colW = 190;
        entries.forEach(([name, value], i) => {
            const x = WIDTH / 2 - ((entries.length - 1) * colW) / 2 + i * colW;
            box.add([
                this.add.text(x, 340, value, { fontFamily: SANS, fontSize: '22px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5),
                this.add.text(x, 370, name.toUpperCase(), { fontFamily: SANS, fontSize: '11px', fontStyle: '800', color: '#a3a3ab' }).setOrigin(0.5),
            ]);
        });

        box.add(this.cta(450, 'TOQUE OU ESPAÇO PARA JOGAR DE NOVO'));
        box.setAlpha(0);
        this.tweens.add({ targets: box, alpha: 1, duration: 300 });
        this.overlay = box;
        this.waitForStart(() => {
            this.registry.set('autostart', true);
            this.scene.restart();
        }, 700);
    }
}

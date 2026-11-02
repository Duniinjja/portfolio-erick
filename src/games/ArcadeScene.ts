import Phaser from 'phaser';
import { isMuted, onMuteChange, sfx } from './sfx';

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

/** Tela do jogo, fina e clara: a identidade visual de todos os jogos do arcade. */
const INK = '#e8e6df';
const DIM = '#8d8c86';
const GOLD = '#f2c200';
const LIGHT = '200';
const THIN = '300';

const sharpened = new WeakSet<object>();

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

export interface Level {
    name: string;
    text: string;
}

/** Quanto cada dificuldade multiplica os pontos: o recorde continua justo. */
const LEVEL_BONUS = [1, 1.5, 2];

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
    /** Dificuldades oferecidas na tela inicial; vazio, o jogo não pergunta. */
    protected levels: Level[] = [];
    /** Dificuldade escolhida (índice em `levels`). Já vale dentro de `build`. */
    protected level = 0;
    /** Música de fundo do jogo (URL). */
    protected music = '';
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
    private audio: HTMLAudioElement | null = null;
    private stopUntil = 0;
    /** Quantos pixels reais há em cada unidade do jogo: o texto e a câmera acompanham. */
    protected view = 1;

    protected abstract build(): void;
    protected abstract start(): void;
    protected abstract step(time: number, delta: number): void;
    /** Chamado ao pausar e retomar, para o jogo congelar o que for dele. */
    protected onPause(_paused: boolean): void {}
    /** Espaço do jogo na tela final (gráfico da partida, por exemplo). */
    protected overExtra(_box: Phaser.GameObjects.Container): void {}

    create() {
        this.phase = 'ready';
        this.score = 0;
        this.elapsed = 0;
        this.stats = {};
        this.level = this.readLevel();
        this.view = (this.registry.get('view') as number) ?? 1;
        this.cameras.main.setZoom(this.view).centerOn(WIDTH / 2, HEIGHT / 2);
        this.sharpenText();
        this.makeBaseTextures();
        this.build();
        this.createHud();
        this.createLook();

        const togglePause = () => this.togglePause();
        this.game.events.on('arcade-toggle-pause', togglePause);
        if (this.pauseKey) this.input.keyboard?.on('keydown-P', togglePause);
        this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
        const offMute = onMuteChange((muted) => {
            if (this.audio) this.audio.muted = muted;
        });
        const leave = () => {
            this.game.events.off('arcade-toggle-pause', togglePause);
            this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
            offMute();
            this.stopTrack();
        };
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, leave);
        this.events.once(Phaser.Scenes.Events.DESTROY, leave);

        if (this.registry.get('autostart')) {
            this.registry.set('autostart', false);
            this.countdown();
        } else {
            this.showReady();
        }
    }

    update(_time: number, delta: number) {
        if (this.phase !== 'playing' || performance.now() < this.stopUntil) return;
        const dt = Math.min(delta, 50);
        this.elapsed += dt;
        this.step(this.elapsed, dt);
    }

    /** Todo texto criado no jogo já nasce na resolução real da tela. */
    private sharpenText() {
        const factory = this.add;
        if (sharpened.has(factory)) return;
        sharpened.add(factory);
        const make = factory.text.bind(factory);
        factory.text = (x, y, text, style) => make(x, y, text, style).setResolution(this.view);
    }

    private playTrack() {
        if (!this.music || this.audio) return;
        this.audio = new Audio(this.music);
        this.audio.loop = true;
        this.audio.volume = 0.42;
        this.audio.muted = isMuted();
        void this.audio.play().catch(() => {
            /* navegador sem permissão de áudio: o jogo segue mudo */
        });
    }

    private stopTrack() {
        this.audio?.pause();
        this.audio = null;
    }

    private readLevel() {
        try {
            return Number(localStorage.getItem(`arcade:${this.gameId}:nivel`)) || 0;
        } catch {
            return 0;
        }
    }

    private saveLevel() {
        try {
            localStorage.setItem(`arcade:${this.gameId}:nivel`, String(this.level));
        } catch {
            /* sem armazenamento: vale só nesta partida */
        }
    }

    /** Vinheta leve em todos os jogos (só com WebGL). */
    private createLook() {
        if (this.game.renderer.type !== Phaser.WEBGL) return;
        this.cameras.main.postFX.addVignette(0.5, 0.5, 0.98, 0.18);
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
        g.fillPoints([0.5, 1.55, 2.6, 3.65, 4.7, 5.75].map((a) => new Phaser.Geom.Point(10 + Math.cos(a) * 9, 10 + Math.sin(a) * 9)), true);
        g.generateTexture('ui-life', 20, 20);
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

    /** Onda de choque: um anel que abre e some. */
    protected ring(x: number, y: number, color: number, radius = 70, width = 4) {
        const shock = this.add.circle(x, y, radius).setStrokeStyle(width, color).setDepth(58).setScale(0.1);
        this.tweens.add({ targets: shock, scale: 1, alpha: 0, duration: 380, ease: 'Cubic.Out', onComplete: () => shock.destroy() });
    }

    /** Soco de câmera: aproxima um pouco e volta. */
    protected punch(zoom = 1.025) {
        const camera = this.cameras.main;
        this.tweens.add({ targets: camera, zoom: { from: this.view * zoom, to: this.view }, duration: 180, ease: 'Cubic.Out' });
    }

    /** Congela o jogo por um instante: é o que dá peso a uma explosão. */
    protected hitStop(ms: number) {
        this.stopUntil = performance.now() + ms;
    }

    protected popText(x: number, y: number, text: string, color = COLORS.yellow, size = 22) {
        const label = this.add
            .text(x, y, text, { fontFamily: SANS, fontSize: `${size}px`, fontStyle: '400', color: hex(color) })
            .setOrigin(0.5)
            .setDepth(70);
        this.tweens.add({ targets: label, y: y - 56, alpha: { from: 1, to: 0 }, scale: { from: 1.3, to: 1 }, duration: 800, ease: 'Cubic.Out', onComplete: () => label.destroy() });
    }

    protected addScore(points: number, x?: number, y?: number) {
        if (points > 0 && this.levels.length) points = Math.round(points * LEVEL_BONUS[this.level]!);
        this.score = Math.max(0, Math.round(this.score + points));
        this.scoreText.setText(`PONTOS ${String(this.score).padStart(6, '0')}`);
        if (x !== undefined && y !== undefined) {
            this.popText(x, y, points > 0 ? `+${points}` : `${points}`, points > 0 ? COLORS.yellow : COLORS.red);
        }
    }

    /** Aviso discreto à esquerda: nova fase, chefão, poder. */
    protected banner(title: string, sub = '', color = 0xe8e6df) {
        const box = this.add.container(64, HEIGHT / 2 - 70).setDepth(90).setAlpha(0);
        const big = this.add.text(0, 0, title.toUpperCase(), { fontFamily: SANS, fontSize: '34px', fontStyle: LIGHT, color: hex(color) });
        const line = this.add.rectangle(0, big.height + 8, big.width, 1, color).setOrigin(0);
        box.add([big, line]);
        if (sub) box.add(this.add.text(0, big.height + 20, sub, { fontFamily: SANS, fontSize: '15px', fontStyle: THIN, color: DIM }));
        this.tweens.chain({
            targets: box,
            tweens: [
                { alpha: 1, duration: 260 },
                { alpha: 1, duration: 1300 },
                { alpha: 0, duration: 500 },
            ],
            onComplete: () => box.destroy(),
        });
    }

    protected lifeRow(count: number, max: number) {
        const icons: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < max; i++) {
            icons.push(
                this.add
                    .image(WIDTH / 2 - ((max - 1) * 24) / 2 + i * 24, 30, 'ui-life')
                    .setDepth(80)
                    .setAlpha(i < count ? 0.9 : 0.12)
                    .setScale(0.7),
            );
        }
        return (value: number) =>
            icons.forEach((icon, i) => {
                const on = i < value;
                if ((icon.alpha > 0.5) !== on) this.tweens.add({ targets: icon, alpha: on ? 0.9 : 0.12, duration: 260 });
            });
    }

    /* ---------- Fluxo da partida ---------- */

    private createHud() {
        const style = { fontFamily: SANS, fontSize: '13px', fontStyle: '400', color: DIM };
        this.scoreText = this.add.text(24, 20, 'PONTOS 000000', style).setDepth(80);
        this.bestText = this.add
            .text(WIDTH - 24, 20, `RECORDE ${String(getBest(this.gameId)).padStart(6, '0')}`, style)
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
                    .text(WIDTH / 2, HEIGHT / 2, label, { fontFamily: SANS, fontSize: '96px', fontStyle: LIGHT, color: last ? GOLD : INK })
                    .setOrigin(0.5)
                    .setDepth(110);
                this.tweens.add({ targets: text, scale: { from: 1.15, to: 1 }, alpha: { from: 1, to: 0 }, duration: 540, ease: 'Cubic.Out', onComplete: () => text.destroy() });
                if (last) {
                    this.phase = 'playing';
                    this.playTrack();
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
            this.audio?.pause();
            this.onPause(true);
            this.pauseBox = this.add.container(0, 0).setDepth(120);
            this.pauseBox.add([
                this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.black, 0.76).setOrigin(0),
                this.add.text(WIDTH / 2, HEIGHT / 2 - 20, 'PAUSADO', { fontFamily: SANS, fontSize: '48px', fontStyle: LIGHT, color: INK }).setOrigin(0.5),
                this.add.text(WIDTH / 2, HEIGHT / 2 + 40, 'toque para continuar', { fontFamily: SANS, fontSize: '17px', fontStyle: THIN, color: GOLD }).setOrigin(0.5),
            ]);
            this.input.once('pointerdown', () => this.phase === 'paused' && this.togglePause());
        } else if (this.phase === 'paused') {
            this.pauseBox?.destroy();
            this.tweens.resumeAll();
            this.time.paused = false;
            this.physics?.world?.resume();
            void this.audio?.play().catch(() => {});
            this.onPause(false);
            this.phase = 'playing';
        }
    }

    protected endGame() {
        if (this.phase !== 'playing') return;
        this.phase = 'over';
        this.cameras.main.shake(320, 0.012);
        this.physics?.world?.pause();
        this.stopTrack();

        const best = getBest(this.gameId);
        const record = this.score > best && this.score > 0;
        if (record) {
            setBest(this.gameId, this.score);
            this.bestText.setText(`RECORDE ${String(this.score).padStart(6, '0')}`);
        }
        this.time.delayedCall(250, () => (record ? sfx.record() : sfx.gameOver()));
        this.game.events.emit('arcade-score', { id: this.gameId, score: this.score, best: Math.max(best, this.score) });
        this.time.delayedCall(700, () => this.showOver(record));
    }

    private cta(y: number, label: string) {
        const cta = this.add.text(WIDTH / 2, y, label, { fontFamily: SANS, fontSize: '24px', fontStyle: THIN, color: GOLD }).setOrigin(0.5);
        this.tweens.add({ targets: cta, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        return cta;
    }

    private waitForStart(onGo: () => void, delay: number) {
        let used = false;
        const go = () => {
            if (used) return;
            used = true;
            this.input.off('pointerdown', onPointer);
            sfx.unlock();
            sfx.click();
            onGo();
        };
        const onPointer = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
            if (!over.some((item) => item.getData('level') !== undefined)) go();
        };
        this.time.delayedCall(delay, () => {
            this.input.on('pointerdown', onPointer);
            this.input.keyboard?.once('keydown-SPACE', go);
            this.input.keyboard?.once('keydown-ENTER', go);
        });
    }

    /** Dificuldade em texto (clique ou teclas 1, 2 e 3). */
    private levelRow(box: Phaser.GameObjects.Container, y: number) {
        if (!this.levels.length) return;
        const gap = 150;
        const hint = this.add.text(WIDTH / 2, y + 30, '', { fontFamily: SANS, fontSize: '13px', fontStyle: THIN, color: DIM }).setOrigin(0.5);
        const items = this.levels.map((level, i) => {
            const x = WIDTH / 2 - ((this.levels.length - 1) * gap) / 2 + i * gap;
            const label = this.add.text(x, y, level.name.toLowerCase(), { fontFamily: SANS, fontSize: '19px', fontStyle: THIN, color: DIM, padding: { x: 14, y: 10 } }).setOrigin(0.5);
            label.setData('level', i).setInteractive({ useHandCursor: true });
            box.add(label);
            return label;
        });
        const select = (index: number) => {
            this.level = index;
            this.saveLevel();
            hint.setText(this.levels[index]!.text);
            items.forEach((label, i) => label.setColor(i === index ? INK : DIM).setAlpha(i === index ? 1 : 0.7));
        };
        items.forEach((label, i) =>
            label.on('pointerdown', () => {
                sfx.unlock();
                sfx.click();
                select(i);
            }),
        );
        const onKey = (event: KeyboardEvent) => {
            const index = Number(event.key) - 1;
            if (!box.active || !this.levels[index]) return;
            sfx.click();
            select(index);
        };
        this.input.keyboard?.on('keydown', onKey);
        box.once(Phaser.GameObjects.Events.DESTROY, () => this.input.keyboard?.off('keydown', onKey));
        box.add(hint);
        select(this.level);
    }

    private showReady() {
        const box = this.add.container(0, 0).setDepth(100);
        box.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.black, 0.74).setOrigin(0));
        box.add(this.add.text(WIDTH / 2, 66, 'ERICK ALVES', { fontFamily: SANS, fontSize: '15px', fontStyle: '400', color: INK }).setOrigin(0.5).setLetterSpacing(6));
        box.add(this.add.text(WIDTH / 2, 128, this.title.toUpperCase(), { fontFamily: SANS, fontSize: '68px', fontStyle: LIGHT, color: INK }).setOrigin(0.5));
        box.add(this.add.text(WIDTH / 2, 186, this.hint, { fontFamily: SANS, fontSize: '15px', fontStyle: THIN, color: DIM, align: 'center', wordWrap: { width: 680 }, lineSpacing: 5 }).setOrigin(0.5, 0));

        // Legenda: o que é cada coisa na tela.
        const items = this.legend.slice(0, 6);
        const gap = Math.min(140, (WIDTH - 120) / Math.max(1, items.length));
        items.forEach((item, i) => {
            const x = WIDTH / 2 - ((items.length - 1) * gap) / 2 + i * gap;
            const icon = this.add.image(x, 292, item.key).setScale(item.scale ?? 1);
            const label = this.add.text(x, 322, item.label, { fontFamily: SANS, fontSize: '12px', fontStyle: THIN, color: DIM, align: 'center', wordWrap: { width: gap - 12 } }).setOrigin(0.5, 0);
            box.add([icon, label]);
        });

        this.levelRow(box, 398);
        box.add(this.cta(486, 'novo jogo'));
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
        box.add(this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.black, 0.8).setOrigin(0));
        box.add(this.add.text(WIDTH / 2, 74, record ? 'NOVO RECORDE' : 'FIM DE JOGO', { fontFamily: SANS, fontSize: '40px', fontStyle: LIGHT, color: record ? GOLD : INK }).setOrigin(0.5));

        const scoreText = this.add.text(WIDTH / 2, 150, '0', { fontFamily: SANS, fontSize: '64px', fontStyle: LIGHT, color: INK }).setOrigin(0.5);
        box.add([scoreText, this.add.text(WIDTH / 2, 196, 'PONTOS', { fontFamily: SANS, fontSize: '12px', fontStyle: '400', color: DIM }).setOrigin(0.5)]);
        const counter = { value: 0 };
        this.tweens.add({ targets: counter, value: this.score, duration: 900, ease: 'Cubic.Out', onUpdate: () => scoreText.setText(Math.round(counter.value).toLocaleString('pt-BR')) });

        // Medalha.
        const level = this.medals.reduce((acc, need, i) => (this.score >= need ? i : acc), -1);
        if (level >= 0) {
            const medal = MEDALS[level]!;
            const label = this.add.text(WIDTH / 2, 240, `medalha de ${medal.name.toLowerCase()}`, { fontFamily: SANS, fontSize: '18px', fontStyle: THIN, color: hex(medal.color) }).setOrigin(0.5);
            box.add(label);
            const next = this.medals[level + 1];
            if (next) box.add(this.add.text(WIDTH / 2, 268, `próxima a partir de ${next.toLocaleString('pt-BR')} pontos`, { fontFamily: SANS, fontSize: '13px', fontStyle: THIN, color: DIM }).setOrigin(0.5));
        } else {
            box.add(this.add.text(WIDTH / 2, 252, `bronze a partir de ${this.medals[0].toLocaleString('pt-BR')} pontos`, { fontFamily: SANS, fontSize: '15px', fontStyle: THIN, color: DIM }).setOrigin(0.5));
        }

        // Estatísticas da partida.
        const entries = Object.entries(this.stats).slice(0, 4);
        const colW = 190;
        entries.forEach(([name, value], i) => {
            const x = WIDTH / 2 - ((entries.length - 1) * colW) / 2 + i * colW;
            box.add([
                this.add.text(x, 318, value, { fontFamily: SANS, fontSize: '22px', fontStyle: THIN, color: INK }).setOrigin(0.5),
                this.add.text(x, 344, name.toUpperCase(), { fontFamily: SANS, fontSize: '11px', fontStyle: '400', color: DIM }).setOrigin(0.5),
            ]);
        });

        this.overExtra(box);
        this.levelRow(box, 398);
        box.add(this.cta(486, 'jogar de novo'));
        box.setAlpha(0);
        this.tweens.add({ targets: box, alpha: 1, duration: 300 });
        this.overlay = box;
        this.waitForStart(() => {
            this.registry.set('autostart', true);
            this.scene.restart();
        }, 700);
    }
}

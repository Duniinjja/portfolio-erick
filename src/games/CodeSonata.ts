import Phaser from 'phaser';
import { ArcadeScene, COLORS, HEIGHT, SANS, SERIF, WIDTH } from './ArcadeScene';
import { playBass, playNote, playWrong, sfx } from './sfx';

/**
 * Sonata do Código: cada tecla certa toca a próxima nota da música.
 * As músicas são clássicos em domínio público, emendados em sequência.
 * Notas em MIDI (60 = dó central). O ritmo é o da digitação de quem joga.
 */
const SONGS = [
    {
        name: 'Ode à Alegria',
        composer: 'Beethoven',
        bass: [48, 55, 52, 55],
        notes: [
            64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62,
            64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60,
            62, 62, 64, 60, 62, 64, 65, 64, 60, 62, 64, 65, 64, 62, 60, 62, 55,
            64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60,
        ],
    },
    {
        name: 'Pequena Serenata Noturna',
        composer: 'Mozart',
        bass: [43, 50, 43, 50],
        notes: [
            67, 62, 67, 62, 67, 62, 67, 71, 74,
            72, 69, 72, 69, 72, 69, 66, 69, 62,
            67, 67, 71, 69, 67, 67, 66, 66, 69, 72, 66, 69, 67,
            67, 62, 67, 62, 67, 62, 67, 71, 74,
        ],
    },
    {
        name: 'Cânone em Ré',
        composer: 'Pachelbel',
        bass: [50, 45, 47, 42, 43, 38, 43, 45],
        notes: [
            78, 76, 74, 73, 71, 69, 71, 73,
            74, 73, 71, 69, 67, 66, 67, 64,
            62, 66, 69, 67, 66, 62, 66, 64, 62, 59, 62, 69, 67, 71, 69, 67,
            66, 62, 64, 73, 74, 78, 81, 69, 71, 67, 69, 66, 62, 74, 74,
        ],
    },
    {
        name: 'Für Elise',
        composer: 'Beethoven',
        bass: [45, 52, 40, 52],
        notes: [
            76, 75, 76, 75, 76, 71, 74, 72, 69,
            60, 64, 69, 71,
            64, 68, 71, 72,
            64, 76, 75, 76, 75, 76, 71, 74, 72, 69,
            60, 64, 69, 71,
            64, 72, 71, 69,
        ],
    },
    {
        name: 'Na Gruta do Rei da Montanha',
        composer: 'Grieg',
        bass: [47, 54, 47, 54],
        notes: [
            59, 61, 62, 64, 66, 62, 66, 65, 61, 65, 64, 60, 64,
            59, 61, 62, 64, 66, 62, 66, 71, 69, 66, 62, 66, 69,
            59, 61, 62, 64, 66, 62, 66, 65, 61, 65, 64, 60, 64,
            59, 61, 62, 64, 66, 62, 66, 71, 69, 66, 62, 66, 71,
        ],
    },
];

/** Linhas para digitar: código do dia a dia, sem aspas nem acentos (teclas mortas no ABNT2). */
const LINES = [
    'const lead = await crm.qualify(msg);',
    'if (lead.score > 0.8) funil.move(lead);',
    'export const saldo = receitas - despesas;',
    'await fila.add(contrato, { vendaId });',
    'io.to(tenant).emit(funil, card);',
    'const taxa = await bcb.serie(SELIC);',
    'for (const linha of planilha) dedupe(linha);',
    'return prisma.venda.update({ where, data });',
    'def calcular_caixa(entradas, saidas):',
    'return sum(entradas) - sum(saidas)',
    'SELECT empresa, SUM(valor) FROM vendas;',
    'git commit -m deploy-na-sexta',
    'docker compose up -d --build',
    'const parcelas = tabelaPrice(valor, taxa, 12);',
    'while (bugs.length) bugs.pop().fix();',
    'npm run build && npm run deploy',
    'const total = itens.reduce((a, b) => a + b, 0);',
    'grafana.alert(latencia > 300);',
];

const WHITE_KEYS = [55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
const BLACK_KEYS = [56, 58, 61, 63, 66, 68, 70, 73, 75, 78];
const LOW = 55;
const HIGH = 79;
const KEY_TOP = 408;
const FONT = 'Consolas, "Courier New", monospace';

export class CodeSonata extends ArcadeScene {
    readonly gameId = 'code-sonata';
    readonly title = 'Sonata do Código';
    readonly hint = 'Digite o código que aparece na tela: cada tecla certa toca a próxima nota da música. Erros desafinam e a plateia vai embora se você parar.';
    readonly medals: [number, number, number] = [2500, 7000, 14000];
    protected pauseKey = false;

    private lines: string[] = [];
    private lineIndex = 0;
    private typed = 0;
    private song = 0;
    private noteIndex = 0;
    private loop = 0;
    private crowd = 70;
    private streak = 0;
    private bestStreak = 0;
    private correct = 0;
    private wrong = 0;
    private songsPlayed = 0;
    private lastKeyAt = 0;
    private charWidth = 15;
    /** Prazo: posição (em caracteres) da faixa vermelha que avança pela linha. */
    private deadline = -6;
    /** Ritmo-alvo em caracteres por segundo; sobe com o tempo e a cada música. */
    private targetCps = 1.6;
    private nextBeat = 0;
    private beat = 0;
    private lateCount = 0;
    private lineX0 = 0;
    private deadlineBox!: Phaser.GameObjects.Rectangle;
    private deadlineEdge!: Phaser.GameObjects.Rectangle;
    private tempoText!: Phaser.GameObjects.Text;

    private typedText!: Phaser.GameObjects.Text;
    private restText!: Phaser.GameObjects.Text;
    private cursorChar!: Phaser.GameObjects.Text;
    private cursorBox!: Phaser.GameObjects.Rectangle;
    private prevText!: Phaser.GameObjects.Text;
    private nextTexts: Phaser.GameObjects.Text[] = [];
    private songText!: Phaser.GameObjects.Text;
    private crowdBar!: Phaser.GameObjects.Graphics;
    private crowdText!: Phaser.GameObjects.Text;
    private wpmText!: Phaser.GameObjects.Text;
    private staffNotes: Phaser.GameObjects.Container[] = [];
    private keys = new Map<number, Phaser.GameObjects.Rectangle>();
    private onType = (ch: string) => this.type(ch);

    constructor() {
        super('code-sonata');
    }

    protected build() {
        this.makeTextures();
        Object.assign(this, {
            lines: Phaser.Utils.Array.Shuffle([...LINES]),
            lineIndex: 0, typed: 0, song: 0, noteIndex: 0, loop: 0, crowd: 70, streak: 0, bestStreak: 0,
            correct: 0, wrong: 0, songsPlayed: 0, lastKeyAt: 0, staffNotes: [], nextTexts: [],
            deadline: -6, targetCps: 1.6, nextBeat: 0, beat: 0, lateCount: 0,
        });
        this.keys = new Map();

        this.legend = [
            { key: 'cs-key', label: 'Cada tecla certa toca uma nota' },
            { key: 'cs-note', label: 'A melodia se forma na partitura' },
            { key: 'cs-crowd', label: 'Não deixe a plateia ir embora' },
        ];

        this.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.dark).setOrigin(0);

        // Partitura: cinco linhas onde as notas tocadas vão aparecendo.
        const staff = this.add.graphics();
        staff.lineStyle(1, 0x3a3a42);
        for (let i = 0; i < 5; i++) staff.lineBetween(40, 104 + i * 13, WIDTH - 40, 104 + i * 13);
        this.add.text(46, 92, '𝄞', { fontFamily: SERIF, fontSize: '62px', color: '#4a4a52' });

        // Área do código.
        this.add.rectangle(40, 196, WIDTH - 80, 176, 0x101013).setOrigin(0);
        const style = { fontFamily: FONT, fontSize: '26px', color: '#f2c200' };
        const probe = this.add.text(0, 0, 'MMMMMMMMMM', style);
        this.charWidth = probe.width / 10;
        probe.destroy();
        this.prevText = this.add.text(WIDTH / 2, 218, '', { fontFamily: FONT, fontSize: '18px', color: '#4a4a52' }).setOrigin(0.5);
        this.deadlineBox = this.add.rectangle(0, 270, 0, 44, COLORS.red, 0.18).setOrigin(0, 0.5);
        this.deadlineEdge = this.add.rectangle(0, 270, 3, 50, COLORS.red).setOrigin(0.5);
        this.cursorBox = this.add.rectangle(0, 270, this.charWidth + 2, 38, COLORS.yellow).setOrigin(0, 0.5);
        this.typedText = this.add.text(0, 270, '', style).setOrigin(0, 0.5);
        this.cursorChar = this.add.text(0, 270, '', { ...style, color: '#0a0a0b' }).setOrigin(0, 0.5);
        this.restText = this.add.text(0, 270, '', { ...style, color: '#e4e4e7' }).setOrigin(0, 0.5);
        this.nextTexts = [
            this.add.text(WIDTH / 2, 322, '', { fontFamily: FONT, fontSize: '19px', color: '#6a6a72' }).setOrigin(0.5),
            this.add.text(WIDTH / 2, 352, '', { fontFamily: FONT, fontSize: '17px', color: '#45454d' }).setOrigin(0.5),
        ];
        this.tweens.add({ targets: this.cursorBox, alpha: 0.55, duration: 450, yoyo: true, repeat: -1 });

        // Piano.
        const keyW = WIDTH / WHITE_KEYS.length;
        WHITE_KEYS.forEach((midi, i) => {
            const key = this.add.rectangle(i * keyW + 1, KEY_TOP, keyW - 2, HEIGHT - KEY_TOP - 4, 0xe9e9ec).setOrigin(0);
            this.keys.set(midi, key);
        });
        BLACK_KEYS.forEach((midi) => {
            const left = WHITE_KEYS.indexOf(midi - 1);
            const key = this.add.rectangle((left + 1) * keyW - keyW * 0.3, KEY_TOP, keyW * 0.6, (HEIGHT - KEY_TOP) * 0.6, 0x1b1b1e).setOrigin(0);
            this.keys.set(midi, key);
        });

        // HUD próprio: plateia, música atual, velocidade.
        this.crowdBar = this.add.graphics().setDepth(80);
        this.crowdText = this.add.text(WIDTH / 2, 50, 'PLATEIA', { fontFamily: SANS, fontSize: '11px', fontStyle: '800', color: '#a3a3ab' }).setOrigin(0.5).setDepth(80);
        this.songText = this.add.text(WIDTH / 2, 176, '', { fontFamily: SERIF, fontSize: '16px', fontStyle: '700', color: '#f2c200' }).setOrigin(0.5);
        this.wpmText = this.add.text(24, 44, '', { fontFamily: SANS, fontSize: '13px', fontStyle: '800', color: '#a3a3ab' }).setDepth(80);
        this.tempoText = this.add.text(WIDTH - 24, 44, '', { fontFamily: SANS, fontSize: '13px', fontStyle: '800', color: '#ff8a80' }).setOrigin(1, 0).setDepth(80);
        this.drawCrowd();
        this.renderLine();
        this.songText.setText(`♪ ${SONGS[0]!.name} · ${SONGS[0]!.composer}`);

        // Entrada: a página manda cada caractere digitado (inclui o teclado do celular).
        // Se o campo de digitação não estiver em foco, o teclado físico também funciona.
        this.game.events.on('arcade-type', this.onType);
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if ((document.activeElement as HTMLElement | null)?.dataset.typing === 'true') return;
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) this.type(event.key);
        });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('arcade-type', this.onType));
    }

    private makeTextures() {
        if (this.textures.exists('cs-key')) return;
        const g = this.add.graphics();
        g.fillStyle(0xe9e9ec).fillRect(0, 0, 14, 48).fillRect(16, 0, 14, 48).fillRect(32, 0, 14, 48);
        g.fillStyle(0x1b1b1e).fillRect(10, 0, 9, 28);
        g.fillStyle(COLORS.yellow).fillRect(27, 0, 9, 28);
        g.generateTexture('cs-key', 46, 48);
        g.clear();
        g.fillStyle(COLORS.yellow).fillEllipse(14, 38, 22, 15);
        g.fillRect(22, 4, 4, 34);
        g.fillTriangle(26, 4, 40, 16, 26, 18);
        g.generateTexture('cs-note', 42, 48);
        g.clear();
        [8, 24, 40].forEach((x, i) => {
            g.fillStyle(i === 1 ? COLORS.yellow : 0x9a9aa3).fillCircle(x, 18, 7).fillRoundedRect(x - 9, 27, 18, 18, 6);
        });
        g.generateTexture('cs-crowd', 48, 48);
        g.destroy();
    }

    protected start() {
        this.lastKeyAt = this.elapsed;
        this.banner(SONGS[0]!.name, `${SONGS[0]!.composer} · comece a digitar`);
    }

    private get line() {
        return this.lines[this.lineIndex % this.lines.length]!;
    }

    private renderLine() {
        const line = this.line;
        const x0 = Math.round(WIDTH / 2 - (line.length * this.charWidth) / 2);
        this.lineX0 = x0;
        const done = line.slice(0, this.typed);
        const current = line[this.typed] ?? '';
        this.typedText.setText(done).setX(x0);
        this.cursorBox.setX(x0 + this.typed * this.charWidth - 1);
        this.cursorChar.setText(current === ' ' ? '·' : current).setX(x0 + this.typed * this.charWidth);
        this.restText.setText(line.slice(this.typed + 1)).setX(x0 + (this.typed + 1) * this.charWidth);
        this.nextTexts[0]!.setText(this.lines[(this.lineIndex + 1) % this.lines.length]!);
        this.nextTexts[1]!.setText(this.lines[(this.lineIndex + 2) % this.lines.length]!);
    }

    /* ---------- Digitação ---------- */

    private type(ch: string) {
        if (this.phase !== 'playing') return;
        const expected = this.line[this.typed];
        this.lastKeyAt = this.elapsed;

        if (ch !== expected) {
            this.wrong++;
            this.streak = 0;
            this.crowd = Math.max(0, this.crowd - 7);
            playWrong();
            this.cursorBox.setFillStyle(COLORS.red);
            this.time.delayedCall(140, () => this.cursorBox.setFillStyle(COLORS.yellow));
            this.tweens.add({ targets: [this.typedText, this.cursorChar, this.restText, this.cursorBox], x: '+=6', duration: 40, yoyo: true, repeat: 2 });
            if (this.crowd <= 0) this.finish();
            return;
        }

        this.correct++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.crowd = Math.min(100, this.crowd + 2.2);
        const mult = Math.min(4, 1 + Math.floor(this.streak / 25));
        this.addScore(10 * mult);
        if (this.streak > 0 && this.streak % 25 === 0) this.popText(WIDTH / 2, 240, `SEQUÊNCIA ${this.streak} · x${mult}`, COLORS.yellow, 18);

        if (ch !== ' ') this.playNext();
        this.typed++;
        if (this.typed >= this.line.length) this.nextLine();
        else this.renderLine();
    }

    private playNext() {
        const song = SONGS[this.song]!;
        let midi = song.notes[this.noteIndex]!;
        playNote(midi);
        while (midi < LOW) midi += 12;
        while (midi > HIGH) midi -= 12;
        this.lightKey(midi);
        this.drawStaffNote(midi);

        this.noteIndex++;
        if (this.noteIndex >= song.notes.length) this.nextSong();
    }

    private lightKey(midi: number) {
        const key = this.keys.get(midi);
        if (!key) return;
        const black = BLACK_KEYS.includes(midi);
        key.setFillStyle(COLORS.yellow);
        this.time.delayedCall(160, () => key.setFillStyle(black ? 0x1b1b1e : 0xe9e9ec));
        const note = this.add
            .text(key.x + key.width / 2, KEY_TOP - 6, Phaser.Utils.Array.GetRandom(['♪', '♫', '♩']), { fontFamily: SERIF, fontSize: '26px', color: '#f2c200' })
            .setOrigin(0.5, 1);
        this.tweens.add({
            targets: note,
            y: KEY_TOP - 70,
            x: note.x + Phaser.Math.Between(-24, 24),
            alpha: 0,
            angle: Phaser.Math.Between(-30, 30),
            duration: 900,
            ease: 'Cubic.Out',
            onComplete: () => note.destroy(),
        });
    }

    private drawStaffNote(midi: number) {
        // Desliza as notas anteriores para a esquerda e desenha a nova na altura certa.
        this.staffNotes.forEach((n) => (n.x -= 30));
        const old = this.staffNotes.filter((n) => n.x < 110);
        old.forEach((n) => n.destroy());
        this.staffNotes = this.staffNotes.filter((n) => n.x >= 110);
        this.staffNotes.forEach((n) => n.setAlpha(Math.min(1, (n.x - 110) / 200)));

        const y = 156 - (midi - LOW) * 3.4;
        const head = this.add.ellipse(0, 0, 15, 11, COLORS.yellow).setAngle(-20);
        const stem = this.add.rectangle(6, -16, 2, 30, COLORS.yellow).setOrigin(0.5, 0.5);
        const note = this.add.container(WIDTH - 70, y, [stem, head]);
        note.setScale(0);
        this.tweens.add({ targets: note, scale: 1, duration: 180, ease: 'Back.Out' });
        this.staffNotes.push(note);
    }

    private nextLine() {
        this.addScore(50, WIDTH / 2, 230);
        this.prevText.setText(this.line);
        this.lineIndex++;
        this.typed = 0;
        // Linha nova: o prazo recomeça 4 caracteres antes do início, para dar tempo de ler.
        this.deadline = -4;
        this.renderLine();
        this.tweens.add({ targets: [this.typedText, this.cursorChar, this.restText, this.cursorBox], y: { from: 300, to: 270 }, alpha: { from: 0, to: 1 }, duration: 220, ease: 'Cubic.Out' });
    }

    private nextSong() {
        const done = SONGS[this.song]!;
        this.songsPlayed++;
        this.noteIndex = 0;
        this.song++;
        this.addScore(300 * (this.loop + 1));
        sfx.levelUp();
        this.burst(WIDTH / 2, 140, COLORS.yellow, 24, 340);

        if (this.song >= SONGS.length) {
            this.song = 0;
            this.loop++;
            this.banner('Bis!', `A plateia pediu de novo · mais rápido agora`, COLORS.yellow);
        } else {
            const next = SONGS[this.song]!;
            this.banner(next.name, `${next.composer} · você terminou ${done.name}`);
        }
        const now = SONGS[this.song]!;
        this.songText.setText(`♪ ${now.name} · ${now.composer}`);
    }

    private finish() {
        this.updateStats();
        this.endGame();
    }

    private drawCrowd() {
        const ratio = this.crowd / 100;
        const color = ratio > 0.6 ? COLORS.green : ratio > 0.3 ? COLORS.yellow : COLORS.red;
        this.crowdBar.clear();
        this.crowdBar.fillStyle(0x000000, 0.6).fillRect(WIDTH / 2 - 120, 24, 240, 12);
        this.crowdBar.fillStyle(color).fillRect(WIDTH / 2 - 120, 24, 240 * ratio, 12);
    }

    private updateStats() {
        const minutes = Math.max(this.elapsed / 60000, 1 / 60);
        const total = this.correct + this.wrong;
        this.stats = {
            'Palavras por minuto': String(Math.round(this.correct / 5 / minutes)),
            Precisão: `${total ? Math.round((this.correct / total) * 100) : 0}%`,
            'Maior sequência': String(this.bestStreak),
            Músicas: String(this.songsPlayed),
        };
    }

    /* ---------- Quadro a quadro ---------- */

    protected step(time: number, delta: number) {
        const dt = delta / 1000;

        // Ritmo-alvo: começa em ~19 PPM e acelera com o tempo, a cada música e a cada bis.
        this.targetCps = Math.min(9, 1.6 + (time / 1000) * 0.012 + this.song * 0.18 + this.loop * 0.9);
        this.tempoText.setText(`RITMO ${Math.round(this.targetCps * 12)} PPM`);

        // Prazo: a faixa vermelha avança no ritmo-alvo; se alcançar o cursor, atrasou o deploy.
        this.deadline += this.targetCps * dt;
        if (this.deadline >= this.typed + 0.4) {
            this.lateCount++;
            this.streak = 0;
            this.crowd = Math.max(0, this.crowd - 14);
            this.deadline = this.typed - 5;
            playWrong();
            this.cameras.main.shake(180, 0.008);
            this.popText(this.lineX0 + this.typed * this.charWidth, 230, 'atrasou o deploy!', COLORS.red, 16);
        }
        const deadlineX = this.lineX0 + Phaser.Math.Clamp(this.deadline, 0, this.line.length) * this.charWidth;
        this.deadlineBox.setX(this.lineX0 - 6).setSize(Math.max(0, deadlineX - this.lineX0 + 6), 44);
        this.deadlineEdge.setX(deadlineX).setVisible(this.deadline > 0);
        this.deadlineBox.setVisible(this.deadline > 0);

        // Metrônomo: baixo da música atual marcando o compasso no ritmo-alvo.
        if (time >= this.nextBeat) {
            const bass = SONGS[this.song]!.bass;
            playBass(bass[this.beat % bass.length]!);
            this.beat++;
            this.nextBeat = time + (2 / this.targetCps) * 1000;
            this.tweens.add({ targets: this.deadlineEdge, scaleY: { from: 1.4, to: 1 }, duration: 160 });
        }

        // A plateia perde a paciência aos poucos; parado por mais de 2 s, perde mais rápido.
        const idle = time - this.lastKeyAt > 2000;
        if (time > 2500) this.crowd -= dt * (1.4 + this.song * 0.4 + this.loop * 1.2) * (idle ? 2.4 : 1);
        this.crowd = Math.max(0, this.crowd);
        this.drawCrowd();
        this.crowdText.setText(idle && this.crowd < 60 ? 'A PLATEIA ESTÁ IMPACIENTE…' : this.crowd > 85 ? 'PLATEIA DE PÉ!' : 'PLATEIA');
        this.crowdText.setColor(this.crowd > 85 ? '#f2c200' : idle ? '#ff8a80' : '#a3a3ab');

        const minutes = Math.max(time / 60000, 1 / 60);
        this.wpmText.setText(`${Math.round(this.correct / 5 / minutes)} PPM`);
        if (this.crowd <= 0) this.finish();
        else this.updateStats();
    }
}

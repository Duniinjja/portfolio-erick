import symbolUrl from '../assets/woltek-simbolo.webp';
import type { Vision } from './vision';
import { LazyMeter, MoodMeter, ReactionMeter, WaveMeter, toBlend, type MoodId, type ReactionId } from './readings';

export type { ReactionId };
export type LabMode = 'livre' | 'humor' | 'preguica';
/** Inteiro: a imagem toda da câmera, com faixas nas sobras. Preencher: cobre a tela e corta as bordas. */
export type LabFit = 'inteiro' | 'preencher';
/** Câmera: a imagem normal, que se estilhaça nos efeitos. Pontos: a retícula do site. */
export type LabFilter = 'camera' | 'pontos';

/** Gestos do MediaPipe que viram efeito. */
export type GestureId = 'Open_Palm' | 'Victory' | 'Closed_Fist' | 'Pointing_Up' | 'ILoveYou' | 'Thumb_Up' | 'Thumb_Down' | 'Jutsu';

export interface Reading {
    face: boolean;
    hands: number;
    mood: MoodId;
    moods: Record<MoodId, number>;
    lazy: number;
    coffees: number;
    yawns: number;
    naps: number;
    asleep: boolean;
}

export interface MirrorEvents {
    gesture: (id: GestureId) => void;
    lazy: (kind: 'bocejo' | 'cochilo') => void;
    reaction: (id: ReactionId) => void;
    reading: (reading: Reading) => void;
}

/* Cores dos pontos: do escuro ao claro, por humor. */
const PALETTES: Record<string, string[]> = {
    base: ['#5a4520', '#9a7a3a', '#d8b878', '#fbe9cb'],
    feliz: ['#6b4f00', '#b88a00', '#f2c200', '#fff1b8'],
    surpreso: ['#14475a', '#2a87a8', '#6fd3f0', '#d8f6ff'],
    bravo: ['#5a1414', '#a82a2a', '#f05a4a', '#ffd0c8'],
    triste: ['#1c2a5a', '#3a52a8', '#7c95f0', '#dbe3ff'],
    neutro: ['#5a4520', '#9a7a3a', '#d8b878', '#fbe9cb'],
    matrix: ['#0b3d1a', '#16803a', '#3ddc6e', '#c8ffd8'],
    sono: ['#2b2b30', '#4a4a52', '#7a7a84', '#b0b0ba'],
};

const CONFETTI = ['#f2c200', '#fbe9cb', '#ff5c5c', '#5eead4', '#7c95f0', '#ffffff'];
const CODE = 'const=>{}();[]if01deploygitpush<>/*';

/* Desenho no ar: quanto tempo o traço fica, quanto leva para sumir e a tolerância a falhas da detecção (ms). */
const INK_HOLD = 3000;
const INK_FADE = 1500;
const PEN_GRACE = 260;

type Point = { x: number; y: number };

/** Indicador esticado e os outros três dedos dobrados (comparando a distância de cada ponta e junta ao pulso). */
const isPointing = (lm: Point[]) => {
    const wrist = lm[0]!;
    const far = (tip: number, joint: number) =>
        Math.hypot(lm[tip]!.x - wrist.x, lm[tip]!.y - wrist.y) > Math.hypot(lm[joint]!.x - wrist.x, lm[joint]!.y - wrist.y) * 1.12;
    return far(8, 6) && !far(12, 10) && !far(16, 14) && !far(20, 18);
};

/**
 * Selo de jutsu: as duas mãos juntas na frente do corpo, dedos para cima (base dos dedos médios próximas e as
 * pontas dos indicadores acima dos pulsos).
 */
const isSeal = (hands: Point[][]) => {
    if (hands.length < 2) return false;
    const [a, b] = hands as [Point[], Point[]];
    const close = Math.hypot(a[9]!.x - b[9]!.x, a[9]!.y - b[9]!.y) < 0.16;
    const up = a[8]!.y < a[0]!.y && b[8]!.y < b[0]!.y;
    return close && up;
};

const JUTSU_TIME = 3600;

/** O símbolo da Woltek pintado de dourado: a tinta preta vira ouro (mais claro onde o desenho brilha). */
const goldLogo = (img: HTMLImageElement) => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, c.width, c.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3]! / 255;
        const lum = (d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114) / 255;
        const warm = Math.max(0, (d[i]! - d[i + 2]!) / 255);
        const ink = Math.min(1, a * (1 - lum) * 1.4 + a * warm);
        d[i] = 242 + warm * 13;
        d[i + 1] = 194 + warm * 40;
        d[i + 2] = 60 + warm * 80;
        d[i + 3] = ink * 255;
    }
    ctx.putImageData(image, 0, 0);
    return c;
};

/** Números pseudoaleatórios com semente: a casca do tronco não muda de um quadro para o outro. */
const seeded = (seed: number) => () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
};

/** Altura do topo cortado (elipse dos anéis) em relação à largura do tronco. */
const TRUNK_TILT = 0.1;

/** Tronco de árvore centrado na origem: casca com veios, nó, anéis no topo e um galho com folha. */
const drawTrunk = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => {
    const rnd = seeded(Math.floor(seed) + 1);
    const r = w / 2;
    const ry = w * TRUNK_TILT;
    const top = -h / 2;
    const bottom = h / 2;

    // Sombra no chão.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, bottom + ry * 0.6, r * 1.25, ry * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Corpo.
    const body = new Path2D();
    body.moveTo(-r, top);
    body.lineTo(-r, bottom);
    body.ellipse(0, bottom, r, ry, 0, Math.PI, 0, true);
    body.lineTo(r, top);
    body.closePath();
    const bark = ctx.createLinearGradient(-r, 0, r, 0);
    bark.addColorStop(0, '#2e1c0e');
    bark.addColorStop(0.22, '#6e4220');
    bark.addColorStop(0.5, '#9a6232');
    bark.addColorStop(0.78, '#6a401f');
    bark.addColorStop(1, '#24160a');
    ctx.fillStyle = bark;
    ctx.fill(body);

    // Veios da casca.
    ctx.save();
    ctx.clip(body);
    ctx.strokeStyle = 'rgba(28, 15, 6, 0.6)';
    ctx.lineCap = 'round';
    const lines = 10;
    for (let i = 0; i < lines; i++) {
        let x = -r + ((i + 0.5) / lines) * w + (rnd() - 0.5) * 8;
        ctx.lineWidth = 1.5 + rnd() * 2.5;
        ctx.beginPath();
        ctx.moveTo(x, top);
        for (let y = top; y <= bottom + ry; y += h / 10) {
            x += (rnd() - 0.5) * 7;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    // Nó na madeira, na lateral de baixo (longe da cara).
    const kx = (rnd() < 0.5 ? -1 : 1) * r * (0.45 + rnd() * 0.15);
    const ky = top + h * (0.66 + rnd() * 0.12);
    ctx.fillStyle = '#3a2410';
    ctx.beginPath();
    ctx.ellipse(kx, ky, r * 0.16, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a4c26';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(kx, ky, r * 0.24, r * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Galho com folha.
    ctx.save();
    const b = Math.min(w, 300); // o galho não cresce junto com um tronco largo
    ctx.translate(r * 0.85, top + Math.min(h * 0.28, b * 0.9));
    ctx.rotate(-0.7);
    ctx.fillStyle = '#6a401f';
    ctx.fillRect(0, -b * 0.06, b * 0.38, b * 0.12);
    ctx.fillStyle = '#5fae4a';
    ctx.beginPath();
    ctx.ellipse(b * 0.46, 0, b * 0.13, b * 0.07, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3d7a2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b * 0.35, 0);
    ctx.lineTo(b * 0.57, b * 0.03);
    ctx.stroke();
    ctx.restore();

    // Contorno do corpo (antes do topo, que cobre a linha reta de cima).
    ctx.strokeStyle = '#1e1208';
    ctx.lineWidth = 3;
    ctx.stroke(body);

    // Topo cortado com os anéis.
    ctx.fillStyle = '#e2b47e';
    ctx.beginPath();
    ctx.ellipse(0, top, r, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150, 95, 50, 0.85)';
    ctx.lineWidth = 1.5;
    for (let ring = 1; ring <= 4; ring++) {
        const f = ring / 5;
        ctx.beginPath();
        ctx.ellipse(0, top, r * f, ry * f, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
};

interface TrunkFace {
    eyeL: Point;
    eyeR: Point;
    mouth: Point;
    blinkL: number;
    blinkR: number;
    jaw: number;
    smile: number;
}

/** Cara do tronco: olhos e boca no lugar dos da pessoa, piscando, sorrindo e abrindo a boca junto com ela. */
const drawTrunkFace = (ctx: CanvasRenderingContext2D, f: TrunkFace) => {
    const d = Math.max(24, Math.hypot(f.eyeR.x - f.eyeL.x, f.eyeR.y - f.eyeL.y));
    const s = d * 0.34;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [eye, other, blink] of [
        [f.eyeL, f.eyeR, f.blinkL],
        [f.eyeR, f.eyeL, f.blinkR],
    ] as const) {
        // Lado do outro olho: as pupilas olham levemente para o centro.
        const side = other.x >= eye.x ? 1 : -1;
        const cx = eye.x;
        const cy = eye.y + s * 0.45;
        // Buraco na casca.
        ctx.fillStyle = '#2a170a';
        ctx.beginPath();
        ctx.ellipse(cx, cy, s * 1.22, s * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
        const open = Math.max(0, 1 - blink * 1.25);
        if (open < 0.18) {
            // Olho fechado, feliz.
            ctx.strokeStyle = '#f6ead6';
            ctx.lineWidth = s * 0.28;
            ctx.beginPath();
            ctx.arc(cx, cy + s * 0.25, s * 0.7, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#fbf6ec';
            ctx.beginPath();
            ctx.ellipse(cx, cy, s, s * 1.1 * open, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.clip();
            ctx.fillStyle = '#140b04';
            ctx.beginPath();
            ctx.arc(cx + side * s * 0.15, cy + s * 0.08, s * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx + side * s * 0.15 - s * 0.2, cy - s * 0.18, s * 0.17, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // Sobrancelha de casca, sobe quando a boca abre.
        ctx.strokeStyle = '#3a2410';
        ctx.lineWidth = s * 0.32;
        const lift = s * (1.55 + f.jaw * 0.5);
        ctx.beginPath();
        ctx.moveTo(cx - side * s * 0.9, cy - lift + s * 0.15);
        ctx.quadraticCurveTo(cx, cy - lift - s * 0.35, cx + side * s * 0.9, cy - lift + s * 0.05);
        ctx.stroke();
    }

    // Bochechas.
    const mx = f.mouth.x;
    const my = f.mouth.y + s * 0.3;
    const mw = d * (0.95 + f.smile * 0.35);
    ctx.fillStyle = 'rgba(240, 110, 90, 0.35)';
    for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(mx + side * mw * 0.78, my - s * 0.55, s * 0.6, s * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Boca: sorriso sempre; abre junto com a da pessoa.
    const curve = mw * (0.22 + f.smile * 0.3);
    const drop = mw * f.jaw * 0.75;
    ctx.beginPath();
    ctx.moveTo(mx - mw / 2, my);
    ctx.quadraticCurveTo(mx, my + curve * 0.35, mx + mw / 2, my);
    ctx.quadraticCurveTo(mx, my + curve + drop, mx - mw / 2, my);
    ctx.closePath();
    ctx.fillStyle = '#2a0f08';
    ctx.fill();
    if (drop + curve > mw * 0.3) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#e0626a';
        ctx.beginPath();
        ctx.ellipse(mx, my + curve * 0.6 + drop * 0.9, mw * 0.26, mw * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.strokeStyle = '#1e1208';
    ctx.lineWidth = s * 0.26;
    ctx.stroke();
};

const GESTURES: GestureId[] = ['Open_Palm', 'Victory', 'Closed_Fist', 'Pointing_Up', 'ILoveYou', 'Thumb_Up', 'Thumb_Down', 'Jutsu'];

interface Bit {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    size: number;
    color: string;
    rot: number;
    vr: number;
    kind: 'confete' | 'faisca' | 'emoji' | 'fumaca';
    /** Emoji desenhado (kind 'emoji') e a gravidade dele: positiva cai, negativa sobe. */
    char?: string;
    g?: number;
}

const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

/**
 * O espelho: desenha a câmera como uma retícula de pontos (como o retrato do topo do site), lê rosto e mãos a cada
 * quadro e aplica os efeitos dos gestos. A imagem nunca sai do navegador.
 */
/** Um pedaço do vídeo no efeito de estilhaçar: recorte da imagem, deslocamento e giro. */
interface Shard {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vr: number;
}

const SHATTER_OUT = 520; // ms voando para fora antes de começar a voltar
const SHATTER_TIME = 1900;

export class Mirror {
    mode: LabMode = 'livre';
    filter: LabFilter = 'camera';
    private fit: LabFit = 'inteiro';
    private rawAlpha = 1;

    private ctx: CanvasRenderingContext2D;
    private sample = document.createElement('canvas');
    private sampleCtx = this.sample.getContext('2d', { willReadFrequently: true })!;
    private width = 1;
    private height = 1;
    private ratio = 1;
    private cell = 9;
    private cols = 1;
    private rows = 1;
    private view = { x: 0, y: 0, w: 1, h: 1 };

    // Deslocamento de cada ponto (explosão com mola que traz de volta).
    private ox = new Float32Array(0);
    private oy = new Float32Array(0);
    private vx = new Float32Array(0);
    private vy = new Float32Array(0);
    private logoInk = new Float32Array(0);
    private logoImg: HTMLImageElement | null = null;

    private bits: Bit[] = [];
    private logoMix = 0;
    private logoUntil = 0;
    private matrixUntil = 0;
    private drops: number[] = [];
    // Desenho no ar: alvo vindo da mão, caneta suavizada e os traços com a hora de cada ponto.
    private penTarget: { x: number; y: number } | null = null;
    private pen: { x: number; y: number } | null = null;
    private penSeen = -Infinity;
    private strokes: { x: number; y: number; t: number }[][] = [];

    // Jutsu da substituição: o tronco aparece entre logStart e logUntil, onde a pessoa está.
    private logStart = 0;
    private logUntil = 0;
    private logSeed = 0;
    private logSpot: { x: number; y: number; w: number; h: number } | null = null;
    private stroke: { x: number; y: number; t: number }[] | null = null;
    private faceBox: { x: number; y: number; w: number; h: number } | null = null;

    // Estilhaçar (filtro Câmera): pedaços do vídeo voam e voltam ao lugar.
    private shards: Shard[] = [];
    private shatterStart = 0;
    private logoGold: HTMLCanvasElement | null = null;

    // Pontos do rosto na tela, para os efeitos das reações saírem do lugar certo.
    private facePts: { eyeL: Point; eyeR: Point; mouth: Point; top: Point } | null = null;
    private lastZ = 0;
    // Expressão suavizada, para a cara do tronco imitar a pessoa.
    private expr = { blinkL: 0, blinkR: 0, jaw: 0, smile: 0 };

    private moodMeter = new MoodMeter();
    private lazyMeter = new LazyMeter();
    private reactions = new ReactionMeter();
    private wave = new WaveMeter();
    private handCount = 0;
    private faceFound = false;

    private streak: { id: string; count: number } = { id: '', count: 0 };
    private cooldown = new Map<string, number>();
    private lastGestureAt = 0;

    private frame = 0;
    private tick = 0;
    private lastVideoTime = -1;
    private videoSize = '';
    private lastReading = 0;
    private running = false;
    private resize: ResizeObserver;
    private canvas: HTMLCanvasElement;
    private video: HTMLVideoElement;
    private vision: Vision;
    private on: MirrorEvents;

    constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement, vision: Vision, on: MirrorEvents) {
        this.canvas = canvas;
        this.video = video;
        this.vision = vision;
        this.on = on;
        this.ctx = canvas.getContext('2d')!;
        this.resize = new ResizeObserver(() => this.layout());
        this.resize.observe(canvas);
        loadImage(symbolUrl)
            .then((img) => {
                this.logoImg = img;
                this.buildLogo();
                this.logoGold = goldLogo(img);
            })
            .catch(() => {});
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.layout();
        const loop = () => {
            if (!this.running) return;
            this.frame = requestAnimationFrame(loop);
            this.step(performance.now());
        };
        loop();
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.frame);
        this.resize.disconnect();
    }

    /** Dispara um efeito como se o gesto tivesse sido feito (botões da legenda, para quem não quer gesticular). */
    trigger(id: GestureId) {
        this.fire(id, performance.now(), true);
    }

    /* ---------- Layout ---------- */

    private layout() {
        const rect = this.canvas.getBoundingClientRect();
        this.width = Math.max(1, rect.width);
        this.height = Math.max(1, rect.height);
        this.ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        this.canvas.width = Math.round(this.width * this.ratio);
        this.canvas.height = Math.round(this.height * this.ratio);

        this.cell = this.width < 640 ? 7 : 9;
        this.cols = Math.ceil(this.width / this.cell);
        this.rows = Math.ceil(this.height / this.cell);
        this.sample.width = this.cols;
        this.sample.height = this.rows;

        const n = this.cols * this.rows;
        this.ox = new Float32Array(n);
        this.oy = new Float32Array(n);
        this.vx = new Float32Array(n);
        this.vy = new Float32Array(n);
        this.drops = Array.from({ length: Math.ceil(this.width / 18) }, () => Math.random() * -this.height);
        this.fitVideo();
        this.buildLogo();
    }

    setFit(fit: LabFit) {
        this.fit = fit;
        this.fitVideo();
    }

    /** Onde a câmera fica na tela: inteira (como object-fit: contain) ou cobrindo tudo (cover). */
    private fitVideo() {
        const vw = this.video.videoWidth || 640;
        const vh = this.video.videoHeight || 480;
        const pick = this.fit === 'preencher' ? Math.max : Math.min;
        const scale = pick(this.width / vw, this.height / vh);
        const w = vw * scale;
        const h = vh * scale;
        this.view = { x: (this.width - w) / 2, y: (this.height - h) / 2, w, h };
    }

    /** Ponto do vídeo (0 a 1) para a tela, espelhado como um espelho de verdade. */
    private toScreen(nx: number, ny: number) {
        return { x: this.width - (this.view.x + nx * this.view.w), y: this.view.y + ny * this.view.h };
    }

    /** Símbolo da Woltek na mesma grade dos pontos, centralizado. */
    private buildLogo() {
        const img = this.logoImg;
        if (!img || this.cols < 2) return;
        const c = document.createElement('canvas');
        c.width = this.cols;
        c.height = this.rows;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        const w = this.cols * (this.width < 640 ? 0.86 : 0.5);
        const h = (w * img.height) / img.width;
        ctx.drawImage(img, (this.cols - w) / 2, (this.rows - h) / 2, w, h);
        const { data } = ctx.getImageData(0, 0, this.cols, this.rows);
        this.logoInk = new Float32Array(this.cols * this.rows);
        for (let i = 0; i < this.logoInk.length; i++) {
            const a = data[i * 4 + 3]! / 255;
            const lum = (data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114) / 255;
            this.logoInk[i] = Math.min(1, a * (1 - lum) * 1.4 + a * Math.max(0, (data[i * 4]! - data[i * 4 + 2]!) / 255));
        }
    }

    /* ---------- Quadro ---------- */

    private step(now: number) {
        const t = now / 1000;
        this.tick++;
        if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            // O celular pode trocar a resolução da câmera ao girar: refaz o recorte quando muda.
            const size = `${this.video.videoWidth}x${this.video.videoHeight}`;
            if (size !== this.videoSize) {
                this.videoSize = size;
                this.fitVideo();
            }
            this.detect(now, t);
        }
        this.draw(now, t);
        if (now - this.lastReading > 100) {
            this.lastReading = now;
            this.on.reading({
                face: this.faceFound,
                hands: this.handCount,
                mood: this.moodMeter.winner,
                moods: { ...this.moodMeter.values },
                lazy: this.lazyMeter.score,
                coffees: this.lazyMeter.coffees,
                yawns: this.lazyMeter.yawns,
                naps: this.lazyMeter.naps,
                asleep: this.reactions.asleep,
            });
        }
    }

    /** Rosto e mãos em quadros alternados: metade do trabalho por quadro, leitura ainda fluida. */
    private detect(now: number, t: number) {
        if (this.tick % 2 === 0) {
            const result = this.vision.face.detectForVideo(this.video, now);
            const landmarks = result.faceLandmarks[0];
            this.faceFound = Boolean(landmarks);
            if (landmarks) {
                let minX = 1;
                let minY = 1;
                let maxX = 0;
                let maxY = 0;
                for (const p of landmarks) {
                    minX = Math.min(minX, p.x);
                    maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y);
                    maxY = Math.max(maxY, p.y);
                }
                const a = this.toScreen(maxX, minY);
                const b = this.toScreen(minX, maxY);
                const box = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
                // Suaviza a moldura para ela seguir o rosto sem tremer.
                this.faceBox = this.faceBox
                    ? {
                          x: this.faceBox.x + (box.x - this.faceBox.x) * 0.35,
                          y: this.faceBox.y + (box.y - this.faceBox.y) * 0.35,
                          w: this.faceBox.w + (box.w - this.faceBox.w) * 0.35,
                          h: this.faceBox.h + (box.h - this.faceBox.h) * 0.35,
                      }
                    : box;
                const at = (i: number) => this.toScreen(landmarks[i]!.x, landmarks[i]!.y);
                // 386 e 159: pálpebras de cima (esquerda e direita da pessoa); 13: lábio; 10: testa.
                this.facePts = { eyeL: at(386), eyeR: at(159), mouth: at(13), top: at(10) };

                const blend = toBlend(result.faceBlendshapes[0]?.categories);
                const e = this.expr;
                const follow = (from: number, to: number) => from + (to - from) * 0.5;
                e.blinkL = follow(e.blinkL, blend.eyeBlinkLeft ?? 0);
                e.blinkR = follow(e.blinkR, blend.eyeBlinkRight ?? 0);
                e.jaw = follow(e.jaw, blend.jawOpen ?? 0);
                e.smile = follow(e.smile, ((blend.mouthSmileLeft ?? 0) + (blend.mouthSmileRight ?? 0)) / 2);
                this.moodMeter.update(blend);
                const event = this.lazyMeter.update(blend, t);
                if (event && this.mode === 'preguica') {
                    if (event === 'bocejo') this.pourEmoji('☕', 26);
                    this.on.lazy(event);
                }
                const reaction = this.reactions.update(blend, t);
                if (reaction) this.react(reaction, blend);
            } else {
                this.faceBox = null;
                this.facePts = null;
            }
            return;
        }

        const result = this.vision.hands.recognizeForVideo(this.video, now);
        this.handCount = result.landmarks.length;
        let best: { id: string; score: number } = { id: 'None', score: 0 };
        let pen: { x: number; y: number } | null = null;
        result.gestures.forEach((list, hand) => {
            const top = list[0];
            if (top && top.score > best.score) best = { id: top.categoryName, score: top.score };
            // Caneta: a primeira mão com o indicador apontando (pelo classificador ou pelo formato dos dedos).
            const landmarks = result.landmarks[hand];
            if (!pen && landmarks && (top?.categoryName === 'Pointing_Up' || isPointing(landmarks))) {
                pen = this.toScreen(landmarks[8]!.x, landmarks[8]!.y);
            }
        });
        if (pen) {
            this.penTarget = pen;
            this.penSeen = now;
        }

        // Tchau: pulso da mão aberta indo e voltando.
        const openHand = result.gestures.findIndex((list) => list[0]?.categoryName === 'Open_Palm');
        const wrist = openHand >= 0 ? result.landmarks[openHand]?.[0] : undefined;
        if (this.wave.update(wrist ? wrist.x : null, t) && wrist) {
            const p = this.toScreen(wrist.x, wrist.y);
            this.pourEmoji('👋', 10, p, -0.04);
            this.on.reaction('tchau');
        }

        // O gesto precisa se manter por alguns quadros para valer (evita disparo por engano).
        // O selo de jutsu (duas mãos) tem prioridade sobre o gesto de cada mão.
        const id = isSeal(result.landmarks) ? 'Jutsu' : best.score > 0.62 ? best.id : 'None';
        this.streak = id === this.streak.id ? { id, count: this.streak.count + 1 } : { id, count: 1 };
        if (!GESTURES.includes(id as GestureId)) return;
        // Mão aberta só explode parada (aberta e balançando é tchau), por isso espera um pouco mais.
        if (id === 'Open_Palm') {
            if (this.streak.count === 7 && this.wave.motion() < 0.05) this.fire('Open_Palm', now, false);
        } else if (this.streak.count === 4) {
            this.fire(id as GestureId, now, false);
        }
    }

    /** Efeito de cada reação do rosto, saindo do ponto certo (olho, boca, cabeça). */
    private react(id: ReactionId, blend: Record<string, number>) {
        const pts = this.facePts;
        if (pts) {
            if (id === 'piscadinha') {
                const eye = (blend.eyeBlinkLeft ?? 0) > (blend.eyeBlinkRight ?? 0) ? pts.eyeL : pts.eyeR;
                this.sparkle(eye, 26);
                this.pourEmoji('✨', 4, eye, -0.03);
            }
            if (id === 'sorriso') this.pourEmoji('💛', 12, pts.mouth, -0.05);
            if (id === 'beijo') {
                this.pourEmoji('💋', 3, pts.mouth, -0.04);
                this.pourEmoji('❤️', 9, pts.mouth, -0.05);
            }
            if (id === 'lingua') this.pourEmoji('😜', 8, pts.mouth, -0.05);
            if (id === 'susto') this.pourEmoji('😱', 6, pts.top, -0.06);
            if (id === 'acordou') this.pourEmoji('☀️', 6, pts.top, -0.05);
        }
        this.on.reaction(id);
    }

    private fire(id: GestureId, now: number, forced: boolean) {
        if (id === 'Pointing_Up') {
            if (forced) this.drawDemo(now);
            return;
        }
        if (!forced && (now - this.lastGestureAt < 1200 || now < (this.cooldown.get(id) ?? 0))) return;
        this.lastGestureAt = now;
        this.cooldown.set(id, now + 2600);

        // No filtro Câmera, explodir é estilhaçar o próprio vídeo; nos Pontos, espalhar os pontos.
        const camera = this.filter === 'camera';
        if (id === 'Open_Palm') {
            if (camera) this.shatter(now, 1);
            else this.explode(1);
        }
        if (id === 'Victory') this.pour('confete', 180);
        if (id === 'Closed_Fist') this.matrixUntil = now + 3200;
        if (id === 'ILoveYou') {
            if (camera) this.shatter(now, 0.7);
            else this.explode(0.6);
            this.logoUntil = now + 3600;
        }
        if (id === 'Thumb_Up') this.pour('confete', 60);
        if (id === 'Jutsu') {
            this.cooldown.set(id, now + JUTSU_TIME + 1500);
            this.puff();
            this.logStart = now + 220;
            this.logUntil = now + JUTSU_TIME;
            this.logSeed = Math.random() * 1000;
        }
        this.on.gesture(id);
    }

    /** Joga os pontos para fora do centro; a mola traz cada um de volta. */
    private explode(force: number) {
        const cx = this.cols / 2;
        const cy = this.rows / 2;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const i = y * this.cols + x;
                const dx = x - cx + (Math.random() - 0.5) * 6;
                const dy = y - cy + (Math.random() - 0.5) * 6;
                const len = Math.hypot(dx, dy) || 1;
                const speed = (40 + Math.random() * 70) * force;
                this.vx[i] = (dx / len) * speed;
                this.vy[i] = (dy / len) * speed;
            }
        }
    }

    /**
     * Quebra o vídeo em pedaços que voam girando para fora do centro e depois voltam, encaixando no lugar.
     * Os recortes são em coordenadas do vídeo; o desenho espelha tudo junto.
     */
    private shatter(now: number, force: number) {
        const vw = this.video.videoWidth || 640;
        const vh = this.video.videoHeight || 480;
        const cols = this.width < 640 ? 8 : 14;
        const rows = Math.max(4, Math.round((cols * vh) / vw));
        const sw = vw / cols;
        const sh = vh / rows;
        const scale = this.view.w / vw;
        this.shards = [];
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const dx = x + 0.5 - cols / 2 + (Math.random() - 0.5);
                const dy = y + 0.5 - rows / 2 + (Math.random() - 0.5);
                const len = Math.hypot(dx, dy) || 1;
                // Voam algumas centenas de pixels (a inércia de 0,94 por quadro soma ~16× a velocidade inicial).
                const speed = (5 + Math.random() * 13) * force * scale * (1 + len / cols);
                this.shards.push({
                    sx: x * sw,
                    sy: y * sh,
                    sw,
                    sh,
                    x: 0,
                    y: 0,
                    vx: (dx / len) * speed,
                    vy: (dy / len) * speed,
                    rot: 0,
                    vr: (Math.random() - 0.5) * 0.35 * force,
                });
            }
        }
        this.shatterStart = now;
    }

    /** Desenha os pedaços do vídeo: fase de voo (inércia) e fase de volta (mola até o lugar). */
    private drawShards(now: number) {
        const { ctx, view } = this;
        const elapsed = now - this.shatterStart;
        const back = elapsed > SHATTER_OUT;
        const scale = view.w / (this.video.videoWidth || 640);
        ctx.save();
        ctx.translate(this.width, 0);
        ctx.scale(-1, 1);
        for (const s of this.shards) {
            if (back) {
                s.vx = (s.vx - s.x * 0.09) * 0.78;
                s.vy = (s.vy - s.y * 0.09) * 0.78;
                s.rot *= 0.86;
                s.vr *= 0.6;
            } else {
                s.vx *= 0.94;
                s.vy *= 0.94;
            }
            s.x += s.vx;
            s.y += s.vy;
            s.rot += s.vr;

            const w = s.sw * scale;
            const h = s.sh * scale;
            const cx = view.x + s.sx * scale + w / 2 + s.x;
            const cy = view.y + s.sy * scale + h / 2 + s.y;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(s.rot);
            ctx.drawImage(this.video, s.sx, s.sy, s.sw, s.sh, -w / 2 - 0.5, -h / 2 - 0.5, w + 1, h + 1);
            // Borda dourada enquanto o pedaço está solto.
            const loose = Math.min(1, Math.hypot(s.x, s.y) / 30);
            if (loose > 0.05) {
                ctx.strokeStyle = `rgba(242, 194, 0, ${loose * 0.8})`;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-w / 2, -h / 2, w, h);
            }
            ctx.restore();
        }
        ctx.restore();
    }

    /** O símbolo da Woltek em dourado, com brilho, sobre o vídeo escurecido. */
    private drawLogoGold(now: number) {
        const logo = this.logoGold;
        if (!logo || this.logoMix < 0.01) return;
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = this.logoMix * 0.6;
        ctx.fillStyle = '#0a0a0b';
        ctx.fillRect(0, 0, this.width, this.height);
        const w = Math.min(this.width * (this.width < 640 ? 0.86 : 0.5), this.height * 1.1);
        const h = (w * logo.height) / logo.width;
        const grow = 0.85 + this.logoMix * 0.15;
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(grow, grow);
        ctx.globalAlpha = this.logoMix;
        ctx.shadowColor = 'rgba(242, 194, 0, 0.85)';
        ctx.shadowBlur = 24 + Math.sin(now / 180) * 10;
        ctx.drawImage(logo, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    /** Emojis que saem de um ponto (ou caem do alto, sem ponto) e sobem ou caem conforme a gravidade. */
    private pourEmoji(char: string, count: number, from?: Point, g = 0.05) {
        for (let n = 0; n < count; n++) {
            const rising = g < 0;
            this.bits.push({
                x: from ? from.x + (Math.random() - 0.5) * 40 : Math.random() * this.width,
                y: from ? from.y + (Math.random() - 0.5) * 20 : -40 - Math.random() * this.height * 0.6,
                vx: (Math.random() - 0.5) * (from ? 4 : 1.5),
                vy: rising ? -1.5 - Math.random() * 2.5 : 2 + Math.random() * 3,
                life: 0,
                max: from ? 90 + Math.random() * 40 : 400,
                size: (from ? 22 : 26) + Math.random() * 16,
                color: '',
                rot: Math.random() * Math.PI,
                vr: 0,
                kind: 'emoji',
                char,
                g,
            });
        }
    }

    /** Faíscas douradas espalhando a partir de um ponto. */
    private sparkle(at: Point, count: number) {
        for (let n = 0; n < count; n++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            this.bits.push({
                x: at.x,
                y: at.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0,
                max: 30 + Math.random() * 25,
                size: 1.5 + Math.random() * 2.5,
                color: Math.random() < 0.7 ? '#f2c200' : '#fff7d6',
                rot: 0,
                vr: 0,
                kind: 'faisca',
            });
        }
    }

    /**
     * Onde a pessoa está: do alto da cabeça até o pé da tela, na largura dos ombros (cerca de 3 rostos), para o
     * tronco cobrir o corpo inteiro. Sem rosto, o centro da tela.
     */
    private personSpot() {
        const box = this.faceBox;
        const bottom = this.height + 40;
        if (box) {
            const w = Math.min(box.w * 3.2, this.width * 0.96);
            // A borda de baixo dos anéis fica na testa, acima das sobrancelhas.
            const ry = w * TRUNK_TILT;
            const top = Math.max(ry + 6, box.y + box.h * 0.08 - ry);
            return { x: box.x + box.w / 2, y: (top + bottom) / 2, w, h: bottom - top };
        }
        const top = this.height * 0.14;
        return { x: this.width / 2, y: (top + bottom) / 2, w: Math.min(this.height * 0.6, this.width * 0.9), h: bottom - top };
    }

    /** Nuvem de fumaça do jutsu, em volta da pessoa. */
    private puff() {
        const spot = this.personSpot();
        for (let n = 0; n < 70; n++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 9;
            this.bits.push({
                x: spot.x + (Math.random() - 0.5) * spot.w * 0.8,
                y: spot.y + (Math.random() - 0.5) * spot.h * 0.7,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed * 0.7,
                life: 0,
                max: 26 + Math.random() * 18,
                size: spot.w * (0.16 + Math.random() * 0.2),
                color: ['#f4f4f2', '#dcdcd8', '#c4c4c0', '#ffffff'][n % 4]!,
                rot: 0,
                vr: 0,
                kind: 'fumaca',
            });
        }
    }

    /** O tronco do jutsu da substituição, no lugar da pessoa; outra nuvem quando acaba. */
    private drawLog(now: number) {
        if (!this.logUntil) return;
        if (now >= this.logUntil) {
            this.logUntil = 0;
            this.logSpot = null;
            this.puff();
            return;
        }
        if (now < this.logStart) return;

        // Segue a pessoa sem tremer.
        const target = this.personSpot();
        const s = this.logSpot;
        this.logSpot = s
            ? { x: s.x + (target.x - s.x) * 0.2, y: s.y + (target.y - s.y) * 0.2, w: s.w + (target.w - s.w) * 0.2, h: s.h + (target.h - s.h) * 0.2 }
            : target;
        const spot = this.logSpot;

        // Entra com um "pop" e balança de leve.
        const k = Math.min(1, (now - this.logStart) / 320);
        const pop = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
        const { ctx } = this;
        ctx.save();
        ctx.translate(spot.x, spot.y);
        ctx.rotate(Math.sin(now / 260) * 0.015);
        ctx.scale(pop, pop);
        drawTrunk(ctx, spot.w, spot.h, this.logSeed);

        // A cara fica onde está o rosto da pessoa; sem rosto, no alto do tronco.
        const pts = this.facePts;
        const local = (p: Point) => ({ x: p.x - spot.x, y: p.y - spot.y });
        const eyeY = -spot.h / 2 + spot.w * 0.42;
        const gap = spot.w * 0.15;
        const blink = now % 4200 < 130 ? 1 : 0; // pisca sozinho de vez em quando
        drawTrunkFace(ctx, {
            eyeL: pts ? local(pts.eyeL) : { x: -gap, y: eyeY },
            eyeR: pts ? local(pts.eyeR) : { x: gap, y: eyeY },
            mouth: pts ? local(pts.mouth) : { x: 0, y: eyeY + gap * 1.6 },
            blinkL: Math.max(this.expr.blinkL, blink),
            blinkR: Math.max(this.expr.blinkR, blink),
            jaw: pts ? this.expr.jaw : 0,
            smile: pts ? this.expr.smile : 0.4,
        });
        ctx.restore();
    }

    private pour(kind: 'confete', count: number) {
        for (let n = 0; n < count; n++) {
            this.bits.push({
                x: this.width / 2 + (Math.random() - 0.5) * 120,
                y: this.height * 0.55,
                vx: (Math.random() - 0.5) * 22,
                vy: -10 - Math.random() * 16,
                life: 0,
                max: 140 + Math.random() * 60,
                size: 6 + Math.random() * 7,
                color: CONFETTI[n % CONFETTI.length]!,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.4,
                kind,
            });
        }
    }

    /* ---------- Desenho ---------- */

    private palette(now: number) {
        if (now < this.matrixUntil) return PALETTES.matrix!;
        if (this.mode === 'humor' && this.faceFound) return PALETTES[this.moodMeter.winner]!;
        if (this.mode === 'preguica' && this.lazyMeter.score > 55) return PALETTES.sono!;
        return PALETTES.base!;
    }

    private draw(now: number, t: number) {
        const { ctx, cols, rows, cell } = this;
        ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
        ctx.fillStyle = '#0a0a0b';
        ctx.fillRect(0, 0, this.width, this.height);

        // Filtro "Câmera": o vídeo normal por cima dos pontos (a troca de filtro é um esmaecer suave).
        const rawTarget = this.filter === 'camera' ? 1 : 0;
        this.rawAlpha += (rawTarget - this.rawAlpha) * 0.08;
        const ready = this.video.readyState >= 2;

        // Câmera reduzida à grade, espelhada, no mesmo enquadramento da tela.
        let data: Uint8ClampedArray | null = null;
        if (ready && this.rawAlpha < 0.99) {
            const s = this.sampleCtx;
            s.setTransform(1, 0, 0, 1, 0, 0);
            s.fillStyle = '#000';
            s.fillRect(0, 0, cols, rows);
            s.setTransform(-1, 0, 0, 1, cols, 0);
            s.drawImage(this.video, this.view.x / cell, this.view.y / cell, this.view.w / cell, this.view.h / cell);
            data = s.getImageData(0, 0, cols, rows).data;
        }

        // Logo da Woltek: entra e sai suavemente.
        const logoTarget = now < this.logoUntil && this.logoInk.length === cols * rows ? 1 : 0;
        this.logoMix += (logoTarget - this.logoMix) * 0.06;
        const logo = this.logoMix > 0.01;

        // Na preguiça, a imagem vai apagando conforme a nota sobe.
        const dim = this.mode === 'preguica' ? 1 - Math.min(0.55, this.lazyMeter.score / 180) : 1;
        const colors = this.palette(now);
        const paths = colors.map(() => new Path2D());
        const half = cell / 2;
        const glitch = now < this.matrixUntil;

        for (let y = 0; y < rows && data; y++) {
            const rowShift = glitch && Math.random() < 0.04 ? (Math.random() - 0.5) * 60 : 0;
            for (let x = 0; x < cols; x++) {
                const i = y * cols + x;
                // Mola: cada ponto volta para o lugar.
                this.vx[i] = (this.vx[i]! - this.ox[i]! * 0.06) * 0.86;
                this.vy[i] = (this.vy[i]! - this.oy[i]! * 0.06) * 0.86;
                this.ox[i]! += this.vx[i]!;
                this.oy[i]! += this.vy[i]!;

                let lum = 0;
                if (data) {
                    const k = i * 4;
                    lum = (data[k]! * 0.299 + data[k + 1]! * 0.587 + data[k + 2]! * 0.114) / 255;
                    lum = Math.pow(lum, 0.9) * dim;
                }
                if (logo) lum = lum * (1 - this.logoMix * 0.85) + this.logoInk[i]! * this.logoMix;

                const r = half * Math.min(1, lum * 1.15);
                if (r < 0.35) continue;
                const px = x * cell + half + this.ox[i]! + rowShift;
                const py = y * cell + half + this.oy[i]!;
                const bucket = Math.min(colors.length - 1, Math.floor(lum * colors.length));
                paths[bucket]!.moveTo(px + r, py);
                paths[bucket]!.arc(px, py, r, 0, Math.PI * 2);
            }
        }
        paths.forEach((path, b) => {
            ctx.fillStyle = logo && b >= 2 ? '#f2c200' : colors[b]!;
            ctx.fill(path);
        });

        if (ready && this.rawAlpha > 0.01) {
            if (now - this.shatterStart < SHATTER_TIME) this.drawShards(now);
            else this.drawCamera(now);
            this.drawLogoGold(now);
        }

        if (glitch) this.drawRain();
        this.drawFaceBox(t);
        this.drawSleep(now);
        this.drawLog(now);
        this.drawInk(now);
        this.drawBits();
    }

    /** Dormindo: "Z" subindo do alto da cabeça, um a cada 0,7 s. */
    private drawSleep(now: number) {
        const top = this.facePts?.top;
        if (!this.reactions.asleep || !top || now - this.lastZ < 700) return;
        this.lastZ = now;
        const side = this.faceBox ? this.faceBox.w * 0.45 : 60;
        this.pourEmoji('💤', 1, { x: top.x + side, y: top.y }, -0.03);
    }

    /** O vídeo normal, espelhado, com a cor do momento: verde no modo hacker, humor, sono na preguiça. */
    private drawCamera(now: number) {
        const { ctx, view } = this;
        const filters: string[] = [];
        if (now < this.matrixUntil) filters.push('grayscale(1) sepia(1) hue-rotate(65deg) saturate(4) contrast(1.2)');
        if (this.mode === 'preguica') {
            const sleepy = Math.min(1, this.lazyMeter.score / 100);
            filters.push(`grayscale(${sleepy}) brightness(${1 - sleepy * 0.4})`);
        }
        ctx.save();
        ctx.globalAlpha = this.rawAlpha;
        ctx.filter = filters.join(' ') || 'none';
        ctx.translate(this.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.video, view.x, view.y, view.w, view.h);
        ctx.restore();

        // No humor, um véu leve na cor do humor (a mesma da paleta dos pontos).
        if (this.mode === 'humor' && this.faceFound && now >= this.matrixUntil) {
            ctx.save();
            ctx.globalAlpha = this.rawAlpha * 0.22;
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = PALETTES[this.moodMeter.winner]![2]!;
            ctx.fillRect(view.x, view.y, view.w, view.h);
            ctx.restore();
        }
    }

    /** Código caindo em colunas, no modo Matrix. */
    private drawRain() {
        const { ctx } = this;
        ctx.font = '600 14px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(61, 220, 110, 0.85)';
        this.drops.forEach((y, col) => {
            const ch = CODE[Math.floor(Math.random() * CODE.length)]!;
            ctx.fillText(ch, col * 18 + 4, y);
            this.drops[col] = y > this.height + Math.random() * 400 ? -20 : y + 16;
        });
    }

    /** Cantos de foco em volta do rosto nos modos de leitura, como uma câmera procurando o rosto. */
    private drawFaceBox(t: number) {
        const box = this.faceBox;
        if (!box || this.mode === 'livre') return;
        const { ctx } = this;
        const pad = 18;
        const x = box.x - pad;
        const y = box.y - pad * 1.6;
        const w = box.w + pad * 2;
        const h = box.h + pad * 2.6;
        const arm = Math.min(w, h) * 0.18;
        ctx.strokeStyle = `rgba(242, 194, 0, ${0.75 + Math.sin(t * 4) * 0.2})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (const [cx, cy, dx, dy] of [
            [x, y, 1, 1],
            [x + w, y, -1, 1],
            [x, y + h, 1, -1],
            [x + w, y + h, -1, -1],
        ] as const) {
            ctx.moveTo(cx + dx * arm, cy);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx, cy + dy * arm);
        }
        ctx.stroke();

        // Linha de varredura subindo e descendo dentro da moldura.
        const scan = y + ((Math.sin(t * 1.6) + 1) / 2) * h;
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, 'rgba(242,194,0,0)');
        grad.addColorStop(0.5, 'rgba(242,194,0,0.55)');
        grad.addColorStop(1, 'rgba(242,194,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, scan, w, 2);
    }

    /**
     * Desenho no ar com o indicador. A caneta segue a ponta do dedo suavizada; o traço continua enquanto o dedo
     * aparece (uma falha curta da detecção não corta a linha) e cada trecho fica na tela por INK_HOLD antes de sumir.
     */
    private drawInk(now: number) {
        const active = now - this.penSeen < PEN_GRACE && this.penTarget;
        if (active && this.penTarget) {
            this.pen = this.pen
                ? { x: this.pen.x + (this.penTarget.x - this.pen.x) * 0.45, y: this.pen.y + (this.penTarget.y - this.pen.y) * 0.45 }
                : { ...this.penTarget };
            if (!this.stroke) {
                this.stroke = [];
                this.strokes.push(this.stroke);
            }
            const last = this.stroke[this.stroke.length - 1];
            if (!last || Math.hypot(this.pen.x - last.x, this.pen.y - last.y) > 2) this.stroke.push({ ...this.pen, t: now });
        } else {
            this.stroke = null;
            this.pen = null;
        }

        // Some com os trechos antigos.
        const end = INK_HOLD + INK_FADE;
        this.strokes = this.strokes
            .map((s) => (s === this.stroke ? s : s.filter((p) => now - p.t < end)))
            .filter((s) => s.length > 0);
        if (this.stroke) {
            const kept = this.stroke.filter((p) => now - p.t < end);
            this.stroke.splice(0, this.stroke.length - kept.length);
        }

        // Trechos agrupados por transparência: o brilho (caro) é aplicado uma vez por grupo, não por trecho.
        const levels = Array.from({ length: 8 }, () => new Path2D());
        for (const s of this.strokes) {
            for (let i = 1; i < s.length; i++) {
                const a = s[i - 1]!;
                const b = s[i]!;
                if (b.t > now) break; // demonstração: o traço vai aparecendo
                const age = now - b.t;
                const alpha = age < INK_HOLD ? 1 : Math.max(0, 1 - (age - INK_HOLD) / INK_FADE);
                if (alpha <= 0) continue;
                // Meio do caminho entre os pontos: curva suave em vez de quinas.
                const prev = s[i - 2] ?? a;
                const path = levels[Math.min(7, Math.floor(alpha * 8))]!;
                path.moveTo((prev.x + a.x) / 2, (prev.y + a.y) / 2);
                path.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
            }
        }
        const { ctx } = this;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        levels.forEach((path, level) => {
            ctx.globalAlpha = (level + 1) / 8;
            ctx.shadowColor = 'rgba(242, 194, 0, 0.9)';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = '#f2c200';
            ctx.lineWidth = 7;
            ctx.stroke(path);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff7d6';
            ctx.lineWidth = 2.5;
            ctx.stroke(path);
        });
        ctx.restore();

        // Ponta da caneta: anel que pulsa e algumas faíscas.
        if (this.pen) {
            ctx.save();
            ctx.strokeStyle = '#f2c200';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.pen.x, this.pen.y, 11 + Math.sin(now / 120) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#fff7d6';
            ctx.beginPath();
            ctx.arc(this.pen.x, this.pen.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (Math.random() < 0.5) {
                this.bits.push({
                    x: this.pen.x,
                    y: this.pen.y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2 - 0.4,
                    life: 0,
                    max: 30 + Math.random() * 20,
                    size: 1.5 + Math.random() * 2,
                    color: Math.random() < 0.7 ? '#f2c200' : '#fff7d6',
                    rot: 0,
                    vr: 0,
                    kind: 'faisca',
                });
            }
        }
    }

    /** Botão "Dedo para cima" sem a mão: desenha um coração no centro, como demonstração. */
    private drawDemo(now: number) {
        const size = Math.min(this.width, this.height) * 0.018;
        const points: { x: number; y: number; t: number }[] = [];
        for (let i = 0; i <= 120; i++) {
            const a = (i / 120) * Math.PI * 2;
            const x = 16 * Math.sin(a) ** 3;
            const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
            points.push({ x: this.width / 2 + x * size, y: this.height / 2 - y * size, t: now + i * 8 });
        }
        this.strokes.push(points);
    }

    private drawBits() {
        const { ctx } = this;
        this.bits = this.bits.filter((b) => b.life < b.max && b.y < this.height + 80);
        if (this.bits.length > 2400) this.bits.splice(0, this.bits.length - 2400);
        for (const b of this.bits) {
            b.life++;
            b.x += b.vx;
            b.y += b.vy;
            b.rot += b.vr;
            const fade = 1 - b.life / b.max;
            if (b.kind === 'confete') {
                b.vy += 0.42;
                b.vx *= 0.985;
                ctx.save();
                ctx.globalAlpha = Math.min(1, fade * 2);
                ctx.translate(b.x, b.y);
                ctx.rotate(b.rot);
                ctx.scale(1, Math.cos(b.rot * 3));
                ctx.fillStyle = b.color;
                ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
                ctx.restore();
            } else if (b.kind === 'fumaca') {
                // Nuvem macia: centro claro que se desfaz na borda; cresce, freia e some.
                b.vx *= 0.9;
                b.vy = b.vy * 0.9 - 0.06;
                const grow = b.size * (1 + (b.life / b.max) * 1.6);
                const puff = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, grow);
                puff.addColorStop(0, b.color);
                puff.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.globalAlpha = Math.min(1, fade * 1.4) * 0.7;
                ctx.fillStyle = puff;
                ctx.beginPath();
                ctx.arc(b.x, b.y, grow, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (b.kind === 'emoji') {
                b.vy += b.g ?? 0.05;
                b.vx *= 0.97;
                ctx.save();
                ctx.globalAlpha = (b.g ?? 0) < 0 ? Math.min(1, fade * 2.5) : 1;
                ctx.translate(b.x, b.y);
                ctx.rotate(Math.sin(b.life * 0.05 + b.rot) * 0.4);
                ctx.font = `${b.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(b.char ?? '', 0, 0);
                ctx.restore();
            } else {
                ctx.globalAlpha = fade;
                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.size * fade, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    }

    /** Foto do espelho com a marca do portfólio no rodapé. */
    snapshot(caption: string): Promise<Blob | null> {
        const out = document.createElement('canvas');
        out.width = this.canvas.width;
        out.height = this.canvas.height;
        const ctx = out.getContext('2d')!;
        ctx.drawImage(this.canvas, 0, 0);
        const s = this.ratio;
        const bar = 64 * s;
        ctx.fillStyle = 'rgba(10, 10, 11, 0.82)';
        ctx.fillRect(0, out.height - bar, out.width, bar);
        ctx.fillStyle = '#f2c200';
        ctx.fillRect(0, out.height - bar, out.width, 3 * s);
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${20 * s}px "Libre Baskerville", serif`;
        ctx.fillText('Espelho do Dev', 22 * s, out.height - bar / 2);
        ctx.font = `500 ${14 * s}px Montserrat, sans-serif`;
        ctx.fillStyle = '#d8d8dc';
        const title = ctx.measureText('Espelho do Dev').width;
        ctx.fillText(caption, 22 * s + title + 28 * s, out.height - bar / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f2c200';
        ctx.fillText('portfolio.woltek.com.br', out.width - 22 * s, out.height - bar / 2);
        return new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.9));
    }
}

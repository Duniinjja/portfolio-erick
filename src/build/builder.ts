/**
 * Modo construção: o site se monta conforme é visto, de forma discreta. Cada elemento vira uma "camada" escondida
 * por clip-path (sem mexer no layout); ao entrar na tela, os blocos surgem de um esqueleto suave e o texto é digitado.
 * Sobre o esqueleto é digitado o código do próprio bloco, que então vira o conteúdo; quem desenha isso é um canvas.
 * Elementos que já ficaram para trás (rolagem rápida, link do menu) aparecem na hora.
 */

const SELECTOR = '[data-reveal], [data-split], [data-hero], .hero__name, .hero__socials, .hero__scroll, .card, .game';
const TEXT_TAGS = 'h1, h2, h3, h4, h5, p, span, a';

const MAX_RUNNING = 6;
const FADE_IN = 120;
const BLOCK_TIME = 950;
const CODE_LINE = 17;
const CODE_PAD = 12;
const SPACING = 70;
const SOFT_EDGE = 18; // largura, em %, da borda esfumada que revela os blocos

export type BuildStatus = 'construindo' | 'publicado';

export interface BuildProgress {
    done: number;
    total: number;
    status: BuildStatus;
}

interface Row {
    left: number;
    right: number;
    top: number;
    height: number;
}

interface Layer {
    el: HTMLElement;
    kind: 'text' | 'block';
    state: 'wait' | 'run' | 'done';
    visible: boolean;
    start: number;
    time: number;
    rows: Row[];
    code: string[];
    color: string;
    caret: { x: number; y: number; h: number } | null;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Onde o texto realmente está, linha por linha, relativo ao elemento (o cursor para na última letra). */
const rowsOf = (el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const origin = el.getBoundingClientRect();
    const rows: Row[] = [];
    for (const rect of range.getClientRects()) {
        if (!rect.width) continue;
        const left = rect.left - origin.left;
        const right = rect.right - origin.left;
        const top = rect.top - origin.top;
        const row = rows.find((item) => Math.abs(item.top + item.height / 2 - (top + rect.height / 2)) < rect.height / 2);
        if (row) {
            row.left = Math.min(row.left, left);
            row.right = Math.max(row.right, right);
        } else {
            rows.push({ left, right, top, height: rect.height });
        }
    }
    return rows.length ? rows : [{ left: 0, right: el.offsetWidth, top: 0, height: el.offsetHeight }];
};

const tagOf = (el: Element) => {
    const name = el.tagName.toLowerCase();
    const cls = el.classList[0];
    return cls ? `<${name} class="${cls}">` : `<${name}>`;
};

/** O código real do bloco: a tag, os primeiros filhos e o fechamento. */
const codeOf = (el: HTMLElement) => {
    const children = [...el.children].slice(0, 4).map((child) => `  ${tagOf(child)}`);
    const fits = Math.floor((el.offsetHeight - CODE_PAD) / CODE_LINE);
    if (fits < 3 || !children.length) return [tagOf(el)];
    const inner = children.slice(0, fits - 2);
    return [tagOf(el), ...inner, `</${el.tagName.toLowerCase()}>`];
};

export class SiteBuilder {
    private layers: Layer[] = [];
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private onProgress: (progress: BuildProgress) => void;
    private observer: IntersectionObserver;
    private width = 0;
    private height = 0;
    private frame = 0;
    private lastStart = 0;
    private done = 0;

    constructor(canvas: HTMLCanvasElement, onProgress: (progress: BuildProgress) => void) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.onProgress = onProgress;
        this.observer = new IntersectionObserver((entries) => this.onView(entries), { rootMargin: '0px 0px -6% 0px' });
    }

    start() {
        this.resize();
        window.addEventListener('resize', this.resize);

        document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
            el.style.opacity = '1';
            if (!el.offsetWidth) return;
            this.layers.push({
                el,
                kind: el.matches(TEXT_TAGS) ? 'text' : 'block',
                state: 'wait',
                visible: false,
                start: 0,
                time: 0,
                rows: [],
                code: [],
                color: '',
                caret: null,
            });
            el.style.clipPath = 'inset(100%)';
            this.observer.observe(el);
        });

        this.report();
        this.frame = requestAnimationFrame(this.tick);
    }

    /** Pula a construção: tudo aparece na hora. */
    skip() {
        for (const layer of this.layers) this.finish(layer);
    }

    stop() {
        cancelAnimationFrame(this.frame);
        this.observer.disconnect();
        window.removeEventListener('resize', this.resize);
    }

    private resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    private onView(entries: IntersectionObserverEntry[]) {
        for (const entry of entries) {
            const layer = this.layers.find((item) => item.el === entry.target);
            if (!layer) continue;
            layer.visible = entry.isIntersecting;
            // Já passou da tela: não faz sentido construir o que ninguém está vendo.
            if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0 && layer.state === 'wait') this.finish(layer);
        }
    }

    private finish(layer: Layer) {
        if (layer.state === 'done') return;
        layer.state = 'done';
        layer.caret = null;
        layer.el.style.clipPath = '';
        layer.el.style.maskImage = '';
        this.observer.unobserve(layer.el);
        this.done++;
        this.report();
    }

    private report() {
        const total = this.layers.length;
        this.onProgress({ done: this.done, total, status: this.done >= total ? 'publicado' : 'construindo' });
    }

    private begin(layer: Layer, now: number, speed: number) {
        layer.state = 'run';
        layer.start = now;
        if (layer.kind === 'text') {
            const style = getComputedStyle(layer.el);
            const large = parseFloat(style.fontSize) > 28; // título grande é digitado com calma
            const chars = (layer.el.textContent ?? '').length;
            layer.rows = rowsOf(layer.el);
            layer.color = style.color;
            layer.time = Math.min(1100, Math.max(large ? 700 : 320, chars * 13)) / speed;
        } else {
            layer.code = codeOf(layer.el);
            layer.time = BLOCK_TIME / speed;
        }
    }

    private schedule(now: number) {
        const running = this.layers.filter((layer) => layer.state === 'run').length;
        const waiting = this.layers.filter((layer) => layer.state === 'wait' && layer.visible);
        const speed = 1 + Math.min(3, waiting.length / 8); // fila grande: acelera para não travar quem rola depressa
        const next = waiting[0];
        if (next && running < MAX_RUNNING && now - this.lastStart >= SPACING / speed) {
            this.begin(next, now, speed);
            this.lastStart = now;
        }
    }

    /** Mostra o conteúdo real conforme o andamento da camada. */
    private advance(layer: Layer, now: number) {
        const { el } = layer;
        if (!el.isConnected) return this.finish(layer);
        const t = now - layer.start;
        const p = clamp01(t / layer.time);

        if (layer.kind === 'text') {
            // Linhas prontas inteiras; a linha atual avança até o cursor de texto.
            const { rows } = layer;
            const index = Math.min(rows.length - 1, Math.floor(p * rows.length));
            const row = rows[index]!;
            const x = row.left + (p * rows.length - index) * (row.right - row.left);
            const top = index ? row.top : 0;
            const bottom = rows[index + 1]?.top ?? el.offsetHeight;
            el.style.clipPath = `polygon(0 0, 100% 0, 100% ${top}px, ${x}px ${top}px, ${x}px ${bottom}px, 0 ${bottom}px)`;
            layer.caret = { x, y: row.top, h: row.height };
        } else {
            // Abre de cima para baixo com a borda esfumada.
            const open = clamp01((t - layer.time * 0.38) / (layer.time * 0.62));
            if (open > 0) {
                const edge = -SOFT_EDGE + easeOut(open) * (100 + SOFT_EDGE);
                el.style.clipPath = '';
                el.style.maskImage = `linear-gradient(to bottom, #000 ${edge}%, transparent ${edge + SOFT_EDGE}%)`;
            }
        }

        if (p >= 1) this.finish(layer);
    }

    /** Esqueleto dos blocos: um cinza suave, que serve em seção clara e escura, com um brilho passando. */
    private drawSkeleton(layer: Layer, box: DOMRect, now: number) {
        const { ctx } = this;
        const t = now - layer.start;
        const alpha = Math.min(clamp01(t / FADE_IN), 1 - clamp01((t - layer.time * 0.5) / (layer.time * 0.5)));
        const shine = box.left + box.width * ((t / layer.time) * 1.6 - 0.3);
        const gradient = ctx.createLinearGradient(shine - box.width * 0.3, 0, shine + box.width * 0.3, 0);
        gradient.addColorStop(0, 'rgba(128, 128, 128, 0.12)');
        gradient.addColorStop(0.5, 'rgba(128, 128, 128, 0.22)');
        gradient.addColorStop(1, 'rgba(128, 128, 128, 0.12)');
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(box.left, box.top, box.width, box.height, 6);
        ctx.fill();
        ctx.clip();
        this.drawCode(layer, box, clamp01(t / (layer.time * 0.46)));
        ctx.restore();
    }

    /** Digita o código do bloco até `p`, com o cursor de texto no fim do que já saiu. */
    private drawCode(layer: Layer, box: DOMRect, p: number) {
        const { ctx } = this;
        const total = layer.code.reduce((sum, line) => sum + line.length, 0);
        let left = Math.floor(p * total);
        let x = box.left + CODE_PAD;
        let y = box.top + CODE_PAD;
        ctx.font = '12px Consolas, Menlo, "Courier New", monospace';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(128, 128, 128, 0.95)';
        for (const line of layer.code) {
            const typed = line.slice(0, left);
            ctx.fillText(typed, box.left + CODE_PAD, y);
            x = box.left + CODE_PAD + ctx.measureText(typed).width;
            left -= typed.length;
            if (!left) break;
            y += CODE_LINE;
        }
        ctx.fillRect(x + 1, y, 1.5, 13);
    }

    private drawCaret(layer: Layer, box: DOMRect) {
        if (!layer.caret) return;
        const { ctx } = this;
        ctx.fillStyle = layer.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(box.left + layer.caret.x, box.top + layer.caret.y + 2, 1.5, layer.caret.h - 4);
        ctx.globalAlpha = 1;
    }

    private tick = (now: number) => {
        const { ctx } = this;
        ctx.clearRect(0, 0, this.width, this.height);
        this.schedule(now);

        for (const layer of this.layers) {
            if (layer.state !== 'run') continue;
            this.advance(layer, now);
            if ((layer.state as Layer['state']) === 'done') continue;

            const box = layer.el.getBoundingClientRect();
            if (layer.kind === 'block') this.drawSkeleton(layer, box, now);
            this.drawCaret(layer, box);
        }

        if (this.done < this.layers.length) this.frame = requestAnimationFrame(this.tick);
        else ctx.clearRect(0, 0, this.width, this.height);
    };
}

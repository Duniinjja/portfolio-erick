<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { animate, stagger } from 'animejs';
import Icon from '../Icon/Icon.vue';
import { onceVisible, reducedMotion } from '../../motion';
import { lazyLevel, moods, type MoodId } from '../../lab/readings';
import type { GestureId, LabFilter, LabFit, LabMode, Mirror, Reading, ReactionId } from '../../lab/mirror';
import type { Vision } from '../../lab/vision';

const gestures: { id: GestureId; emoji: string; name: string; effect: string; banner: string }[] = [
    { id: 'Open_Palm', emoji: '✋', name: 'Mão aberta', effect: 'Você se estilhaça e se remonta', banner: 'Boom! Refatoração total' },
    { id: 'Victory', emoji: '✌️', name: 'Paz', effect: 'Chuva de confete', banner: 'Deploy aprovado!' },
    { id: 'Closed_Fist', emoji: '✊', name: 'Punho', effect: 'Modo hacker com código caindo', banner: 'Modo hacker ativado' },
    { id: 'Pointing_Up', emoji: '☝️', name: 'Dedo para cima', effect: 'Desenha faíscas no ar', banner: 'Desenhe no ar' },
    { id: 'ILoveYou', emoji: '🤟', name: 'Rock', effect: 'O símbolo da Woltek se forma', banner: 'Feito com Woltek' },
    { id: 'Thumb_Up', emoji: '👍', name: 'Joinha', effect: 'Aprova o code review', banner: 'Code review aprovado' },
    { id: 'Thumb_Down', emoji: '👎', name: 'Polegar para baixo', effect: 'Pede alterações', banner: 'Pediram alterações' },
    { id: 'Jutsu', emoji: '🙏', name: 'Selo (mãos juntas)', effect: 'Jutsu: você vira um tronco', banner: 'Jutsu da substituição!' },
];

const modes: { id: LabMode; label: string; hint: string }[] = [
    { id: 'livre', label: 'Gestos', hint: 'Faça um gesto, dê tchau ou pisque' },
    { id: 'humor', label: 'Humor', hint: 'Faça caras: sorria, franza, abra a boca' },
    { id: 'preguica', label: 'Preguiça', hint: 'Boceje, feche os olhos, olhe para baixo' },
];

type Status = 'intro' | 'camera' | 'loading' | 'ready' | 'negado' | 'sem-camera' | 'ocupada' | 'sem-suporte' | 'falha';

const errors: Partial<Record<Status, { title: string; text: string; retry: boolean }>> = {
    negado: {
        title: 'A câmera foi bloqueada',
        text: 'Libere a câmera no cadeado ao lado do endereço do site e tente de novo.',
        retry: true,
    },
    'sem-camera': {
        title: 'Nenhuma câmera encontrada',
        text: 'Se a webcam é USB, confira se está conectada (ou troque de porta) e tente de novo. Também dá para abrir pelo celular.',
        retry: true,
    },
    ocupada: {
        title: 'A câmera está em uso',
        text: 'Feche outros programas que estejam usando a câmera (reunião, gravação) e tente de novo.',
        retry: true,
    },
    'sem-suporte': {
        title: 'Este navegador não dá acesso à câmera',
        text: 'Abra o site no Chrome, Edge, Safari ou Firefox atualizados.',
        retry: false,
    },
    falha: {
        title: 'Não deu para carregar a detecção',
        text: 'Os modelos de visão não baixaram. Verifique a conexão e tente de novo.',
        retry: true,
    },
};

/* Preferências da tela, lembradas neste navegador. */
const readPref = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    try {
        const value = localStorage.getItem(`lab:${key}`) as T | null;
        return value && allowed.includes(value) ? value : fallback;
    } catch {
        return fallback;
    }
};

const savePref = (key: string, value: string) => {
    try {
        localStorage.setItem(`lab:${key}`, value);
    } catch {
        /* sem armazenamento: vale só nesta visita */
    }
};

const fits: { id: LabFit; label: string }[] = [
    { id: 'inteiro', label: 'Inteiro' },
    { id: 'preencher', label: 'Preencher' },
];
const filters: { id: LabFilter; label: string }[] = [
    { id: 'camera', label: 'Câmera' },
    { id: 'pontos', label: 'Pontos' },
];

const fit = ref<LabFit>(readPref('fit', ['inteiro', 'preencher'], 'inteiro'));
// Chave nova ("filtro"): quem testou antes com Pontos também abre na câmera normal, o novo padrão.
const filter = ref<LabFilter>(readPref('filtro', ['camera', 'pontos'], 'camera'));
const settingsOpen = ref(false);

const setFit = (next: LabFit) => {
    fit.value = next;
    savePref('fit', next);
    mirror?.setFit(next);
};

const setFilter = (next: LabFilter) => {
    filter.value = next;
    savePref('filtro', next);
    if (mirror) mirror.filter = next;
};

const open = ref(false);
const status = ref<Status>('intro');
const mode = ref<LabMode>('livre');
const reading = ref<Reading | null>(null);
const approvals = ref(0);
const banner = ref<{ text: string; emoji: string; tone: 'ok' | 'bad' } | null>(null);
const toast = ref('');

const canvasEl = ref<HTMLCanvasElement | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const stageEl = ref<HTMLElement | null>(null);
const bannerEl = ref<HTMLElement | null>(null);
const flashEl = ref<HTMLElement | null>(null);
const dialogEl = ref<HTMLElement | null>(null);

let stream: MediaStream | null = null;
let mirror: Mirror | null = null;
let vision: Vision | null = null; // fica carregado entre aberturas: os modelos têm alguns MB
let opener: HTMLElement | null = null;
let toastTimer = 0;

const currentMood = computed(() => moods.find((m) => m.id === reading.value?.mood) ?? moods[4]);
const level = computed(() => lazyLevel(reading.value?.lazy ?? 0));
const lazyScore = computed(() => Math.round(reading.value?.lazy ?? 0));
const modeHint = computed(() => modes.find((m) => m.id === mode.value)?.hint ?? '');
const needsFace = computed(() => status.value === 'ready' && mode.value !== 'livre' && reading.value && !reading.value.face);
const error = computed(() => errors[status.value]);

/** Ponteiro do medidor de preguiça: de -90° (0) a 90° (100). */
const needle = computed(() => -90 + (lazyScore.value / 100) * 180);

const statusLine = computed(() => {
    const r = reading.value;
    if (status.value !== 'ready' || !r) return 'Tudo roda no seu navegador';
    const face = r.asleep ? 'Dormindo 💤' : r.face ? 'Rosto detectado' : 'Procurando rosto';
    const hands = r.hands ? ` · ${r.hands} ${r.hands === 1 ? 'mão' : 'mãos'}` : '';
    return face + hands;
});

const showToast = (text: string) => {
    toast.value = text;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.value = ''), 2400);
};

const showBanner = async (text: string, emoji: string, tone: 'ok' | 'bad' = 'ok') => {
    banner.value = { text, emoji, tone };
    await nextTick();
    const el = bannerEl.value;
    if (!el) return;
    animate(el, {
        opacity: [0, 1, 1, 0],
        scale: [0.6, 1.08, 1, 0.96],
        translateY: [30, 0, 0, -10],
        duration: 2200,
        ease: 'outExpo',
        onComplete: () => (banner.value = null),
    });
};

const shake = () => {
    if (!stageEl.value || reducedMotion()) return;
    animate(stageEl.value, { translateX: [0, -14, 12, -8, 6, 0], duration: 520, ease: 'inOutSine' });
};

const onGesture = (id: GestureId) => {
    const g = gestures.find((item) => item.id === id);
    if (!g) return;
    if (id === 'Thumb_Up') approvals.value++;
    if (id === 'Thumb_Down') shake();
    showBanner(g.banner, g.emoji, id === 'Thumb_Down' ? 'bad' : 'ok');
};

/** Reações do rosto e da mão: as grandes viram faixa, as pequenas um aviso rápido. */
const reactionText: Record<ReactionId, { text: string; emoji: string; big?: boolean }> = {
    dormindo: { text: 'Dormiu no código?', emoji: '😴', big: true },
    acordou: { text: 'Bom dia! O deploy esperou você', emoji: '☀️' },
    piscadinha: { text: 'Piscadinha detectada', emoji: '😉' },
    sorriso: { text: 'Que sorrisão! Build verde?', emoji: '😄' },
    beijo: { text: 'Mandou um beijo pro time', emoji: '😘' },
    susto: { text: 'Susto! Viu o log de produção?', emoji: '😱', big: true },
    lingua: { text: 'Língua de fora: modo zoeira', emoji: '😜' },
    tchau: { text: 'Tchau! Volte sempre', emoji: '👋', big: true },
};

const onReaction = (id: ReactionId) => {
    const r = reactionText[id];
    if (r.big) showBanner(r.text, r.emoji);
    else showToast(`${r.emoji} ${r.text}`);
    if (id === 'susto') shake();
};

const onLazy = (kind: 'bocejo' | 'cochilo') => {
    if (kind === 'bocejo') {
        showToast('Bocejo detectado: +1 café na conta');
    } else {
        shake();
        showBanner('Acorda!', '😴', 'bad');
    }
};

const triggerGesture = (id: GestureId) => mirror?.trigger(id);

const setMode = (next: LabMode) => {
    mode.value = next;
    if (mirror) mirror.mode = next;
};

/** Pede a câmera, carrega os modelos e liga o espelho. */
const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
        status.value = 'sem-suporte';
        return;
    }
    status.value = 'camera';
    try {
        stream = await navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false })
            // Algumas webcams recusam as preferências de tamanho: tenta de novo pedindo só "uma câmera".
            .catch((err: DOMException) => {
                if (err.name === 'NotAllowedError' || err.name === 'SecurityError') throw err;
                return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            });
    } catch (err) {
        const name = (err as DOMException).name;
        status.value =
            name === 'NotAllowedError' || name === 'SecurityError'
                ? 'negado'
                : name === 'NotFoundError' || name === 'OverconstrainedError'
                  ? 'sem-camera'
                  : 'ocupada';
        return;
    }
    if (!open.value) return stopStream();

    const video = videoEl.value!;
    video.srcObject = stream;
    await video.play().catch(() => {});

    status.value = 'loading';
    try {
        const [{ loadVision }, { Mirror }] = await Promise.all([import('../../lab/vision'), import('../../lab/mirror')]);
        vision ??= await loadVision();
        if (!open.value || !canvasEl.value) return;
        mirror = new Mirror(canvasEl.value, video, vision, {
            gesture: onGesture,
            lazy: onLazy,
            reaction: onReaction,
            reading: (r) => (reading.value = r),
        });
        mirror.mode = mode.value;
        mirror.filter = filter.value;
        mirror.setFit(fit.value);
        mirror.start();
        status.value = 'ready';
    } catch {
        status.value = 'falha';
    }
};

const stopStream = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
};

const openLab = async () => {
    opener = document.activeElement as HTMLElement;
    open.value = true;
    status.value = 'intro';
    reading.value = null;
    approvals.value = 0;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    await nextTick();
    dialogEl.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
};

const close = () => {
    mirror?.stop();
    mirror = null;
    stopStream();
    open.value = false;
    settingsOpen.value = false;
    banner.value = null;
    document.body.style.overflow = '';
    window.removeEventListener('keydown', onKey);
    opener?.focus();
};

/** Esc fecha (primeiro as configurações, depois o espelho); Tab circula só dentro da tela cheia. */
function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        if (settingsOpen.value) settingsOpen.value = false;
        else close();
        return;
    }
    if (event.key !== 'Tab' || !dialogEl.value) return;
    const items = [...dialogEl.value.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')].filter((el) => el.offsetParent);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

const snapshot = async () => {
    if (!mirror) return;
    const caption =
        mode.value === 'humor'
            ? `Humor: ${currentMood.value.label}`
            : mode.value === 'preguica'
              ? `Preguiça: ${lazyScore.value}% · ${level.value.label}`
              : 'Gestos que transformam';
    const blob = await mirror.snapshot(caption);
    if (!blob) return;
    if (flashEl.value) animate(flashEl.value, { opacity: [0.9, 0], duration: 600, ease: 'outQuad' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'espelho-do-dev.jpg';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast('Foto salva nos seus downloads');
};

/* ---------- Prévia animada da vitrine: um rosto de pontos que muda de humor ---------- */

const previewEl = ref<HTMLCanvasElement | null>(null);
const previewMood = ref<MoodId>('feliz');
let stopPreview = () => {};

const startPreview = () => {
    const canvas = previewEl.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const shape = document.createElement('canvas');
    const sctx = shape.getContext('2d', { willReadFrequently: true })!;
    const cell = 8;
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let frame = 0;
    let running = false;
    const cycle: MoodId[] = ['feliz', 'surpreso', 'neutro', 'bravo'];
    const colors: Record<string, string> = { feliz: '#f2c200', surpreso: '#6fd3f0', neutro: '#fbe9cb', bravo: '#f05a4a' };

    const size = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = w * ratio;
        canvas.height = h * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        cols = Math.ceil(w / cell);
        rows = Math.ceil(h / cell);
        shape.width = cols;
        shape.height = rows;
    };

    // Rosto desenhado à mão: cabeça, olhos e boca que muda com o humor.
    const drawFace = (mood: MoodId, t: number) => {
        sctx.clearRect(0, 0, cols, rows);
        const cx = cols / 2;
        const cy = rows / 2;
        const r = Math.min(cols, rows) * 0.36;
        const g = sctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#fff');
        g.addColorStop(1, '#555');
        sctx.fillStyle = g;
        sctx.beginPath();
        sctx.ellipse(cx, cy, r * 0.86, r, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.fillStyle = '#000';
        const blink = Math.sin(t * 1.3) > 0.97 ? 0.15 : 1;
        const eyeH = (mood === 'surpreso' ? r * 0.16 : r * 0.11) * blink;
        for (const side of [-1, 1]) {
            sctx.beginPath();
            sctx.ellipse(cx + side * r * 0.32, cy - r * 0.18, r * 0.1, eyeH, 0, 0, Math.PI * 2);
            sctx.fill();
            if (mood === 'bravo') {
                sctx.lineWidth = r * 0.07;
                sctx.beginPath();
                sctx.moveTo(cx + side * r * 0.5, cy - r * 0.42);
                sctx.lineTo(cx + side * r * 0.16, cy - r * 0.32);
                sctx.stroke();
            }
        }
        sctx.lineWidth = r * 0.08;
        sctx.lineCap = 'round';
        sctx.beginPath();
        if (mood === 'surpreso') {
            sctx.ellipse(cx, cy + r * 0.38, r * 0.14, r * 0.18, 0, 0, Math.PI * 2);
            sctx.fill();
        } else {
            const curve = mood === 'feliz' ? r * 0.3 : mood === 'bravo' ? -r * 0.2 : 0;
            sctx.moveTo(cx - r * 0.34, cy + r * 0.36);
            sctx.quadraticCurveTo(cx, cy + r * 0.36 + curve, cx + r * 0.34, cy + r * 0.36);
            sctx.stroke();
        }
    };

    const loop = (now: number) => {
        if (!running) return;
        frame = requestAnimationFrame(loop);
        const t = now / 1000;
        const mood = cycle[Math.floor(t / 2.6) % cycle.length]!;
        if (mood !== previewMood.value) previewMood.value = mood;
        drawFace(mood, t);
        const data = sctx.getImageData(0, 0, cols, rows).data;
        ctx.fillStyle = '#0a0a0b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = colors[mood]!;
        ctx.beginPath();
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const i = (y * cols + x) * 4;
                const lum = (data[i + 3]! / 255) * (data[i]! / 255);
                const wave = Math.sin(x * 0.35 + y * 0.2 - t * 3) * 0.12;
                const r = (cell / 2) * Math.min(1, lum + (lum > 0.05 ? wave : 0));
                if (r < 0.4) continue;
                const px = x * cell + cell / 2;
                const py = y * cell + cell / 2;
                ctx.moveTo(px + r, py);
                ctx.arc(px, py, r, 0, Math.PI * 2);
            }
        }
        ctx.fill();
    };

    size();
    const resize = new ResizeObserver(size);
    resize.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        if (visible && !running && !reducedMotion()) {
            running = true;
            frame = requestAnimationFrame(loop);
        } else if (!visible) {
            running = false;
            cancelAnimationFrame(frame);
        }
    });
    visibility.observe(canvas);
    if (reducedMotion()) loop(0);

    stopPreview = () => {
        running = false;
        cancelAnimationFrame(frame);
        resize.disconnect();
        visibility.disconnect();
    };
};

const previewLabel = computed(() => moods.find((m) => m.id === previewMood.value));
const showcase = ref<HTMLElement | null>(null);

onMounted(() => {
    startPreview();
    const el = showcase.value;
    if (!el || reducedMotion()) return;
    const chips = el.querySelectorAll<HTMLElement>('.lab__gesture');
    chips.forEach((chip) => (chip.style.opacity = '0'));
    onceVisible(el, () => {
        animate(chips, { opacity: [0, 1], translateY: [16, 0], scale: [0.9, 1], duration: 700, delay: stagger(70, { start: 200 }), ease: 'outBack(1.6)' });
    });
});

onBeforeUnmount(() => {
    stopPreview();
    if (open.value) close();
});
</script>

<template>
    <section id="lab" class="lab" aria-labelledby="lab-titulo">
        <div class="container lab__grid" data-reveal-group>
            <div class="lab__intro">
                <header class="section-head lab__head">
                    <span class="section-kicker" data-reveal>Lab</span>
                    <h2 id="lab-titulo" data-split>Espelho do Dev.</h2>
                    <p data-reveal>
                        Uma câmera que lê suas reações e gestos e responde com efeitos: você se estilhaça, vira tronco, desenha
                        no ar. Visão computacional rodando direto no seu navegador.
                    </p>
                </header>

                <ul ref="showcase" class="lab__gestures" aria-label="Gestos que o espelho reconhece">
                    <li v-for="g in gestures" :key="g.id" class="lab__gesture">
                        <span class="lab__emoji" aria-hidden="true">{{ g.emoji }}</span>
                        <span>{{ g.effect }}</span>
                    </li>
                </ul>

                <div class="lab__modes" data-reveal>
                    <p><strong>Medidor de humor:</strong> feliz, surpreso, bravo, triste ou concentrado, com a frase de dev para cada um.</p>
                    <p><strong>Medidor de preguiça:</strong> conta bocejos e cochilos e diz quantos cafés você precisa.</p>
                    <p><strong>Reações automáticas:</strong> percebe quando você dorme, pisca, sorri, manda beijo, leva susto, mostra a língua ou dá tchau.</p>
                </div>

                <div class="lab__actions" data-reveal>
                    <button class="btn btn--yellow" type="button" @click="openLab">Abrir o espelho</button>
                    <p class="lab__privacy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                            <rect x="5" y="10.5" width="14" height="10" rx="2" />
                            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                        </svg>
                        A imagem não sai do seu aparelho: nada é enviado nem gravado.
                    </p>
                </div>
            </div>

            <div class="lab__preview" data-reveal aria-hidden="true">
                <canvas ref="previewEl" class="lab__canvas"></canvas>
                <span class="lab__corner lab__corner--tl"></span>
                <span class="lab__corner lab__corner--tr"></span>
                <span class="lab__corner lab__corner--bl"></span>
                <span class="lab__corner lab__corner--br"></span>
                <span class="lab__chip">
                    <span>{{ previewLabel?.emoji }}</span> {{ previewLabel?.label }}
                </span>
                <span class="lab__rec"><i></i> AO VIVO</span>
            </div>
        </div>

        <Teleport to="body">
            <div v-if="open" ref="dialogEl" class="mirror" role="dialog" aria-modal="true" aria-label="Espelho do Dev">
                <header class="mirror__bar">
                    <div>
                        <strong>Espelho do Dev</strong>
                        <span aria-live="polite">{{ statusLine }}</span>
                    </div>
                    <div class="mirror__tools">
                        <button
                            v-if="status === 'ready'"
                            class="mirror__tool"
                            type="button"
                            aria-label="Configurações da imagem"
                            aria-controls="mirror-config"
                            :aria-expanded="settingsOpen"
                            @click="settingsOpen = !settingsOpen"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                                <path d="M4 7h10m4 0h2M4 17h2m4 0h10" />
                                <circle cx="16" cy="7" r="2.2" />
                                <circle cx="8" cy="17" r="2.2" />
                            </svg>
                        </button>
                        <button
                            v-if="status === 'ready'"
                            class="mirror__tool"
                            type="button"
                            aria-label="Tirar foto"
                            @click="snapshot"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
                                <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v11H4z" />
                                <circle cx="12" cy="13.5" r="3.6" />
                            </svg>
                        </button>
                        <button class="mirror__tool mirror__close" type="button" aria-label="Fechar o espelho" @click="close">
                            <Icon name="close" />
                        </button>
                    </div>
                </header>

                <div v-if="settingsOpen && status === 'ready'" id="mirror-config" class="mirror__config" role="group" aria-label="Configurações da imagem">
                    <div class="config__row">
                        <span id="config-filtro">Filtro</span>
                        <div class="config__switch" role="group" aria-labelledby="config-filtro">
                            <button
                                v-for="f in filters"
                                :key="f.id"
                                type="button"
                                :class="{ 'is-active': filter === f.id }"
                                :aria-pressed="filter === f.id"
                                @click="setFilter(f.id)"
                            >
                                {{ f.label }}
                            </button>
                        </div>
                    </div>
                    <div class="config__row">
                        <span id="config-enquadrar">Enquadramento</span>
                        <div class="config__switch" role="group" aria-labelledby="config-enquadrar">
                            <button
                                v-for="f in fits"
                                :key="f.id"
                                type="button"
                                :class="{ 'is-active': fit === f.id }"
                                :aria-pressed="fit === f.id"
                                @click="setFit(f.id)"
                            >
                                {{ f.label }}
                            </button>
                        </div>
                    </div>
                    <p class="config__note">
                        {{ fit === 'inteiro' ? 'Mostra a imagem toda da câmera, sem zoom.' : 'Cobre a tela; as bordas da câmera ficam de fora.' }}
                    </p>
                </div>

                <div ref="stageEl" class="mirror__stage" @pointerdown="settingsOpen = false">
                    <video ref="videoEl" class="mirror__video" playsinline muted></video>
                    <canvas ref="canvasEl" class="mirror__canvas"></canvas>
                    <span ref="flashEl" class="mirror__flash" aria-hidden="true"></span>

                    <!-- Antes da câmera: o que acontece e a promessa de privacidade. -->
                    <div v-if="status === 'intro'" class="mirror__panel">
                        <h3>Antes de ligar a câmera</h3>
                        <ul>
                            <li>A detecção roda no seu navegador. A imagem não é enviada nem gravada.</li>
                            <li>Na primeira vez, os modelos de visão (cerca de 12 MB) são baixados.</li>
                            <li>Fique num lugar iluminado, com o rosto e as mãos à vista.</li>
                        </ul>
                        <button class="btn btn--yellow" type="button" data-autofocus @click="start">Permitir a câmera</button>
                    </div>

                    <div v-else-if="status === 'camera' || status === 'loading'" class="mirror__panel mirror__panel--wait" role="status">
                        <span class="mirror__spinner" aria-hidden="true"></span>
                        <p>{{ status === 'camera' ? 'Aguardando a permissão da câmera…' : 'Carregando a detecção de rosto e mãos…' }}</p>
                    </div>

                    <div v-else-if="error" class="mirror__panel" role="alert">
                        <h3>{{ error.title }}</h3>
                        <p>{{ error.text }}</p>
                        <div class="mirror__panel-actions">
                            <button v-if="error.retry" class="btn btn--yellow" type="button" data-autofocus @click="start">Tentar de novo</button>
                            <button class="btn btn--outline-light" type="button" @click="close">Fechar</button>
                        </div>
                    </div>

                    <template v-if="status === 'ready'">
                        <p v-if="needsFace" class="mirror__hint mirror__hint--center">Mostre o rosto para a câmera</p>

                        <div v-if="banner" ref="bannerEl" :class="['mirror__banner', `mirror__banner--${banner.tone}`]" aria-live="assertive">
                            <span aria-hidden="true">{{ banner.emoji }}</span> {{ banner.text }}
                        </div>

                        <!-- Humor -->
                        <aside v-if="mode === 'humor'" class="mirror__card" aria-label="Medidor de humor">
                            <div class="mood__top">
                                <span class="mood__emoji" aria-hidden="true">{{ currentMood.emoji }}</span>
                                <div>
                                    <strong>{{ currentMood.label }}</strong>
                                    <p>{{ currentMood.quip }}</p>
                                </div>
                            </div>
                            <ul class="mood__bars">
                                <li v-for="m in moods" :key="m.id" :class="{ 'is-on': m.id === currentMood.id }">
                                    <span>{{ m.label }}</span>
                                    <span class="mood__track">
                                        <span class="mood__fill" :style="{ transform: `scaleX(${Math.min(1, reading?.moods[m.id] ?? 0)})` }"></span>
                                    </span>
                                </li>
                            </ul>
                        </aside>

                        <!-- Preguiça -->
                        <aside v-if="mode === 'preguica'" class="mirror__card" aria-label="Medidor de preguiça">
                            <div class="lazy__gauge">
                                <svg viewBox="0 0 200 112" aria-hidden="true">
                                    <path d="M16 100a84 84 0 0 1 168 0" fill="none" stroke="#2e2e33" stroke-width="14" stroke-linecap="round" />
                                    <path
                                        d="M16 100a84 84 0 0 1 168 0"
                                        fill="none"
                                        stroke="url(#lazy-grad)"
                                        stroke-width="14"
                                        stroke-linecap="round"
                                        pathLength="100"
                                        :stroke-dasharray="`${lazyScore} 200`"
                                        :stroke-opacity="lazyScore < 1 ? 0 : 1"
                                    />
                                    <defs>
                                        <linearGradient id="lazy-grad" x1="0" x2="1">
                                            <stop offset="0" stop-color="#3ddc6e" />
                                            <stop offset="0.5" stop-color="#f2c200" />
                                            <stop offset="1" stop-color="#f05a4a" />
                                        </linearGradient>
                                    </defs>
                                    <line x1="100" y1="100" x2="100" y2="34" stroke="#fff" stroke-width="3" stroke-linecap="round" :transform="`rotate(${needle} 100 100)`" />
                                    <circle cx="100" cy="100" r="6" fill="#fff" />
                                </svg>
                                <p class="lazy__score"><b>{{ lazyScore }}</b>%</p>
                            </div>
                            <strong class="lazy__level">{{ level.label }}</strong>
                            <p class="lazy__quip">{{ level.quip }}</p>
                            <dl class="lazy__stats">
                                <div><dt>Bocejos</dt><dd>{{ reading?.yawns ?? 0 }}</dd></div>
                                <div><dt>Cochilos</dt><dd>{{ reading?.naps ?? 0 }}</dd></div>
                                <div>
                                    <dt>Cafés</dt>
                                    <dd>{{ reading?.coffees ?? 0 }}</dd>
                                </div>
                            </dl>
                            <p class="lazy__note">Leitura dos últimos 15 segundos.</p>
                        </aside>

                        <!-- Gestos: legenda clicável (também serve para quem não quer gesticular) -->
                        <div v-if="mode === 'livre'" class="mirror__legend" aria-label="Gestos">
                            <button v-for="g in gestures" :key="g.id" class="mirror__gesture" type="button" :title="g.effect" @click="triggerGesture(g.id)">
                                <span aria-hidden="true">{{ g.emoji }}</span>
                                <span class="mirror__gesture-name">{{ g.name }}</span>
                            </button>
                        </div>
                        <p v-if="mode === 'livre' && approvals" class="mirror__approvals">
                            Reviews aprovados <b>{{ approvals }}</b>
                        </p>
                    </template>

                    <p v-if="toast" class="mirror__toast" role="status">{{ toast }}</p>
                </div>

                <nav v-if="status === 'ready'" class="mirror__modes" aria-label="Modo do espelho">
                    <button
                        v-for="m in modes"
                        :key="m.id"
                        type="button"
                        :class="['mirror__mode', { 'is-active': mode === m.id }]"
                        :aria-pressed="mode === m.id"
                        @click="setMode(m.id)"
                    >
                        {{ m.label }}
                    </button>
                    <span class="mirror__mode-hint">{{ modeHint }}</span>
                </nav>
            </div>
        </Teleport>
    </section>
</template>

<style scoped lang="scss">
.lab {
    padding-block: var(--section);
    background: var(--light);
    overflow: hidden;
}

.lab__grid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: clamp(36px, 6vw, 88px);
    align-items: center;
}

.lab__head {
    text-align: left;
    margin: 0 0 28px;

    &::after {
        margin: 28px 0 0;
    }
}

.lab__gestures {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.lab__gesture {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--white);
    border: 1px solid var(--line);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.35;
}

.lab__emoji {
    flex-shrink: 0;
    font-size: 22px;
}

.lab__modes {
    display: grid;
    gap: 8px;
    margin-top: 22px;
    color: var(--muted);
    font-size: 15px;

    strong {
        color: var(--text);
        font-weight: 600;
    }
}

.lab__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 22px;
    margin-top: 30px;
}

.lab__privacy {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 13px;

    svg {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        color: var(--gold-text);
    }
}

.lab__preview {
    position: relative;
    aspect-ratio: 4 / 5;
    max-height: 620px;
    width: 100%;
    background: #0a0a0b;
    box-shadow: 0 40px 80px -40px rgb(0 0 0 / 0.55);
}

.lab__canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.lab__corner {
    position: absolute;
    width: 34px;
    height: 34px;
    border: 3px solid var(--yellow);
    animation: lab-pulse 2.4s ease-in-out infinite;

    &--tl {
        top: 16%;
        left: 18%;
        border-right: 0;
        border-bottom: 0;
    }

    &--tr {
        top: 16%;
        right: 18%;
        border-left: 0;
        border-bottom: 0;
    }

    &--bl {
        bottom: 16%;
        left: 18%;
        border-right: 0;
        border-top: 0;
    }

    &--br {
        bottom: 16%;
        right: 18%;
        border-left: 0;
        border-top: 0;
    }
}

@keyframes lab-pulse {
    50% {
        opacity: 0.45;
        transform: scale(0.94);
    }
}

.lab__chip {
    position: absolute;
    left: 50%;
    bottom: 6%;
    translate: -50% 0;
    display: inline-flex;
    gap: 8px;
    padding: 8px 16px;
    background: var(--yellow);
    color: var(--black);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
}

.lab__rec {
    position: absolute;
    top: 16px;
    left: 16px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--white);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;

    i {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #f05a4a;
        animation: lab-pulse 1.2s ease-in-out infinite;
    }
}

/* ---------- Tela cheia do espelho ---------- */
.mirror {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    background: var(--black);
    color: var(--white);
}

.mirror__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px clamp(16px, 3vw, 32px);
    border-bottom: 1px solid var(--line-dark);

    strong {
        display: block;
        font-family: var(--serif);
        font-size: 20px;
    }

    span {
        color: var(--muted-dark);
        font-size: 13px;
    }
}

.mirror__tools {
    display: flex;
    gap: 4px;
}

.mirror__tool {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    color: var(--white);
    font-size: 24px;
    transition: color 0.2s, background-color 0.2s, transform 0.3s var(--ease-out);

    svg {
        width: 24px;
        height: 24px;
    }

    &:hover {
        color: var(--yellow);
        background: var(--dark-2);
    }
}

.mirror__close:hover {
    transform: rotate(90deg);
}

.mirror__config {
    position: absolute;
    top: 72px;
    right: clamp(16px, 3vw, 32px);
    z-index: 2;
    display: grid;
    gap: 14px;
    width: min(320px, calc(100% - 32px));
    padding: 18px;
    background: var(--dark-2);
    border-top: 3px solid var(--yellow);
    box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.8);
}

.config__row {
    display: grid;
    gap: 8px;

    > span {
        color: var(--muted-dark);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }
}

.config__switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border: 1px solid var(--line-dark);

    button {
        min-height: 44px;
        color: var(--muted-dark);
        font-size: 14px;
        font-weight: 600;
        transition: color 0.2s, background-color 0.2s;

        &:hover {
            color: var(--white);
        }

        &.is-active {
            background: var(--yellow);
            color: var(--black);
        }
    }
}

.config__note {
    color: var(--muted-dark);
    font-size: 13px;
}

.mirror__stage {
    position: relative;
    min-height: 0;
    overflow: hidden;
}

.mirror__video {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}

.mirror__canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.mirror__flash {
    position: absolute;
    inset: 0;
    background: var(--white);
    opacity: 0;
    pointer-events: none;
}

.mirror__panel {
    position: absolute;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: min(460px, calc(100% - 32px));
    padding: clamp(22px, 4vw, 34px);
    background: var(--dark-2);
    border-top: 3px solid var(--yellow);

    h3 {
        font-family: var(--serif);
        font-size: 22px;
        margin-bottom: 14px;
    }

    p,
    li {
        color: var(--muted-dark);
        font-size: 15px;
    }

    ul {
        display: grid;
        gap: 10px;
        margin: 0 0 24px;
        padding-left: 18px;
    }

    .btn {
        width: 100%;
    }

    &--wait {
        display: grid;
        justify-items: center;
        gap: 16px;
        text-align: center;
    }
}

.mirror__panel-actions {
    display: grid;
    gap: 10px;
    margin-top: 22px;
}

.mirror__spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--line-dark);
    border-top-color: var(--yellow);
    border-radius: 50%;
    animation: mirror-spin 0.9s linear infinite;
}

@keyframes mirror-spin {
    to {
        transform: rotate(1turn);
    }
}

.mirror__hint {
    position: absolute;
    left: 50%;
    translate: -50% 0;
    padding: 10px 18px;
    background: rgb(10 10 11 / 0.8);
    color: var(--yellow);
    font-weight: 600;
    white-space: nowrap;

    &--center {
        top: 50%;
    }
}

.mirror__banner {
    position: absolute;
    left: 50%;
    top: 12%;
    translate: -50% 0;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    max-width: calc(100% - 32px);
    padding: 14px 26px;
    background: var(--yellow);
    color: var(--black);
    font-family: var(--serif);
    font-size: clamp(20px, 3vw, 34px);
    font-weight: 700;
    box-shadow: 0 20px 50px -20px rgb(0 0 0 / 0.8);
    pointer-events: none;
    opacity: 0;

    &--bad {
        background: #f05a4a;
        color: var(--white);
    }
}

.mirror__card {
    position: absolute;
    top: 20px;
    right: 20px;
    width: min(330px, calc(100% - 32px));
    padding: 20px;
    background: rgb(17 17 19 / 0.88);
    border-top: 3px solid var(--yellow);
    backdrop-filter: blur(8px);
}

.mood__top {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;

    strong {
        font-family: var(--serif);
        font-size: 22px;
    }

    p {
        color: var(--muted-dark);
        font-size: 13px;
    }
}

.mood__emoji {
    font-size: 44px;
    line-height: 1;
}

.mood__bars {
    list-style: none;
    display: grid;
    gap: 9px;

    li {
        display: grid;
        grid-template-columns: 116px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        color: var(--muted-dark);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;

        &.is-on {
            color: var(--white);
        }
    }
}

.mood__track {
    height: 6px;
    background: var(--line-dark);
}

.mood__fill {
    display: block;
    height: 100%;
    background: var(--yellow);
    transform-origin: left;
    transition: transform 0.2s linear;
}

.lazy__gauge {
    position: relative;

    svg {
        display: block;
        width: 100%;

        line {
            transition: transform 0.3s var(--ease-out);
        }
    }
}

.lazy__score {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 24px;
    text-align: center;
    color: var(--muted-dark);
    font-size: 14px;

    b {
        color: var(--white);
        font-family: var(--serif);
        font-size: 30px;
        font-variant-numeric: tabular-nums;
    }
}

.lazy__level {
    display: block;
    margin-top: 6px;
    font-family: var(--serif);
    font-size: 22px;
    text-align: center;
}

.lazy__quip {
    color: var(--muted-dark);
    font-size: 13px;
    text-align: center;
}

.lazy__stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 16px;
    text-align: center;

    div {
        padding: 10px 4px;
        background: var(--dark-3);
    }

    dt {
        color: var(--muted-dark);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    dd {
        font-family: var(--serif);
        font-size: 22px;
        font-variant-numeric: tabular-nums;
    }
}

.lazy__note {
    margin-top: 10px;
    color: var(--muted-dark);
    font-size: 12px;
    text-align: center;
}

.mirror__legend {
    position: absolute;
    left: 50%;
    bottom: 18px;
    translate: -50% 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    width: max-content;
    max-width: calc(100% - 24px);
    padding: 4px;
}

.mirror__gesture {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 6px 14px;
    background: rgb(17 17 19 / 0.85);
    border: 1px solid var(--line-dark);
    color: var(--white);
    font-size: 13px;
    font-weight: 600;
    transition: border-color 0.2s, transform 0.2s;

    span:first-child {
        font-size: 20px;
    }

    &:hover {
        border-color: var(--yellow);
        transform: translateY(-2px);
    }
}

.mirror__approvals {
    position: absolute;
    top: 20px;
    left: 20px;
    padding: 8px 14px;
    background: rgb(17 17 19 / 0.85);
    color: var(--muted-dark);
    font-size: 13px;

    b {
        color: var(--yellow);
        font-family: var(--serif);
        font-size: 20px;
        font-variant-numeric: tabular-nums;
        margin-left: 6px;
    }
}

.mirror__toast {
    position: absolute;
    left: 50%;
    bottom: 84px;
    translate: -50% 0;
    padding: 10px 18px;
    background: var(--white);
    color: var(--black);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
}

.mirror__modes {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 18px;
    padding: 10px clamp(16px, 3vw, 32px);
    border-top: 1px solid var(--line-dark);
}

.mirror__mode {
    min-height: 44px;
    padding: 0 18px;
    color: var(--muted-dark);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border-bottom: 2px solid transparent;
    transition: color 0.2s, border-color 0.2s;

    &:hover {
        color: var(--white);
    }

    &.is-active {
        color: var(--yellow);
        border-bottom-color: var(--yellow);
    }
}

.mirror__mode-hint {
    margin-left: auto;
    color: var(--muted-dark);
    font-size: 13px;
}

@media (max-width: 960px) {
    .lab__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .lab__preview {
        order: -1;
        aspect-ratio: 4 / 3;
    }
}

@media (max-width: 640px) {
    .lab__gestures {
        grid-template-columns: minmax(0, 1fr);
    }

    .lab__actions .btn {
        width: 100%;
    }

    .mirror__card {
        top: auto;
        right: 50%;
        bottom: 12px;
        translate: 50% 0;
        padding: 14px 16px;
    }

    .mood__top {
        margin-bottom: 10px;
    }

    .mood__bars {
        display: none;
    }

    .lazy__gauge svg {
        max-width: 140px;
        margin-inline: auto;
    }

    .lazy__score {
        bottom: 12px;

        b {
            font-size: 24px;
        }
    }

    .lazy__quip {
        display: none;
    }

    .lazy__stats {
        margin-top: 10px;
    }

    .lazy__note {
        display: none;
    }

    .mirror__legend {
        flex-wrap: nowrap;
        justify-content: flex-start;
        left: 12px;
        right: 12px;
        width: auto;
        translate: none;
        overflow-x: auto;
        scrollbar-width: none;
    }

    .mirror__gesture-name {
        display: none;
    }

    .mirror__modes {
        justify-content: center;
    }

    .mirror__mode-hint {
        width: 100%;
        margin-left: 0;
        text-align: center;
    }
}

@media (prefers-reduced-motion: reduce) {
    .lab__corner,
    .lab__rec i,
    .mirror__spinner {
        animation: none;
    }
}
</style>

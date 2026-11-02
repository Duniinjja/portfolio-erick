<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { animate, stagger } from 'animejs';
import Icon from '../Icon/Icon.vue';
import kartUrl from '../../assets/games/kart-capa.webp';
import { onceVisible, reducedMotion } from '../../motion';
import type { GameController, GameId } from '../../games';

interface GameCard {
    id: GameId;
    name: string;
    genre: string;
    text: string;
    controls: string;
}

const games: GameCard[] = [
    {
        id: 'bug-hunt',
        name: 'Caça-Bugs',
        genre: 'Reflexo',
        text: 'Cinco tipos de bug, poderes como Hotfix e Code Review, três dificuldades e o chefão Bug de Produção a cada quatro sprints.',
        controls: 'Clique ou toque',
    },
    {
        id: 'kart-deploy',
        name: 'Kart Deploy',
        genre: 'Corrida infinita',
        text: 'Kart em 3D, pulo duplo, drones, escudo de CI, turbo e ímã de commits, com o cenário mudando de Dev até a Black Friday.',
        controls: 'Espaço, setas ou toque',
    },
    {
        id: 'python-infinito',
        name: 'Python Infinito',
        genre: 'Cobrinha sem fim',
        text: 'Um mapa que nunca acaba: coma commits, desvie de erros e cones, e cresça até não caber mais na tela.',
        controls: 'Setas, WASD ou deslizar',
    },
    {
        id: 'star-syntax',
        name: 'Sintaxe Estelar',
        genre: 'Nave de digitação',
        text: 'Naves descem com palavras e cada letra certa dispara um tiro. Bomba EMP, nave-mãe e trilha synthwave.',
        controls: 'Teclado',
    },
];

const typing = ref<HTMLInputElement | null>(null);

/** Onde o foco fica durante o jogo: o campo de digitação (jogo de teclado) ou o palco. */
const focusGame = () => (typing.value ?? stage.value)?.focus();

/** Cada caractere digitado no campo invisível vai para o jogo (inclui o teclado do celular). */
const onTyping = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if ((event as InputEvent).isComposing) return;
    for (const ch of input.value) controller?.type(ch);
    input.value = '';
};

const readBest = (id: string) => {
    try {
        return Number(localStorage.getItem(`arcade:${id}`)) || 0;
    } catch {
        return 0;
    }
};

const bests = ref<Record<string, number>>(Object.fromEntries(games.map((g) => [g.id, readBest(g.id)])));
const playing = ref<GameCard | null>(null);
const status = ref<'loading' | 'ready' | 'error'>('loading');
const stage = ref<HTMLElement | null>(null);
const grid = ref<HTMLElement | null>(null);
let controller: GameController | null = null;
let opener: HTMLElement | null = null;

const muted = ref(
    (() => {
        try {
            return localStorage.getItem('arcade:muted') === '1';
        } catch {
            return false;
        }
    })(),
);

const toggleMute = () => {
    muted.value = !muted.value;
    focusGame();
    if (controller) controller.setMuted(muted.value);
    else {
        try {
            localStorage.setItem('arcade:muted', muted.value ? '1' : '0');
        } catch {
            /* sem armazenamento */
        }
    }
};

const togglePause = () => {
    controller?.togglePause();
    focusGame();
};

const play = async (game: GameCard) => {
    opener = document.activeElement as HTMLElement;
    playing.value = game;
    status.value = 'loading';
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    await nextTick();
    // Foco no palco (ou no campo de digitação), não no botão Fechar: espaço inicia o jogo e não pode acionar um botão.
    focusGame();

    // No celular: tela cheia e paisagem quando o navegador permite (Android); no iPhone fica o aviso de girar.
    if (window.matchMedia('(pointer: coarse)').matches) {
        try {
            await document.documentElement.requestFullscreen?.();
            await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
        } catch {
            /* sem permissão: o jogo segue no modo atual */
        }
    }

    try {
        const { launchGame } = await import('../../games');
        await Promise.all(['200 40px Montserrat', '300 20px Montserrat'].map((font) => document.fonts.load(font)));
        if (!stage.value || playing.value?.id !== game.id) return;
        controller = launchGame(game.id, stage.value, (_score, best) => {
            bests.value = { ...bests.value, [game.id]: best };
        });
        controller.setMuted(muted.value);
        status.value = 'ready';
    } catch {
        status.value = 'error';
    }
};

const close = () => {
    controller?.destroy();
    controller = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    playing.value = null;
    document.body.style.overflow = '';
    window.removeEventListener('keydown', onKey);
    opener?.focus();
};

function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
}

onMounted(() => {
    if (!grid.value || reducedMotion()) return;
    const cards = grid.value.querySelectorAll<HTMLElement>('.game');
    cards.forEach((card) => (card.style.opacity = '0'));
    onceVisible(grid.value, () => {
        animate(cards, {
            opacity: [0, 1],
            translateY: [60, 0],
            rotateY: [-24, 0],
            duration: 1000,
            delay: stagger(140),
            ease: 'outExpo',
        });
    });
});

onBeforeUnmount(() => close());
</script>

<template>
    <section id="arcade" class="arcade" aria-labelledby="arcade-titulo">
        <div class="container">
            <header class="section-head section-head--dark" data-reveal-group>
                <span class="section-kicker" data-reveal>Arcade</span>
                <h2 id="arcade-titulo" data-split>Fez uma pausa? Jogue.</h2>
                <p data-reveal>Quatro jogos que fiz com Phaser e three.js, inspirados no meu dia a dia de desenvolvedor. Seu recorde fica salvo neste navegador.</p>
            </header>

            <ul ref="grid" class="games">
                <li v-for="game in games" :key="game.id" class="game">
                    <div :class="['cover', `cover--${game.id}`]" aria-hidden="true">
                        <template v-if="game.id === 'bug-hunt'">
                            <span v-for="n in 6" :key="n" class="cover__code" :style="{ width: `${40 + ((n * 37) % 45)}%` }"></span>
                            <svg class="cover__bug" viewBox="0 0 58 40"><g fill="none" stroke="#111" stroke-width="3"><path d="M14 10 8 0M22 10l-5-10M30 10l-4-10M14 30 8 40M22 30l-5 10M30 30l-4 10" /></g><ellipse cx="24" cy="20" rx="17" ry="12" fill="#ff5c5c" /><circle cx="44" cy="20" r="8" fill="#111" /></svg>
                            <svg class="cover__bug cover__bug--2" viewBox="0 0 58 40"><g fill="none" stroke="#111" stroke-width="3"><path d="M14 10 8 0M22 10l-5-10M30 10l-4-10M14 30 8 40M22 30l-5 10M30 30l-4 10" /></g><ellipse cx="24" cy="20" rx="17" ry="12" fill="#f2c200" /><circle cx="44" cy="20" r="8" fill="#111" /></svg>
                            <span class="cover__prod">Produção</span>
                        </template>
                        <template v-else-if="game.id === 'kart-deploy'">
                            <span class="cover__road"></span>
                            <span class="cover__block">500</span>
                            <span v-for="n in 3" :key="n" class="cover__coin" :style="{ '--n': n }"></span>
                            <img class="cover__kart" :src="kartUrl" alt="" width="112" height="63" loading="lazy" />
                        </template>
                        <template v-else-if="game.id === 'star-syntax'">
                            <span class="cover__planet"></span>
                            <span v-for="(word, n) in ['deploy', 'git', 'redis']" :key="word" class="cover__word" :style="{ '--n': n }">{{ word }}</span>
                            <svg class="cover__ship" viewBox="0 0 92 84"><path d="M46 0q12 26 16 46l28 20-4 10-28-8-6 12H40l-6-12-28 8-4-10 28-20q4-20 16-46z" fill="#a5b4fc" /><ellipse cx="46" cy="32" rx="8" ry="15" fill="#0369a1" /></svg>
                        </template>
                        <template v-else>
                            <svg class="cover__snake" viewBox="0 0 200 110" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 92h46V46h52v28h44V26" stroke="#3b78c9" stroke-width="16" /><path d="M14 92h46" stroke="#f2c200" stroke-width="16" /></svg>
                            <span class="cover__food"></span>
                        </template>
                    </div>

                    <div class="game__body">
                        <p class="game__genre">{{ game.genre }} · {{ game.controls }}</p>
                        <h3>{{ game.name }}</h3>
                        <p class="game__text">{{ game.text }}</p>
                        <div class="game__footer">
                            <span class="game__best">Seu recorde <b>{{ bests[game.id] ?? 0 }}</b></span>
                            <button class="btn btn--yellow" type="button" @click="play(game)">Jogar</button>
                        </div>
                    </div>
                </li>
            </ul>
        </div>

        <Teleport to="body">
            <div v-if="playing" class="player" role="dialog" aria-modal="true" :aria-label="`Jogando ${playing.name}`">
                <header class="player__bar">
                    <div>
                        <strong>{{ playing.name }}</strong>
                        <span>
                            Recorde {{ (bests[playing.id] ?? 0).toLocaleString('pt-BR') }} ·
                            {{ playing.id === 'star-syntax' ? 'botão de pausa' : 'P pausa' }} · Esc sai
                        </span>
                    </div>
                    <div class="player__tools">
                        <button class="player__tool" type="button" :aria-label="muted ? 'Ligar o som' : 'Desligar o som'" :aria-pressed="!muted" @click="toggleMute">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
                                <path v-if="!muted" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
                                <path v-else d="m16 9.5 5 5m0-5-5 5" />
                            </svg>
                        </button>
                        <button class="player__tool" type="button" aria-label="Pausar ou continuar" @click="togglePause">
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1" /><rect x="13.5" y="5" width="4" height="14" rx="1" /></svg>
                        </button>
                        <button class="player__close" type="button" aria-label="Fechar o jogo" @click="close">
                            <Icon name="close" />
                        </button>
                    </div>
                </header>
                <div class="player__stage" @pointerdown="focusGame">
                    <div ref="stage" class="player__canvas" tabindex="-1"></div>
                    <input
                        v-if="playing.id === 'star-syntax'"
                        ref="typing"
                        class="player__typing"
                        data-typing="true"
                        type="text"
                        aria-label="Digite as palavras mostradas no jogo"
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck="false"
                        enterkeyhint="go"
                        @input="onTyping"
                        @compositionend="onTyping"
                    />
                    <p v-if="status === 'loading'" class="player__status">Carregando o jogo…</p>
                    <p v-else-if="status === 'error'" class="player__status">
                        Não deu para carregar o jogo. Verifique a conexão e tente de novo.
                    </p>
                </div>
                <p class="player__rotate">Gire o celular para jogar com a tela inteira.</p>
            </div>
        </Teleport>
    </section>
</template>

<style scoped lang="scss">
.arcade {
    padding-block: var(--section);
    background: var(--black);
    color: var(--white);
}

.games {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 22px;
    perspective: 1400px;
}

.game {
    display: flex;
    flex-direction: column;
    background: var(--dark-2);
    transition: transform 0.4s var(--ease-out), box-shadow 0.4s;

    &:hover {
        transform: translateY(-8px);
        box-shadow: 0 30px 60px -30px rgb(242 194 0 / 0.35);
    }
}

/* ---------- Capas animadas ---------- */
.cover {
    position: relative;
    height: 200px;
    overflow: hidden;
    background: #141417;
    border-bottom: 3px solid var(--yellow);
}

.cover--bug-hunt {
    display: grid;
    align-content: center;
    gap: 12px;
    padding: 0 24px 0 56px;
}

.cover__code {
    height: 7px;
    background: #2a2a30;
}

.cover__prod {
    position: absolute;
    inset: 0 auto 0 0;
    width: 34px;
    background: rgb(255 92 92 / 0.2);
    color: #ff8a8a;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    display: grid;
    place-items: center;
}

.cover__bug {
    position: absolute;
    top: 46px;
    width: 58px;
    transform: scaleX(-1);
    animation: crawl 5s linear infinite;
}

.cover__bug--2 {
    top: 120px;
    width: 48px;
    animation-duration: 3.4s;
    animation-delay: -1.5s;
}

@keyframes crawl {
    from {
        left: 110%;
    }
    to {
        left: -20%;
    }
}

.cover__road {
    position: absolute;
    inset: auto 0 0;
    height: 44px;
    background: repeating-linear-gradient(90deg, #4a4a52 0 40px, transparent 40px 80px) 0 20px / 80px 6px no-repeat repeat-x, #1f1f23;
    border-top: 3px solid var(--yellow);
    animation: road 0.6s linear infinite;
}

@keyframes road {
    to {
        background-position: -80px 20px, 0 0;
    }
}

.cover__kart {
    position: absolute;
    left: 18%;
    bottom: 44px;
    width: 112px;
    height: auto;
    animation: hop 1.8s ease-in-out infinite;
}

@keyframes hop {
    0%, 55%, 100% {
        transform: translateY(0);
    }
    70% {
        transform: translateY(-70px) rotate(-6deg);
    }
}

.cover__block {
    position: absolute;
    bottom: 44px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    background: #ff5c5c;
    font-size: 13px;
    font-weight: 800;
    animation: slide 1.8s linear infinite;
}

.cover__coin {
    position: absolute;
    bottom: calc(110px + var(--n) * 6px);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 6px solid var(--yellow);
    background: #141417;
    animation: slide 1.8s linear infinite;
    animation-delay: calc(var(--n) * 0.12s - 0.9s);
}

@keyframes slide {
    from {
        left: 105%;
    }
    to {
        left: -15%;
    }
}

.cover--python-infinito {
    background-color: #0a0f12;
    background-image: linear-gradient(rgb(242 194 0 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(242 194 0 / 0.07) 1px, transparent 1px);
    background-size: 24px 24px;
}

.cover__snake {
    position: absolute;
    inset: 16% 8%;
    width: 84%;
    height: 68%;
}

.cover__food {
    position: absolute;
    right: 12%;
    top: 14%;
    width: 12px;
    height: 12px;
    background: var(--yellow);
    border-radius: 50%;
}

.cover--star-syntax {
    background:
        radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent),
        radial-gradient(1.5px 1.5px at 70% 18%, #fff, transparent),
        radial-gradient(1px 1px at 44% 62%, #fff, transparent),
        radial-gradient(1px 1px at 86% 70%, #fff, transparent),
        radial-gradient(circle at 80% 10%, rgb(192 38 211 / 0.4), transparent 50%),
        linear-gradient(#02030c, #10123a);
}

.cover__planet {
    position: absolute;
    right: 12%;
    top: 12%;
    width: 44px;
    height: 44px;
    background: radial-gradient(circle at 35% 30%, #fbcfe8, #c026d3 50%, #1e0b45);
    border-radius: 50%;
}

.cover__word {
    position: absolute;
    left: calc(14% + var(--n) * 26%);
    top: -24px;
    padding: 2px 7px;
    background: rgb(5 7 20 / 0.8);
    border: 1px solid #7dd3fc;
    color: #fff;
    font-family: Consolas, Menlo, monospace;
    font-size: 13px;
    animation: word 3.6s linear infinite;
    animation-delay: calc(var(--n) * -1.2s);
}

@keyframes word {
    to {
        top: 72%;
    }
}

.cover__ship {
    position: absolute;
    left: calc(50% - 22px);
    bottom: 10px;
    width: 44px;
}

/* ---------- Corpo do cartão ---------- */
.game__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 22px 22px 24px;

    h3 {
        margin-top: 4px;
        font-family: var(--serif);
        font-size: 24px;
    }
}

.game__genre {
    color: var(--yellow);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

.game__text {
    margin-top: 8px;
    color: var(--muted-dark);
    font-size: 15px;
    line-height: 1.6;
}

.game__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: auto;
    padding-top: 22px;
}

.game__best {
    color: var(--muted-dark);
    font-size: 13px;

    b {
        display: block;
        color: var(--white);
        font-family: var(--serif);
        font-size: 22px;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
    }
}

/* ---------- Tela de jogo ---------- */
.player {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: var(--black);
    color: var(--white);
}

.player__bar {
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

.player__tools {
    display: flex;
    align-items: center;
    gap: 4px;
}

.player__tool {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    color: var(--white);
    transition: color 0.2s, background-color 0.2s;

    svg {
        width: 24px;
        height: 24px;
    }

    &:hover {
        color: var(--yellow);
        background: var(--dark-2);
    }
}

.player__close {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    color: var(--white);
    font-size: 24px;
    transition: color 0.2s, transform 0.3s var(--ease-out);

    &:hover {
        color: var(--yellow);
        transform: rotate(90deg);
    }
}

.player__stage {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 0;
}

/* Tamanho definido para o Phaser encaixar o jogo inteiro na tela (modo FIT). */
.player__canvas {
    position: absolute;
    inset: clamp(8px, 2vw, 24px);

    :deep(canvas) {
        touch-action: none;
    }
}

.player__status {
    position: absolute;
    color: var(--muted-dark);
}

.player__rotate {
    display: none;
}

/* Campo invisível que recebe a digitação (abre o teclado no celular). */
.player__typing {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    border: 0;
    padding: 0;
    font-size: 16px;
}

@media (orientation: portrait) and (max-width: 700px) {
    .player {
        grid-template-rows: auto minmax(0, 1fr) auto;
    }

    .player__rotate {
        display: block;
        padding: 16px 20px 28px;
        color: var(--yellow);
        font-size: 15px;
        font-weight: 600;
        text-align: center;
    }
}

@media (max-width: 1180px) {
    .games {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 640px) {
    .games {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (prefers-reduced-motion: reduce) {
    .cover * {
        animation: none !important;
    }
}
</style>

<style scoped lang="scss">
.player__canvas:focus-visible {
    outline: 2px solid rgb(242 194 0 / 0.35);
    outline-offset: -2px;
}
</style>

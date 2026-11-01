<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { animate, splitText, stagger } from 'animejs';
import Icon from '../Icon/Icon.vue';
import HeroCounters from '../HeroCounters/HeroCounters.vue';
import photoUrl from '../../assets/erick-foto.webp';
import { contact, heroWords, socials } from '../../data/portfolio';
import { reducedMotion, shouldBuild } from '../../motion';

// O three.js chega num arquivo à parte: o texto aparece antes da cena 3D.
const HeroScene = defineAsyncComponent(() => import('../HeroScene/HeroScene.vue'));

const slot = ref<HTMLElement | null>(null);
const nameEl = ref<HTMLElement | null>(null);
const fallback = ref(false);
const typed = ref(heroWords[0]!);
let timer = 0;

/** Digita e apaga cada palavra da frase do topo. */
const typeLoop = (wordIndex: number, chars: number, deleting: boolean) => {
    const word = heroWords[wordIndex]!;
    typed.value = word.slice(0, chars);

    let next = () => typeLoop(wordIndex, chars + 1, false);
    let wait = 90;

    if (!deleting && chars === word.length) {
        next = () => typeLoop(wordIndex, chars - 1, true);
        wait = 2200;
    } else if (deleting && chars > 0) {
        next = () => typeLoop(wordIndex, chars - 1, true);
        wait = 45;
    } else if (deleting && chars === 0) {
        next = () => typeLoop((wordIndex + 1) % heroWords.length, 1, false);
        wait = 300;
    }

    timer = window.setTimeout(next, wait);
};

onMounted(() => {
    if (reducedMotion()) return;

    timer = window.setTimeout(() => typeLoop(0, heroWords[0]!.length, false), 1600);
    if (shouldBuild()) return;

    // O nome entra letra por letra, caindo no lugar.
    if (nameEl.value) {
        const { chars } = splitText(nameEl.value, { chars: true });
        animate(chars, {
            opacity: [0, 1],
            translateY: ['-0.5em', 0],
            rotateX: [90, 0],
            duration: 1000,
            delay: stagger(55, { start: 300 }),
            ease: 'outBack(1.6)',
        });
    }

    animate('.hero [data-hero]', {
        opacity: [0, 1],
        translateY: [30, 0],
        duration: 1100,
        delay: stagger(110, { start: 200 }),
        ease: 'outExpo',
    });
    animate('.hero__kicker-line', { scaleX: [0, 1], duration: 900, delay: 300, ease: 'outExpo' });
    animate('.hero__socials a', {
        opacity: [0, 1],
        translateX: [16, 0],
        duration: 800,
        delay: stagger(80, { start: 900 }),
        ease: 'outExpo',
    });
});

onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
    <section id="inicio" class="hero" aria-labelledby="hero-nome">
        <HeroScene :anchor="slot" @fallback="fallback = true" />

        <div class="hero__inner container">
            <div class="hero__text">
                <p class="hero__kicker" data-hero>
                    <span class="hero__kicker-line" aria-hidden="true"></span>
                    Bem-vindo ao meu portfólio
                </p>
                <h1 id="hero-nome" ref="nameEl" class="hero__name">Erick Alves<span>.</span></h1>
                <p class="hero__roles" data-hero>
                    Engenheiro de Software Full Stack <i>|</i> Fundador da
                    <a class="hero__woltek" href="https://woltek.com.br/" target="_blank" rel="noopener">Woltek</a>
                </p>
                <p class="hero__typed" data-hero>
                    Eu construo <strong>{{ typed }}</strong><span class="hero__caret" aria-hidden="true"></span>
                </p>
                <p class="hero__city" data-hero><Icon name="pin" /> {{ contact.city }}</p>

                <div class="hero__actions" data-hero>
                    <a class="btn btn--yellow" href="#projetos">Ver projetos</a>
                    <a class="btn btn--outline-light" :href="contact.cv" download="ErickAlves-CV.pdf">
                        <Icon name="download" /> Baixar CV
                    </a>
                </div>

                <HeroCounters data-hero />
            </div>

            <div ref="slot" class="hero__portrait">
                <img v-if="fallback" :src="photoUrl" alt="Foto de Erick Alves" width="640" height="640" />
            </div>
        </div>

        <ul class="hero__socials" aria-label="Redes">
            <li v-for="social in socials" :key="social.label">
                <a :href="social.href" target="_blank" rel="noopener" :aria-label="social.label">
                    <Icon :name="social.icon" />
                </a>
            </li>
        </ul>

        <a class="hero__scroll" href="#sobre">
            Rolar para baixo <Icon name="chevronDown" />
        </a>
    </section>
</template>

<style scoped lang="scss">
.hero {
    position: relative;
    display: flex;
    min-height: max(100svh, 680px);
    padding-top: var(--nav-h);
    background:
        radial-gradient(ellipse 60% 70% at 72% 45%, rgb(242 194 0 / 0.07), transparent 70%),
        radial-gradient(ellipse 120% 90% at 50% 40%, #16161a 0%, var(--black) 75%);
    color: var(--white);
    overflow: hidden;
}

.hero__inner {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 32px;
    pointer-events: none;

    a,
    button {
        pointer-events: auto;
    }
}

.hero__text {
    padding-block: 40px 96px;
}

.hero__kicker {
    display: flex;
    align-items: center;
    gap: 18px;
    color: var(--yellow);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.3em;
    text-transform: uppercase;
}

.hero__kicker-line {
    width: 56px;
    height: 2px;
    background: var(--yellow);
    transform-origin: left;
}

.hero__name {
    margin-top: 18px;
    font-family: var(--serif);
    font-weight: 700;
    font-size: clamp(46px, 6vw, 88px);
    line-height: 1.08;
    letter-spacing: -0.02em;

    span {
        color: var(--yellow);
    }
}

.hero__roles {
    margin-top: 22px;
    color: #d4d4d8;
    font-family: var(--serif);
    font-size: clamp(16px, 1.4vw, 19px);

    i {
        margin-inline: 8px;
        color: var(--yellow);
        font-style: normal;
    }
}

.hero__woltek {
    color: var(--white);
    font-weight: 700;
    text-decoration-color: #d4af37;
    text-decoration-thickness: 2px;
    text-underline-offset: 5px;
    transition: color 0.2s;

    &:hover {
        color: #d4af37;
    }
}

.hero__typed {
    margin-top: 6px;
    color: #d4d4d8;
    font-family: var(--serif);
    font-size: clamp(16px, 1.4vw, 19px);

    strong {
        color: var(--white);
        font-weight: 700;
    }
}

.hero__caret {
    display: inline-block;
    width: 2px;
    height: 1.1em;
    margin-left: 3px;
    vertical-align: -0.18em;
    background: var(--yellow);
    animation: blink 1s steps(1) infinite;
}

@keyframes blink {
    50% {
        opacity: 0;
    }
}

.hero__city {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    color: var(--muted-dark);
    font-size: 15px;
}

.hero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 40px;
}

.hero__portrait {
    align-self: stretch;
    min-height: 420px;
    margin-block: 24px 0;

    img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center bottom;
    }
}

.hero__socials {
    position: absolute;
    z-index: 3;
    right: clamp(12px, 2vw, 32px);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    list-style: none;

    &::after {
        content: '';
        width: 1px;
        height: 90px;
        margin-top: 10px;
        background: rgb(255 255 255 / 0.25);
    }

    a {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        color: var(--white);
        font-size: 17px;
        transition: color 0.2s, transform 0.25s var(--ease-out);

        &:hover {
            color: var(--yellow);
            transform: translateX(-3px);
        }
    }
}

.hero__scroll {
    position: absolute;
    z-index: 3;
    bottom: 28px;
    left: max(var(--gutter), calc((100% - var(--container)) / 2));
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    color: var(--white);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    text-decoration: none;

    .icon {
        color: var(--yellow);
        font-size: 16px;
        animation: bob 1.8s var(--ease-out) infinite;
    }
}

@keyframes bob {
    50% {
        transform: translateY(5px);
    }
}

@media (max-width: 900px) {
    .hero {
        min-height: 100svh;
    }

    .hero__inner {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(300px, 46svh) auto;
        align-items: start;
        gap: 0;
    }

    .hero__portrait {
        grid-row: 1;
        min-height: 0;
        margin: 8px 0 0;
    }

    .hero__text {
        grid-row: 2;
        padding-block: 8px 88px;
        text-align: center;
    }

    .hero__kicker {
        justify-content: center;
        font-size: 11px;
        letter-spacing: 0.22em;
    }

    .hero__kicker-line {
        width: 28px;
    }

    .hero__roles i {
        margin-inline: 4px;
    }

    .hero__city,
    .hero__actions {
        justify-content: center;
    }

    .hero__actions {
        margin-top: 28px;

        .btn {
            flex: 1 1 180px;
        }
    }

    .hero__socials {
        display: none;
    }

    .hero__scroll {
        left: 50%;
        transform: translateX(-50%);
        bottom: 16px;
    }
}
</style>

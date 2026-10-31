<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { animate, createDrawable, stagger } from 'animejs';
import Icon from '../Icon/Icon.vue';
import { woltek } from '../../data/portfolio';
import { onceVisible, reducedMotion } from '../../motion';

const process = ref<HTMLElement | null>(null);

onMounted(() => {
    const el = process.value;
    if (!el || reducedMotion()) return;
    const steps = el.querySelectorAll<HTMLElement>('.step');
    steps.forEach((s) => (s.style.opacity = '0'));
    const line = createDrawable(el.querySelector('.process__line path')!);
    animate(line, { draw: '0 0', duration: 1 });

    onceVisible(el, () => {
        // A linha do processo se desenha e cada etapa acende quando ela passa.
        animate(line, { draw: ['0 0', '0 1'], duration: 1800, ease: 'inOutQuad' });
        animate(steps, { opacity: [0, 1], translateY: [24, 0], duration: 700, delay: stagger(420, { start: 150 }), ease: 'outExpo' });
        animate(el.querySelectorAll('.step__dot'), { scale: [0, 1], duration: 700, delay: stagger(420, { start: 150 }), ease: 'outBack(2.5)' });
    });
});
</script>

<template>
    <section id="woltek" class="woltek" aria-labelledby="woltek-titulo">
        <div class="container">
            <div class="woltek__intro" data-reveal-group>
                <div>
                    <p class="woltek__kicker" data-reveal>Minha empresa</p>
                    <h2 id="woltek-titulo" class="woltek__name" data-split>Woltek<span>.</span></h2>
                    <p class="woltek__tagline" data-reveal>{{ woltek.tagline }}</p>
                </div>
                <div>
                    <p class="woltek__text" data-reveal>{{ woltek.about }}</p>
                    <div class="woltek__actions" data-reveal>
                        <a class="btn woltek__btn" :href="woltek.site" target="_blank" rel="noopener">
                            Conhecer a Woltek <Icon name="arrowUpRight" />
                        </a>
                        <a class="btn btn--outline-light" :href="woltek.instagram" target="_blank" rel="noopener">Instagram</a>
                    </div>
                </div>
            </div>

            <ul class="woltek__stats" data-reveal-group>
                <li v-for="stat in woltek.stats" :key="stat.label" data-reveal>
                    <b><span :data-count="stat.value">{{ stat.value }}</span>{{ stat.suffix }}</b>
                    <span>{{ stat.label }}</span>
                </li>
            </ul>

            <div class="woltek__columns">
                <div data-reveal-group>
                    <h3 data-reveal>O que o estúdio faz</h3>
                    <ul class="woltek__list">
                        <li v-for="service in woltek.services" :key="service.title" data-reveal>
                            <b>{{ service.title }}</b>
                            <span>{{ service.text }}</span>
                        </li>
                    </ul>
                </div>
                <div data-reveal-group>
                    <h3 data-reveal>Produtos próprios em produção</h3>
                    <ul class="woltek__list woltek__list--products">
                        <li v-for="product in woltek.products" :key="product.title" data-reveal>
                            <b>{{ product.title }}</b>
                            <span>{{ product.text }}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div ref="process" class="process">
                <h3>Como trabalhamos</h3>
                <div class="process__track">
                    <svg class="process__line" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M0 2 H1000" />
                    </svg>
                    <ol class="process__steps">
                        <li v-for="step in woltek.process" :key="step.title" class="step">
                            <span class="step__dot" aria-hidden="true"></span>
                            <b>{{ step.title }}</b>
                            <span>{{ step.text }}</span>
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped lang="scss">
.woltek {
    --gold: #d4af37;
    --cream: #fbe9cb;

    padding-block: var(--section);
    background: #000;
    color: var(--white);
}

.woltek__intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: clamp(32px, 6vw, 80px);
    align-items: end;
}

.woltek__kicker {
    color: var(--gold);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
}

.woltek__name {
    margin-top: 8px;
    font-family: var(--serif);
    font-size: clamp(56px, 8vw, 112px);
    line-height: 1;
    letter-spacing: -0.03em;

    span {
        color: var(--gold);
    }
}

.woltek__tagline {
    margin-top: 14px;
    color: var(--cream);
    font-family: var(--serif);
    font-size: clamp(18px, 1.8vw, 24px);
}

.woltek__text {
    color: #cfcfd4;
}

.woltek__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 28px;
}

.woltek__btn {
    background: var(--gold);
    border-color: var(--gold);
    color: #000;

    &:hover {
        background: var(--cream);
        border-color: var(--cream);
    }
}

.woltek__stats {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    margin-block: clamp(56px, 7vw, 88px);
    background: #2a2a2a;
    border: 1px solid #2a2a2a;

    li {
        display: grid;
        gap: 4px;
        padding: 28px 26px;
        background: #000;
    }

    b {
        color: var(--gold);
        font-family: var(--serif);
        font-size: clamp(36px, 4vw, 52px);
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
    }

    li > span {
        color: #a3a3ab;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }
}

.woltek__columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: clamp(32px, 6vw, 80px);

    h3 {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 18px;
    }
}

.woltek__list {
    list-style: none;
    display: grid;
    gap: 10px;

    li {
        display: grid;
        gap: 2px;
        padding: 18px 20px;
        background: #0f0f0f;
        border-left: 2px solid var(--gold);
        transition: background-color 0.25s, transform 0.3s var(--ease-out);

        &:hover {
            background: #161616;
            transform: translateX(6px);
        }
    }

    b {
        font-weight: 600;
    }

    span {
        color: #a3a3ab;
        font-size: 15px;
    }
}

.woltek__list--products li {
    border-left-color: var(--cream);
}

.process {
    position: relative;
    margin-top: clamp(56px, 7vw, 88px);

    h3 {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 34px;
    }
}

.process__track {
    position: relative;
}

.process__line {
    position: absolute;
    left: 0;
    right: 0;
    top: 7px;
    width: 100%;
    height: 4px;
    overflow: visible;

    path {
        fill: none;
        stroke: var(--gold);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
    }
}

.process__steps {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 24px;
}

.step {
    position: relative;
    display: grid;
    gap: 6px;
    padding-top: 30px;

    b {
        font-family: var(--serif);
        font-size: 20px;
    }

    span {
        color: #a3a3ab;
        font-size: 15px;
    }
}

.step__dot {
    position: absolute;
    top: 0;
    left: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: 0 0 0 6px #000, 0 0 0 7px var(--gold);
}

@media (max-width: 860px) {
    .woltek__intro,
    .woltek__columns {
        grid-template-columns: minmax(0, 1fr);
    }

    .woltek__stats {
        grid-template-columns: minmax(0, 1fr);
    }

    .process__line {
        display: none;
    }

    .process__steps {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        row-gap: 32px;
    }
}
</style>

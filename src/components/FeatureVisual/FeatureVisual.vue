<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { animate, createTimeline, stagger, utils, type Timeline } from 'animejs';
import { reducedMotion } from '../../motion';

/** Ilustração animada do sistema: o funil do CRM ou o painel financeiro da Gestão. */
const props = defineProps<{ kind: 'crm' | 'gestao' }>();

const root = ref<HTMLElement | null>(null);
let loop: Timeline | null = null;
let barTimer = 0;
let observer: IntersectionObserver | null = null;

const columns = [
    { title: 'Novo', cards: ['Marina', 'Paulo'] },
    { title: 'Qualificado', cards: ['Ana'] },
    { title: 'Fechado', cards: ['Rafael'] },
];

const bars = [42, 58, 51, 66, 72, 61, 80, 88];
const months = ['mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out'];

const animateBars = () => {
    if (!root.value) return;
    animate(root.value.querySelectorAll('.chart__bar'), {
        height: () => `${utils.random(35, 95)}%`,
        duration: 1400,
        delay: stagger(60),
        ease: 'inOutQuart',
    });
};

onMounted(() => {
    const el = root.value;
    if (!el || reducedMotion()) return;

    if (props.kind === 'crm') {
        // Um lead anda pelo funil: chega, a IA qualifica, fecha a venda e recomeça.
        const columnWidth = () => (el.querySelector('.kanban__col') as HTMLElement).offsetWidth + 10;
        loop = createTimeline({ loop: true, autoplay: false, defaults: { ease: 'inOutCubic' } })
            .add('.lead', { opacity: [0, 1], translateY: [-20, 0], duration: 600 })
            .add('.lead__score', { width: ['0%', '86%'], duration: 900 }, '+=200')
            .add('.lead', { translateX: () => columnWidth(), duration: 800 }, '+=300')
            .add('.lead__tag', { opacity: [0, 1], scale: [0.6, 1], duration: 400, ease: 'outBack(2)' })
            .add('.lead', { translateX: () => columnWidth() * 2, duration: 800 }, '+=700')
            .add('.lead__paid', { opacity: [0, 1], scale: [0.6, 1], duration: 400, ease: 'outBack(2)' })
            .add('.chat__dot', { translateY: [0, -5, 0], duration: 500, delay: stagger(120) }, '-=900')
            .add('.lead', { opacity: 0, duration: 400 }, '+=900')
            .add(['.lead__tag', '.lead__paid'], { opacity: 0, duration: 1 })
            .add('.lead', { translateX: 0, duration: 1 });
    } else {
        loop = createTimeline({ loop: true, autoplay: false })
            .add('.kpi__value', { opacity: [0.4, 1], duration: 800, delay: stagger(150) })
            .add('.chart__line-dot', { scale: [1, 1.6, 1], duration: 900, ease: 'inOutSine' })
            .add({ duration: 1200 });
    }

    observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) {
            loop?.play();
            if (props.kind === 'gestao' && !barTimer) {
                animateBars();
                barTimer = window.setInterval(animateBars, 2600);
            }
        } else {
            loop?.pause();
            window.clearInterval(barTimer);
            barTimer = 0;
        }
    });
    observer.observe(el);
});

onBeforeUnmount(() => {
    observer?.disconnect();
    loop?.pause();
    window.clearInterval(barTimer);
});
</script>

<template>
    <div ref="root" class="visual" aria-hidden="true">
        <div class="window">
            <div class="window__bar">
                <i></i><i></i><i></i>
                <span>{{ kind === 'crm' ? 'Funil de vendas' : 'Fluxo de caixa' }}</span>
            </div>

            <div v-if="kind === 'crm'" class="window__body kanban">
                <div v-for="column in columns" :key="column.title" class="kanban__col">
                    <p class="kanban__title">{{ column.title }}</p>
                    <div v-for="card in column.cards" :key="card" class="kanban__card">
                        <b>{{ card }}</b>
                        <span></span>
                    </div>
                </div>
                <div class="lead">
                    <b>Novo lead</b>
                    <span class="lead__track"><span class="lead__score"></span></span>
                    <em class="lead__tag">IA 0,86</em>
                    <em class="lead__paid">Venda paga</em>
                </div>
                <div class="chat"><i class="chat__dot"></i><i class="chat__dot"></i><i class="chat__dot"></i></div>
            </div>

            <div v-else class="window__body finance">
                <div class="kpis">
                    <div class="kpi"><span>Receitas</span><b class="kpi__value">R$ 284 mil</b></div>
                    <div class="kpi"><span>Despesas</span><b class="kpi__value">R$ 171 mil</b></div>
                    <div class="kpi"><span>Saldo</span><b class="kpi__value">R$ 113 mil</b></div>
                </div>
                <div class="chart">
                    <div v-for="(bar, index) in bars" :key="index" class="chart__col">
                        <span class="chart__bar" :style="{ height: `${bar}%` }"></span>
                        <span class="chart__label">{{ months[index] }}</span>
                    </div>
                    <span class="chart__line-dot"></span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.visual {
    position: relative;
    padding: clamp(20px, 3vw, 36px);
    background: var(--black);
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px);
        background-size: 18px 18px;
    }
}

.window {
    position: relative;
    background: #141417;
    border: 1px solid #2a2a30;
    box-shadow: 0 30px 60px -30px rgb(0 0 0 / 0.8);
}

.window__bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-bottom: 1px solid #2a2a30;

    i {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #3a3a42;
    }

    span {
        margin-left: 10px;
        color: var(--muted-dark);
        font-size: 12px;
        font-weight: 600;
    }
}

.window__body {
    position: relative;
    padding: 16px;
    min-height: 260px;
}

.kanban {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.kanban__col {
    display: grid;
    align-content: start;
    gap: 8px;
    padding: 10px;
    background: #1b1b1f;
    min-height: 290px;
}

.kanban__title,
.kanban__card b,
.lead b {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.kanban__title {
    color: var(--muted-dark);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.kanban__card,
.lead {
    display: grid;
    gap: 6px;
    padding: 10px;
    background: #242429;
    color: var(--white);
    font-size: 12px;
    line-height: 1.3;

    span {
        height: 5px;
        width: 70%;
        background: #34343b;
    }
}

.lead {
    position: absolute;
    bottom: 30px;
    left: 26px;
    width: calc((100% - 32px - 20px) / 3 - 20px);
    background: #2c2a1c;
    border-left: 3px solid var(--yellow);
    box-shadow: 0 12px 24px -10px rgb(0 0 0 / 0.7);
}

.lead__track {
    width: 100% !important;
    position: relative;
}

.lead__score {
    position: absolute;
    inset: 0 auto 0 0;
    width: 0 !important;
    background: var(--yellow) !important;
}

.lead__tag,
.lead__paid {
    justify-self: start;
    padding: 2px 6px;
    font-style: normal;
    font-size: 11px;
    font-weight: 700;
    opacity: 0;
}

.lead__tag {
    background: var(--yellow);
    color: var(--black);
}

.lead__paid {
    background: #34d399;
    color: var(--black);
}

.chat {
    position: absolute;
    right: 18px;
    bottom: 16px;
    display: flex;
    gap: 4px;
    padding: 8px 10px;
    background: #25d366;

    i {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--black);
    }
}

.kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.kpi {
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    background: #1b1b1f;

    span {
        color: var(--muted-dark);
        font-size: 11px;
        font-weight: 600;
    }

    b {
        color: var(--white);
        font-size: clamp(13px, 1.3vw, 16px);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    &:last-child b {
        color: var(--yellow);
    }
}

.chart {
    position: relative;
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 8px;
    height: 170px;
    margin-top: 14px;
    padding: 10px 10px 0;
    background: #1b1b1f;
}

.chart__col {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 4px;
}

.chart__bar {
    align-self: end;
    background: linear-gradient(to top, #8a6e04, var(--yellow));
}

.chart__label {
    color: var(--muted-dark);
    font-size: 10px;
    text-align: center;
    padding-bottom: 6px;
}

.chart__line-dot {
    position: absolute;
    right: 18px;
    top: 14px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 0 4px rgb(52 211 153 / 0.2);
}
</style>

<style scoped lang="scss">
@media (max-width: 520px) {
    .window__body {
        padding: 10px;
    }

    .kanban {
        gap: 6px;
    }

    .kanban__col {
        padding: 6px;
    }

    .kanban__title {
        font-size: 9px;
        letter-spacing: 0.04em;
    }

    .kanban__card,
    .lead {
        padding: 7px;
        font-size: 11px;
    }

    .lead {
        left: 16px;
        width: calc((100% - 20px - 12px) / 3 - 12px);
    }
}
</style>

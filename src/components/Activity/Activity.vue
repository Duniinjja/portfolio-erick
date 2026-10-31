<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { animate, stagger } from 'animejs';
import { activityStats, contributionDays } from '../../data/portfolio';
import { onceVisible, reducedMotion } from '../../motion';

const grid = ref<HTMLElement | null>(null);
const bars = ref<HTMLElement | null>(null);

// O calendário começa num domingo: cada coluna é uma semana.
const firstWeekday = new Date(`${contributionDays[0]![0]}T12:00:00Z`).getUTCDay();
const cells = [...Array(firstWeekday).fill(null), ...contributionDays];
const weeks = Math.ceil(cells.length / 7);

const level = (count: number) => (count === 0 ? 0 : count < 10 ? 1 : count < 25 ? 2 : count < 50 ? 3 : 4);
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });
const dateLabel = (iso: string) => dateFormat.format(new Date(`${iso}T12:00:00-03:00`));

const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const byMonth = new Map<string, number>();
contributionDays.forEach(([date, count]) => {
    const key = date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + count);
});
const months = [...byMonth.entries()].slice(-12).map(([key, total]) => ({
    key,
    label: monthNames[Number(key.slice(5, 7)) - 1]!,
    total,
}));
const maxMonth = Math.max(...months.map((m) => m.total));
const best = contributionDays.reduce((a, b) => (b[1] > a[1] ? b : a));

onMounted(() => {
    if (!grid.value || !bars.value || reducedMotion()) return;
    const squares = grid.value.querySelectorAll<HTMLElement>('.cell');
    const columns = bars.value.querySelectorAll<HTMLElement>('.month__bar');
    squares.forEach((s) => (s.style.opacity = '0'));
    columns.forEach((c) => (c.style.transform = 'scaleY(0)'));

    onceVisible(grid.value, () => {
        // As células acendem em onda, a partir do dia mais movimentado.
        animate(squares, {
            opacity: [0, 1],
            scale: [0, 1],
            duration: 700,
            // As células estão em colunas (uma por semana): a grade do stagger é 7 × semanas.
            delay: stagger(9, { grid: [7, weeks], from: cells.indexOf(best) }),
            ease: 'outBack(1.6)',
        });
        animate(columns, { scaleY: [0, 1], duration: 1200, delay: stagger(70, { start: 500 }), ease: 'outExpo' });
    });
});
</script>

<template>
    <section id="atividade" class="activity" aria-labelledby="atividade-titulo">
        <div class="container">
            <header class="section-head section-head--dark" data-reveal-group>
                <span class="section-kicker" data-reveal>Atividade</span>
                <h2 id="atividade-titulo" data-split>Código todo dia.</h2>
                <p data-reveal>Minhas contribuições no GitHub nos últimos 12 meses, em projetos públicos e privados.</p>
            </header>

            <ul class="stats" data-reveal-group>
                <li v-for="stat in activityStats" :key="stat.label" data-reveal>
                    <span class="stats__value" :data-count="stat.value">{{ stat.value.toLocaleString('pt-BR') }}</span>
                    <span class="stats__label">{{ stat.label }}</span>
                </li>
            </ul>

            <div class="heatmap" tabindex="0" role="region" aria-label="Mapa de contribuições, role para os lados">

                <div
                    ref="grid"
                    class="heatmap__grid"
                    :style="{ '--weeks': weeks }"
                    role="img"
                    :aria-label="`Mapa de contribuições: recorde de ${best[1]} em ${dateLabel(best[0])}`"
                >
                    <span
                        v-for="(day, index) in cells"
                        :key="index"
                        :class="['cell', day ? `cell--${level(day[1])}` : 'cell--empty']"
                        :title="day ? `${day[1]} contribuições em ${dateLabel(day[0])}` : undefined"
                    ></span>
                </div>
                <div class="heatmap__legend">
                    <span>Menos</span>
                    <i v-for="n in 5" :key="n" :class="['cell', `cell--${n - 1}`]"></i>
                    <span>Mais</span>
                    <strong>Recorde: {{ best[1] }} em {{ dateLabel(best[0]) }}</strong>
                </div>
            </div>

            <div ref="bars" class="months" aria-label="Contribuições por mês">
                <div v-for="month in months" :key="month.key" class="month">
                    <span class="month__value">{{ month.total.toLocaleString('pt-BR') }}</span>
                    <span class="month__track">
                        <span class="month__bar" :style="{ height: `${Math.max(3, (month.total / maxMonth) * 100)}%` }"></span>
                    </span>
                    <span class="month__label">{{ month.label }}</span>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped lang="scss">
.activity {
    padding-block: var(--section);
    background: var(--black);
    color: var(--white);
}

.stats {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 24px;
    margin-bottom: 56px;

    li {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 26px 16px;
        background: var(--dark-2);
        text-align: center;
    }
}

.stats__value {
    color: var(--yellow);
    font-family: var(--serif);
    font-weight: 700;
    font-size: clamp(32px, 3.6vw, 48px);
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}

.stats__label {
    color: var(--muted-dark);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

.heatmap {
    overflow-x: auto;
    padding-bottom: 8px;
}

.heatmap__grid {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    grid-auto-flow: column;
    grid-auto-columns: minmax(9px, 1fr);
    gap: 3px;
    min-width: 640px;
}

.cell {
    display: block;
    aspect-ratio: 1;
    border-radius: 2px;
    background: #1f1f23;
}

.cell--empty {
    background: transparent;
}

.cell--1 { background: #4d3f06; }
.cell--2 { background: #8a6e04; }
.cell--3 { background: #c79f02; }
.cell--4 { background: var(--yellow); }

.heatmap__legend {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 14px;
    color: var(--muted-dark);
    font-size: 13px;

    i {
        width: 12px;
    }

    strong {
        margin-left: auto;
        color: var(--white);
        font-weight: 600;
    }
}

.months {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 10px;
    height: 220px;
    margin-top: 56px;
}

.month {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 8px;
    text-align: center;
}

.month__value {
    color: var(--muted-dark);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.month__track {
    position: relative;
}

.month__bar {
    position: absolute;
    inset: auto 0 0;
    background: var(--yellow);
    transform-origin: bottom;
}

.month__label {
    color: var(--muted-dark);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

@media (max-width: 760px) {
    .stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }

    .heatmap__legend strong {
        flex-basis: 100%;
        margin: 6px 0 0;
    }

    .months {
        gap: 4px;
        height: 180px;
    }

    .month__value {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        justify-self: center;
        font-size: 11px;
    }
}
</style>

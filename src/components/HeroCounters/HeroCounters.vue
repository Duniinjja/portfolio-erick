<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { animate } from 'animejs';
import { reducedMotion } from '../../motion';

/**
 * Piada visual "um trabalho que nunca acaba": a caneca enche, transborda e
 * esvazia num gole; a lata (bateria do dev) descarrega, amassa e é trocada;
 * o relógio gira e, a cada 168 horas, a folha do calendário voa.
 */

const root = ref<HTMLElement | null>(null);
const mug = ref<SVGGElement | null>(null);
const drip = ref<SVGPathElement | null>(null);
const puddle = ref<SVGEllipseElement | null>(null);
const can = ref<SVGGElement | null>(null);
const page = ref<SVGGElement | null>(null);

const coffee = reactive({ level: 0.55, cups: 1284, state: 'fill' as 'fill' | 'spill' | 'drink', t: 0 });
const energy = reactive({ level: 0.42, cans: 312, state: 'drain' as 'drain' | 'crush' | 'drop', t: 0 });
const clock = reactive({ hours: 132, total: 6480, week: 38, flash: 0 });

const coffeeNote = computed(() =>
    coffee.state === 'spill' ? 'transbordou!' : coffee.state === 'drink' ? 'glub, glub…' : 'enchendo…',
);
const energyNote = computed(() => (energy.state === 'drain' ? `bateria ${Math.round(energy.level * 100)}%` : 'abre outra!'));
const clockNote = computed(() => (clock.flash > 0 ? '+1 semana!' : `semana ${clock.week}`));

// Bateria: verde → amarelo → vermelho conforme a lata esvazia.
const energyColor = computed(() => (energy.level > 0.55 ? '#34d399' : energy.level > 0.25 ? '#f2c200' : '#ff5c5c'));
const hourAngle = computed(() => (clock.hours % 12) * 30);
const minuteAngle = computed(() => (clock.hours % 1) * 360);

const spill = () => {
    if (mug.value) animate(mug.value, { rotate: [0, -6, 5, -3, 0], duration: 700, ease: 'inOutSine' });
    if (drip.value) animate(drip.value, { translateY: [0, 26], opacity: [{ to: 1, duration: 120 }, { to: 0, duration: 680 }], duration: 800, ease: 'inQuad' });
    if (puddle.value) animate(puddle.value, { scaleX: [0, 1], opacity: [{ to: 0.8, duration: 200 }, { to: 0, duration: 900, delay: 400 }], duration: 1100, ease: 'outQuad' });
};

const crush = () => {
    if (!can.value) return;
    animate(can.value, {
        scaleY: [1, 0.35],
        scaleX: [1, 1.25],
        rotate: [0, -18],
        translateY: [0, 10],
        opacity: [{ to: 1, duration: 450 }, { to: 0, duration: 300 }],
        duration: 750,
        ease: 'inBack(2)',
    });
};

const dropIn = () => {
    if (!can.value) return;
    animate(can.value, { scaleY: [1, 1], scaleX: [1, 1], rotate: [0, 0], translateY: [-46, 0], opacity: [0, 1], duration: 650, ease: 'outBounce' });
};

const tearPage = () => {
    if (!page.value) return;
    animate(page.value, {
        rotate: [0, 38],
        translateX: [0, 34],
        translateY: [0, -26],
        opacity: [1, 0],
        duration: 700,
        ease: 'inCubic',
        onComplete: () => {
            if (page.value) animate(page.value, { rotate: 0, translateX: 0, translateY: [8, 0], opacity: [0, 1], duration: 350, ease: 'outBack(2)' });
        },
    });
};

let frame = 0;
let last = 0;
let visible = true;
let observer: IntersectionObserver | null = null;

const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (!visible) return;

    // Caneca: enche em ~7 s, transborda, esvazia num gole.
    coffee.t += dt;
    if (coffee.state === 'fill') {
        coffee.level = Math.min(1, coffee.level + dt / 7);
        if (coffee.level >= 1) {
            coffee.state = 'spill';
            coffee.t = 0;
            spill();
        }
    } else if (coffee.state === 'spill' && coffee.t > 1.1) {
        coffee.state = 'drink';
        coffee.t = 0;
    } else if (coffee.state === 'drink') {
        coffee.level = Math.max(0, 1 - coffee.t / 0.7);
        if (coffee.level <= 0) {
            coffee.cups++;
            coffee.state = 'fill';
        }
    }

    // Lata: descarrega em ~6 s, amassa e uma nova cai no lugar.
    energy.t += dt;
    if (energy.state === 'drain') {
        energy.level = Math.max(0, energy.level - dt / 6);
        if (energy.level <= 0) {
            energy.state = 'crush';
            energy.t = 0;
            crush();
        }
    } else if (energy.state === 'crush' && energy.t > 0.9) {
        energy.state = 'drop';
        energy.t = 0;
        energy.level = 1;
        energy.cans++;
        dropIn();
    } else if (energy.state === 'drop' && energy.t > 0.7) {
        energy.state = 'drain';
    }

    // Relógio: 12 horas por segundo; a semana vira a cada 168 horas.
    clock.hours += dt * 12;
    clock.total += dt * 12;
    clock.flash = Math.max(0, clock.flash - dt);
    if (clock.hours >= 168) {
        clock.hours = 0;
        clock.week++;
        clock.flash = 1.4;
        tearPage();
    }
};

onMounted(() => {
    if (reducedMotion() || !root.value) return;
    observer = new IntersectionObserver(([entry]) => (visible = Boolean(entry?.isIntersecting)));
    observer.observe(root.value);
    frame = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
});
</script>

<template>
    <div ref="root" class="status">
        <p class="status__caption"><b>Status do dev:</b> um trabalho que nunca acaba.</p>

        <div class="status__row" aria-hidden="true">
            <!-- Café -->
            <div class="item">
                <svg class="item__art" viewBox="0 0 64 64">
                    <defs>
                        <clipPath id="cafe-nivel">
                            <rect x="10" :y="21 + (1 - coffee.level) * 35" width="38" height="40" />
                        </clipPath>
                    </defs>
                    <ellipse ref="puddle" class="puddle" cx="30" cy="60" rx="20" ry="2.5" />
                    <g ref="mug" class="pivot">
                        <path :class="['steam', { 'steam--on': coffee.level > 0.35 && coffee.state === 'fill' }]" d="M22 15c-2-3 2-4 0-7M30 15c-2-3 2-4 0-7M38 15c-2-3 2-4 0-7" />
                        <g clip-path="url(#cafe-nivel)">
                            <path class="coffee" d="M14 22h32v22a9 9 0 0 1-9 9H23a9 9 0 0 1-9-9z" />
                            <rect v-if="coffee.level > 0.04" class="crema" x="12" :y="21 + (1 - coffee.level) * 35" width="36" height="3" />
                        </g>
                        <path class="line" d="M12 20h36v24a11 11 0 0 1-11 11H23a11 11 0 0 1-11-11z" />
                        <path class="line" d="M48 27h3.5a6.5 6.5 0 0 1 0 13H48" />
                        <path ref="drip" class="drip" d="M45 20c2 3 3 5 3 6.5a3 3 0 0 1-6 0c0-1.5 1-3.5 3-6.5z" />
                    </g>
                </svg>
                <div class="item__text">
                    <span class="item__label">Cafés</span>
                    <span class="item__value">{{ coffee.cups.toLocaleString('pt-BR') }}</span>
                    <span class="item__note">{{ coffeeNote }}</span>
                </div>
            </div>

            <!-- Energético -->
            <div class="item">
                <svg class="item__art" viewBox="0 0 64 64">
                    <g ref="can" class="pivot pivot--bottom">
                        <rect class="rim" x="22" y="5" width="20" height="4" rx="1.5" />
                        <rect class="can" x="18" y="9" width="28" height="48" rx="5" />
                        <rect x="22" :y="13 + (1 - energy.level) * 40" width="20" :height="energy.level * 40" rx="2" :fill="energyColor" />
                        <path class="bolt" d="m35 21-7 12h6l-4 11 9-14h-6z" />
                    </g>
                </svg>
                <div class="item__text">
                    <span class="item__label">Energéticos</span>
                    <span class="item__value">{{ energy.cans.toLocaleString('pt-BR') }}</span>
                    <span class="item__note">{{ energyNote }}</span>
                </div>
            </div>

            <!-- Horas -->
            <div class="item">
                <svg class="item__art" viewBox="0 0 64 64">
                    <circle class="line" cx="26" cy="38" r="19" />
                    <line class="tick" x1="26" y1="22" x2="26" y2="25" />
                    <line class="hand hand--hour" x1="26" y1="38" x2="26" y2="28" :transform="`rotate(${hourAngle} 26 38)`" />
                    <line class="hand" x1="26" y1="38" x2="26" y2="23" :transform="`rotate(${minuteAngle} 26 38)`" />
                    <circle cx="26" cy="38" r="2.2" fill="#f2c200" />
                    <g ref="page" class="pivot">
                        <rect x="40" y="3" width="21" height="21" rx="2" fill="#ffffff" />
                        <rect x="40" y="3" width="21" height="6" rx="2" fill="#ff5c5c" />
                        <text x="50.5" y="20.5" text-anchor="middle" class="week">{{ clock.week }}</text>
                    </g>
                </svg>
                <div class="item__text">
                    <span class="item__label">Horas</span>
                    <span class="item__value">{{ Math.floor(clock.total).toLocaleString('pt-BR') }}</span>
                    <span :class="['item__note', { 'item__note--hot': clock.flash > 0 }]">{{ clockNote }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.status {
    margin-top: 44px;
    max-width: 600px;
}

.status__caption {
    color: var(--muted-dark);
    font-size: 13px;

    b {
        color: var(--yellow);
        font-weight: 700;
    }
}

.status__row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    margin-top: 14px;
}

.item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.item__art {
    flex-shrink: 0;
    width: 58px;
    height: 58px;
    overflow: visible;
}

.pivot {
    transform-box: fill-box;
    transform-origin: center;
}

.pivot--bottom {
    transform-origin: center bottom;
}

.line {
    fill: none;
    stroke: var(--yellow);
    stroke-width: 3;
    stroke-linejoin: round;
}

.coffee {
    fill: #6f4322;
}

.crema {
    fill: #d9a35b;
}

.steam {
    fill: none;
    stroke: #8a8a92;
    stroke-width: 2;
    stroke-linecap: round;
    opacity: 0;
    transition: opacity 0.6s;
}

.steam--on {
    opacity: 1;
    animation: steam 1.8s ease-in-out infinite;
}

@keyframes steam {
    50% {
        transform: translateY(-2px);
        opacity: 0.4;
    }
}

.drip {
    fill: #6f4322;
    opacity: 0;
}

.puddle {
    fill: #6f4322;
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
}

.rim {
    fill: #6a6a72;
}

.can {
    fill: #1b1b1e;
    stroke: var(--yellow);
    stroke-width: 3;
}

.bolt {
    fill: #0a0a0b;
    opacity: 0.55;
}

.tick {
    stroke: #6a6a72;
    stroke-width: 2;
}

.hand {
    stroke: var(--white);
    stroke-width: 2;
    stroke-linecap: round;
}

.hand--hour {
    stroke: var(--yellow);
    stroke-width: 3;
}

.week {
    fill: #0a0a0b;
    font-family: var(--sans);
    font-size: 10px;
    font-weight: 800;
}

.item__text {
    display: grid;
    min-width: 0;
    line-height: 1.25;
}

.item__label {
    color: var(--muted-dark);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

.item__value {
    font-family: var(--serif);
    font-weight: 700;
    font-size: 20px;
    font-variant-numeric: tabular-nums;
}

.item__note {
    color: var(--muted-dark);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s;
}

.item__note--hot {
    color: var(--yellow);
    font-weight: 600;
}

@media (max-width: 900px) {
    .status {
        margin: 32px auto 0;
        text-align: center;
    }

    .status__row {
        gap: 10px;
    }

    .item {
        flex-direction: column;
        gap: 6px;
    }

    .item__art {
        width: 50px;
        height: 50px;
    }

    .item__note {
        white-space: normal;
    }
}
</style>

<style scoped lang="scss">
/* Coluna estreita (tablet e notebook pequeno): o desenho fica acima do texto. */
@media (min-width: 901px) and (max-width: 1100px) {
    .item {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }

    .item__art {
        width: 50px;
        height: 50px;
    }
}
</style>

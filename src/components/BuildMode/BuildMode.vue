<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { SiteBuilder, type BuildProgress } from '../../build/builder';
import { rememberBuilt, shouldBuild } from '../../motion';

const active = shouldBuild();
const canvas = ref<HTMLCanvasElement | null>(null);
const progress = ref<BuildProgress>({ done: 0, total: 0, status: 'construindo' });
const closed = ref(false);
let builder: SiteBuilder | null = null;
let timer = 0;

const percent = computed(() => (progress.value.total ? (progress.value.done / progress.value.total) * 100 : 0));
const published = computed(() => progress.value.status === 'publicado');

const onProgress = (next: BuildProgress) => {
    progress.value = next;
    if (next.status !== 'publicado' || timer) return;
    rememberBuilt();
    timer = window.setTimeout(() => (closed.value = true), 2600);
};

const skip = () => builder?.skip();

onMounted(() => {
    if (!active || !canvas.value) return;
    builder = new SiteBuilder(canvas.value, onProgress);
    builder.start();
});

onBeforeUnmount(() => {
    builder?.stop();
    window.clearTimeout(timer);
});
</script>

<template>
    <template v-if="active && !closed">
        <canvas ref="canvas" class="build__canvas" aria-hidden="true"></canvas>

        <div class="build">
            <p class="build__count">
                <strong>{{ progress.done }}</strong> / {{ progress.total }} camadas
            </p>
            <span class="build__bar" aria-hidden="true"><i :style="{ width: `${percent}%` }"></i></span>
            <span class="build__status" :class="{ 'build__status--done': published }">
                {{ published ? 'Publicado' : 'Construindo' }}
            </span>
            <button v-if="!published" class="build__skip" type="button" @click="skip">Pular</button>
        </div>
    </template>
</template>

<style scoped lang="scss">
.build__canvas {
    position: fixed;
    inset: 0;
    z-index: 45;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.build {
    position: fixed;
    left: 50%;
    bottom: 16px;
    z-index: 46;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 4px 6px 4px 16px;
    background: rgb(17 17 19 / 0.94);
    border: 1px solid var(--line-dark);
    border-radius: 10px;
    color: var(--muted-dark);
    font-size: 13px;
    white-space: nowrap;
    transform: translateX(-50%);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.4);
}

.build__count {
    font-variant-numeric: tabular-nums;

    strong {
        color: var(--white);
        font-weight: 700;
    }
}

.build__bar {
    width: 110px;
    height: 3px;
    background: var(--dark-3);
    border-radius: 2px;
    overflow: hidden;

    i {
        display: block;
        height: 100%;
        background: var(--yellow);
        transition: width 0.25s;
    }
}

.build__status {
    color: var(--white);
    font-weight: 600;
}

.build__status--done {
    padding-right: 10px;
    color: #4ade80;
}

.build__skip {
    min-width: 64px;
    min-height: 44px;
    padding-inline: 12px;
    background: var(--dark-3);
    border: 0;
    border-radius: 7px;
    color: var(--white);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
        background: var(--line-dark);
    }

    &:focus-visible {
        outline: 2px solid var(--yellow);
        outline-offset: 2px;
    }
}

@media (max-width: 760px) {
    .build {
        left: 12px;
        right: 80px; // o botão de voltar ao topo fica à direita
        bottom: 12px;
        gap: 10px;
        justify-content: space-between;
        padding-left: 12px;
        transform: none;
    }

    .build__bar,
    .build__status {
        display: none;
    }

    .build__status--done {
        display: inline;
    }
}
</style>

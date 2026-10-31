<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { animate, createTimeline, stagger } from 'animejs';
import Icon from '../Icon/Icon.vue';
import type { Project } from '../../data/portfolio';
import { reducedMotion } from '../../motion';

const props = defineProps<{ project: Project | null }>();
const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);
let opener: HTMLElement | null = null;

const close = () => {
    if (!panel.value || reducedMotion()) {
        emit('close');
        return;
    }
    animate(panel.value, { opacity: 0, translateY: 24, scale: 0.97, duration: 220, ease: 'inQuad' });
    animate('.dialog__backdrop', { opacity: 0, duration: 240, ease: 'linear', onComplete: () => emit('close') });
};

const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
    // Mantém o Tab dentro da janela.
    if (event.key === 'Tab' && panel.value) {
        const focusable = panel.value.querySelectorAll<HTMLElement>('a[href], button');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    }
};

watch(
    () => props.project,
    async (project) => {
        if (!project) {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
            opener?.focus();
            return;
        }
        opener = document.activeElement as HTMLElement;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        await nextTick();
        closeBtn.value?.focus();
        if (reducedMotion() || !panel.value) return;

        createTimeline({ defaults: { ease: 'outExpo' } })
            .add('.dialog__backdrop', { opacity: [0, 1], duration: 300 }, 0)
            .add(panel.value, { opacity: [0, 1], translateY: [40, 0], scale: [0.94, 1], duration: 700 }, 60)
            .add('.dialog__monogram', { scale: [0.3, 1], rotate: [-12, 0], duration: 900, ease: 'outElastic(1, 0.6)' }, 200)
            .add('.dialog [data-pop]', { opacity: [0, 1], translateY: [16, 0], duration: 600, delay: stagger(50) }, 260)
            .add('.dialog__highlights li', { opacity: [0, 1], translateX: [-18, 0], duration: 600, delay: stagger(70) }, 360)
            .add('.dialog__stack li', { opacity: [0, 1], scale: [0.5, 1], duration: 700, delay: stagger(35), ease: 'outBack(2)' }, 480);
    },
);

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
});
</script>

<template>
    <Teleport to="body">
        <div v-if="project" class="dialog" role="presentation">
            <div class="dialog__backdrop" @click="close"></div>
            <div
                ref="panel"
                class="dialog__panel"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="`dialog-${project.id}`"
                :style="{ '--accent': project.accent }"
            >
                <header class="dialog__header">
                    <span class="dialog__monogram" aria-hidden="true">{{ project.monogram }}</span>
                    <div>
                        <p class="dialog__category" data-pop>{{ project.category }}</p>
                        <h3 :id="`dialog-${project.id}`" data-pop>{{ project.name }}</h3>
                        <p class="dialog__tagline" data-pop>{{ project.tagline }}</p>
                    </div>
                    <button ref="closeBtn" class="dialog__close" type="button" aria-label="Fechar" @click="close">
                        <Icon name="close" />
                    </button>
                </header>

                <div class="dialog__body">
                    <div class="dialog__meta" data-pop>
                        <span class="chip chip--accent">{{ project.status }}</span>
                        <span v-if="project.commits" class="chip">{{ project.commits.toLocaleString('pt-BR') }} commits</span>
                    </div>
                    <p class="dialog__description" data-pop>{{ project.description }}</p>

                    <h4 data-pop>Destaques</h4>
                    <ul class="dialog__highlights">
                        <li v-for="item in project.highlights" :key="item">{{ item }}</li>
                    </ul>

                    <h4 data-pop>Tecnologias</h4>
                    <ul class="dialog__stack">
                        <li v-for="tech in project.stack" :key="tech">{{ tech }}</li>
                    </ul>

                    <a v-if="project.link" class="btn btn--yellow dialog__link" :href="project.link.href" target="_blank" rel="noopener" data-pop>
                        {{ project.link.label }} <Icon name="arrowUpRight" />
                    </a>
                    <p v-else class="dialog__private" data-pop>Código privado. Posso apresentar o sistema numa conversa.</p>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped lang="scss">
.dialog {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 20px;
}

.dialog__backdrop {
    position: absolute;
    inset: 0;
    background: rgb(5 5 6 / 0.82);
}

.dialog__panel {
    position: relative;
    width: min(760px, 100%);
    max-height: min(88svh, 900px);
    overflow-y: auto;
    background: var(--white);
    color: var(--text);
    box-shadow: 0 40px 100px -30px rgb(0 0 0 / 0.6);
}

.dialog__header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 20px;
    padding: 26px 28px;
    background: var(--black);
    color: var(--white);
    border-bottom: 3px solid var(--accent);

    h3 {
        font-family: var(--serif);
        font-size: clamp(22px, 3vw, 30px);
        line-height: 1.2;
    }
}

.dialog__monogram {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    background: var(--accent);
    color: var(--black);
    font-family: var(--serif);
    font-weight: 700;
    font-size: 22px;
}

.dialog__category {
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.dialog__tagline {
    color: var(--muted-dark);
    font-size: 15px;
}

.dialog__close {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    color: var(--white);
    font-size: 22px;
    transition: color 0.2s, transform 0.3s var(--ease-out);

    &:hover {
        color: var(--yellow);
        transform: rotate(90deg);
    }
}

.dialog__body {
    padding: 28px;

    h4 {
        margin: 28px 0 12px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }
}

.dialog__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
}

.chip {
    padding: 5px 12px;
    background: var(--light);
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.chip--accent {
    background: var(--black);
    color: var(--yellow);
}

.dialog__description {
    font-size: 17px;
    color: var(--text);
}

.dialog__highlights {
    list-style: none;
    display: grid;
    gap: 10px;

    li {
        position: relative;
        padding-left: 26px;
        color: var(--muted);

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0.7em;
            width: 12px;
            height: 2px;
            background: var(--accent);
        }
    }
}

.dialog__stack {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    li {
        padding: 6px 12px;
        background: var(--black);
        color: var(--white);
        font-size: 13px;
        font-weight: 600;
    }
}

.dialog__link {
    margin-top: 32px;
}

.dialog__private {
    margin-top: 32px;
    padding: 14px 18px;
    background: var(--light);
    color: var(--muted);
    font-size: 15px;
}

@media (max-width: 600px) {
    .dialog {
        padding: 0;
        place-items: end stretch;
    }

    .dialog__panel {
        max-height: 92svh;
    }

    .dialog__header {
        grid-template-columns: minmax(0, 1fr) auto;
        padding: 20px;
    }

    .dialog__monogram {
        display: none;
    }

    .dialog__body {
        padding: 22px 20px 32px;
    }
}
</style>

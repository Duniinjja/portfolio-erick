<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { animate, stagger } from 'animejs';
import { stackGroups } from '../../data/portfolio';
import { onceVisible, reducedMotion } from '../../motion';

const root = ref<HTMLElement | null>(null);

onMounted(() => {
    if (!root.value || reducedMotion()) return;
    const groups = root.value.querySelectorAll<HTMLElement>('.group');
    groups.forEach((group) => {
        const badges = group.querySelectorAll<HTMLElement>('.badge');
        badges.forEach((b) => (b.style.opacity = '0'));
        onceVisible(group, () => {
            animate(badges, {
                opacity: [0, 1],
                scale: [0.4, 1],
                translateY: [14, 0],
                duration: 900,
                delay: stagger(45, { start: 200 }),
                ease: 'outElastic(1, 0.6)',
            });
        });
    });
});
</script>

<template>
    <section id="stack" ref="root" class="stack" aria-labelledby="stack-titulo">
        <div class="container">
            <header class="section-head" data-reveal-group>
                <span class="section-kicker" data-reveal>Stack</span>
                <h2 id="stack-titulo" data-split>Do banco ao deploy.</h2>
                <p data-reveal>As ferramentas com que construo e coloco sistemas em produção.</p>
            </header>

            <div class="stack__grid" data-reveal-group>
                <article v-for="group in stackGroups" :key="group.title" class="group" data-reveal>
                    <h3>{{ group.title }}</h3>
                    <ul>
                        <li v-for="item in group.items" :key="item" class="badge">{{ item }}</li>
                    </ul>
                </article>
            </div>
        </div>
    </section>
</template>

<style scoped lang="scss">
.stack {
    padding-block: var(--section);
    background: var(--light);
}

.stack__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
}

.group {
    position: relative;
    padding: 28px 26px 30px;
    background: var(--white);
    overflow: hidden;
    transition: transform 0.35s var(--ease-out), box-shadow 0.35s;

    &::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 3px;
        background: var(--yellow);
        transform: scaleY(0.25);
        transform-origin: top;
        transition: transform 0.5s var(--ease-out);
    }

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 18px 40px -22px rgb(0 0 0 / 0.3);

        &::before {
            transform: scaleY(1);
        }
    }

    h3 {
        font-family: var(--serif);
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 18px;
    }

    ul {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
}

.badge {
    padding: 7px 13px;
    background: var(--light);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    transition: background-color 0.2s, color 0.2s;

    &:hover {
        background: var(--black);
        color: var(--yellow);
    }
}

@media (max-width: 1000px) {
    .stack__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 640px) {
    .stack__grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { animate, stagger } from 'animejs';
import Icon from '../Icon/Icon.vue';
import FeatureVisual from '../FeatureVisual/FeatureVisual.vue';
import ProjectDialog from '../ProjectDialog/ProjectDialog.vue';
import { contact, earlyProjects, projectCategories, projects, type Project, type ProjectCategory } from '../../data/portfolio';
import { onceVisible, reducedMotion } from '../../motion';

const featured = projects.filter((p) => p.featured);
const others = projects.filter((p) => !p.featured);

const filter = ref<ProjectCategory>('Todos');
const visible = computed(() => (filter.value === 'Todos' ? others : others.filter((p) => p.category === filter.value)));
const countOf = (category: ProjectCategory) =>
    category === 'Todos' ? others.length : others.filter((p) => p.category === category).length;

const grid = ref<HTMLElement | null>(null);
const opened = ref<Project | null>(null);
let busy = false;

const cardsIn = () =>
    animate(grid.value!.querySelectorAll('.card'), {
        opacity: [0, 1],
        translateY: [40, 0],
        rotateX: [-18, 0],
        scale: [0.92, 1],
        duration: 800,
        delay: stagger(60),
        ease: 'outExpo',
    });

/** Troca de filtro: os cartões saem em cascata, a grade muda e os novos entram. */
const choose = async (category: ProjectCategory) => {
    if (category === filter.value || busy) return;
    if (reducedMotion() || !grid.value) {
        filter.value = category;
        return;
    }
    busy = true;
    await animate(grid.value.querySelectorAll('.card'), {
        opacity: 0,
        translateY: -16,
        scale: 0.94,
        duration: 260,
        delay: stagger(25),
        ease: 'inQuad',
    });
    filter.value = category;
    await nextTick();
    cardsIn();
    busy = false;
};

onMounted(() => {
    if (!grid.value || reducedMotion()) return;
    grid.value.querySelectorAll<HTMLElement>('.card').forEach((card) => (card.style.opacity = '0'));
    onceVisible(grid.value, cardsIn, 0.1);

    document.querySelectorAll<HTMLElement>('.feature').forEach((feature) => {
        const items = feature.querySelectorAll<HTMLElement>('.feature__highlights li, .feature__stack li');
        items.forEach((item) => (item.style.opacity = '0'));
        (feature.querySelector('.feature__visual') as HTMLElement).style.opacity = '0';
        onceVisible(feature, () => {
            animate(feature.querySelector('.feature__visual')!, {
                opacity: [0, 1],
                translateX: [feature.classList.contains('feature--flip') ? 60 : -60, 0],
                duration: 1100,
                ease: 'outExpo',
            });
            animate(items, { opacity: [0, 1], translateX: [-14, 0], duration: 600, delay: stagger(45, { start: 300 }), ease: 'outQuad' });
        });
    });
});
</script>

<template>
    <section id="projetos" class="projects" aria-labelledby="projetos-titulo">
        <div class="container">
            <header class="section-head" data-reveal-group>
                <span class="section-kicker" data-reveal>Portfólio</span>
                <h2 id="projetos-titulo" data-split>Sistemas que estão no ar.</h2>
                <p data-reveal>
                    Produtos que projetei e construí de ponta a ponta. A maior parte do código é privada; os públicos estão
                    no meu <a :href="contact.github" target="_blank" rel="noopener">GitHub</a>.
                </p>
            </header>

            <article
                v-for="(project, index) in featured"
                :key="project.id"
                :class="['feature', { 'feature--flip': index % 2 === 1 }]"
                :style="{ '--accent': project.accent }"
            >
                <div class="feature__visual">
                    <FeatureVisual :kind="project.id === 'crm' ? 'crm' : 'gestao'" />
                </div>
                <div class="feature__text" data-reveal-group>
                    <p class="feature__kicker" data-reveal>Projeto em destaque · {{ project.status }}</p>
                    <h3 data-reveal>{{ project.name }}</h3>
                    <p class="feature__tagline" data-reveal>{{ project.tagline }}</p>
                    <p class="feature__description" data-reveal>{{ project.description }}</p>
                    <ul class="feature__highlights">
                        <li v-for="item in project.highlights.slice(0, 4)" :key="item">{{ item }}</li>
                    </ul>
                    <ul class="feature__stack">
                        <li v-for="tech in project.stack" :key="tech">{{ tech }}</li>
                    </ul>
                    <div class="feature__footer" data-reveal>
                        <span v-if="project.commits" class="feature__commits">
                            <b :data-count="project.commits">{{ project.commits.toLocaleString('pt-BR') }}</b> commits
                        </span>
                        <button class="btn btn--outline-dark" type="button" @click="opened = project">Ver detalhes</button>
                    </div>
                </div>
            </article>

            <div class="filters" role="group" aria-label="Filtrar projetos por categoria">
                <button
                    v-for="category in projectCategories"
                    :key="category"
                    type="button"
                    :class="['filter', { 'is-active': filter === category }]"
                    :aria-pressed="filter === category"
                    @click="choose(category)"
                >
                    {{ category }} <span>{{ countOf(category) }}</span>
                </button>
            </div>

            <ul ref="grid" class="grid">
                <li v-for="project in visible" :key="project.id" class="card" :style="{ '--accent': project.accent }">
                    <button class="card__button" type="button" @click="opened = project">
                        <span class="card__top">
                            <span class="card__monogram">{{ project.monogram }}</span>
                            <span class="card__status">{{ project.status }}</span>
                        </span>
                        <span class="card__body">
                            <span class="card__category">{{ project.category }}</span>
                            <span class="card__title">{{ project.name }}</span>
                            <span class="card__tagline">{{ project.tagline }}</span>
                            <span class="card__stack">
                                <span v-for="tech in project.stack.slice(0, 4)" :key="tech">{{ tech }}</span>
                            </span>
                            <span class="card__footer">
                                <span v-if="project.commits" class="card__commits">{{ project.commits.toLocaleString('pt-BR') }} commits</span>
                                <span class="card__more">Ver detalhes <Icon name="arrowUpRight" /></span>
                            </span>
                        </span>
                    </button>
                </li>
            </ul>

            <div class="early" data-reveal-group>
                <h3 class="early__title" data-reveal>Onde tudo começou</h3>
                <p class="early__text" data-reveal>Os primeiros projetos públicos, em Python, nasceram de problemas do financeiro.</p>
                <ul class="early__list">
                    <li v-for="item in earlyProjects" :key="item.name" data-reveal>
                        <a :href="item.href" target="_blank" rel="noopener">
                            <img :src="item.image" :alt="`Cartaz do projeto ${item.name}`" width="96" height="96" loading="lazy" />
                            <span>
                                <b>{{ item.name }}</b>
                                <span>{{ item.text }}</span>
                            </span>
                            <Icon name="arrowUpRight" />
                        </a>
                    </li>
                </ul>
            </div>
        </div>

        <ProjectDialog :project="opened" @close="opened = null" />
    </section>
</template>

<style scoped lang="scss">
.projects {
    padding-block: var(--section);
    background: var(--white);

    .section-head a {
        color: var(--text);
        font-weight: 600;
        text-decoration-color: var(--yellow);
        text-decoration-thickness: 2px;
        text-underline-offset: 4px;
    }
}

/* ---------- Destaques ---------- */
.feature {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    align-items: start;
    gap: clamp(32px, 5vw, 72px);
    margin-bottom: clamp(72px, 9vw, 120px);
}

.feature__visual {
    position: sticky;
    top: calc(var(--nav-h) + 32px);
}

.feature--flip .feature__visual {
    order: 2;
}

.feature__kicker {
    color: var(--gold-text);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.feature h3 {
    margin-top: 8px;
    font-family: var(--serif);
    font-size: clamp(28px, 3.2vw, 40px);
    line-height: 1.15;
}

.feature__tagline {
    margin-top: 4px;
    font-weight: 600;
}

.feature__description {
    margin-top: 16px;
    color: var(--muted);
}

.feature__highlights {
    list-style: none;
    display: grid;
    gap: 8px;
    margin-top: 20px;

    li {
        position: relative;
        padding-left: 24px;
        font-size: 15px;

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0.75em;
            width: 12px;
            height: 2px;
            background: var(--yellow);
        }
    }
}

.feature__stack {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 22px;

    li {
        padding: 4px 10px;
        background: var(--light);
        font-size: 13px;
        font-weight: 600;
    }
}

.feature__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 28px;
    margin-top: 30px;
}

.feature__commits {
    color: var(--muted);
    font-size: 14px;

    b {
        color: var(--text);
        font-family: var(--serif);
        font-size: 30px;
        font-variant-numeric: tabular-nums;
    }
}

/* ---------- Filtros ---------- */
.filters {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-bottom: 36px;
}

.filter {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border: 2px solid var(--line);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    transition: border-color 0.2s, background-color 0.2s, color 0.2s, transform 0.2s var(--ease-out);

    span {
        display: grid;
        place-items: center;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        background: var(--light);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
    }

    &:hover {
        border-color: var(--text);
    }

    &:active {
        transform: scale(0.96);
    }

    &.is-active {
        background: var(--black);
        border-color: var(--black);
        color: var(--white);

        span {
            background: var(--yellow);
            color: var(--black);
        }
    }
}

/* ---------- Grade ---------- */
.grid {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    perspective: 1200px;
}

.card {
    display: flex;
}

.card__button {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: var(--white);
    border: 1px solid var(--line);
    text-align: left;
    color: var(--text);
    transition: transform 0.35s var(--ease-out), box-shadow 0.35s, border-color 0.35s;

    &:hover {
        transform: translateY(-6px);
        border-color: transparent;
        box-shadow: 0 24px 50px -24px rgb(0 0 0 / 0.35);

        .card__monogram {
            transform: scale(1.08) rotate(-4deg);
        }

        .card__more .icon {
            transform: translate(2px, -2px);
        }
    }
}

.card__top {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 128px;
    padding: 18px 20px;
    background: var(--black);
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(rgb(255 255 255 / 0.09) 1px, transparent 1px);
        background-size: 14px 14px;
    }

    &::after {
        content: '';
        position: absolute;
        inset: auto 0 0;
        height: 3px;
        background: var(--accent);
    }
}

.card__monogram {
    position: relative;
    display: grid;
    place-items: center;
    min-width: 64px;
    height: 64px;
    padding: 0 10px;
    background: var(--accent);
    color: var(--black);
    font-family: var(--serif);
    font-weight: 700;
    font-size: 20px;
    transition: transform 0.4s var(--ease-out);
}

.card__status {
    position: relative;
    color: var(--white);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.card__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 20px 20px 22px;
}

.card__category {
    color: var(--gold-text);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

.card__title {
    margin-top: 4px;
    font-family: var(--serif);
    font-weight: 700;
    font-size: 20px;
    line-height: 1.25;
}

.card__tagline {
    margin-top: 6px;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.5;
}

.card__stack {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 16px;

    span {
        padding: 3px 9px;
        background: var(--light);
        font-size: 12px;
        font-weight: 600;
    }
}

.card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;
    padding-top: 20px;
}

.card__commits {
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.card__more {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;

    .icon {
        color: var(--gold-text);
        transition: transform 0.25s var(--ease-out);
    }
}

/* ---------- Primeiros projetos ---------- */
.early {
    margin-top: clamp(64px, 8vw, 96px);
    padding: clamp(28px, 4vw, 44px);
    background: var(--light);
}

.early__title {
    font-family: var(--serif);
    font-size: 24px;
}

.early__text {
    color: var(--muted);
    margin-top: 4px;
}

.early__list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-top: 24px;

    a {
        display: flex;
        align-items: center;
        gap: 14px;
        height: 100%;
        padding: 12px;
        background: var(--white);
        text-decoration: none;
        transition: transform 0.3s var(--ease-out);

        &:hover {
            transform: translateY(-3px);
        }
    }

    img {
        width: 64px;
        height: 64px;
        flex-shrink: 0;
        object-fit: cover;
    }

    span span {
        display: block;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
    }

    b {
        font-size: 15px;
    }

    .icon {
        flex-shrink: 0;
        margin-left: auto;
        color: var(--gold-text);
    }
}

@media (max-width: 1000px) {
    .feature {
        grid-template-columns: minmax(0, 1fr);
    }

    .feature--flip .feature__visual {
        order: 0;
    }

    .feature__visual {
        position: static;
    }

    .grid,
    .early__list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 640px) {
    .grid,
    .early__list {
        grid-template-columns: minmax(0, 1fr);
    }

    .filters {
        flex-wrap: nowrap;
        justify-content: flex-start;
        overflow-x: auto;
        margin-inline: calc(var(--gutter) * -1);
        padding-inline: var(--gutter);
        scrollbar-width: none;
    }

    .filter {
        flex-shrink: 0;
    }
}
</style>

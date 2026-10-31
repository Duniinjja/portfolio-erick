<script setup lang="ts">
import { experienceList } from '../../helper/experienceList';
import { capabilities } from '../../data/portfolio';

const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const period = (date: string) => {
    if (date === 'Atual') return 'Presente';
    const [, month, year] = date.split('/');
    return `${months[Number(month) - 1]} ${year}`;
};

const jobs = [...experienceList].reverse();
</script>

<template>
    <section id="experiencia" class="experience" aria-labelledby="experiencia-titulo">
        <div class="container">
            <header class="section-head" data-reveal-group>
                <span class="section-kicker" data-reveal>Experiência</span>
                <h2 id="experiencia-titulo" data-split>Minha trajetória.</h2>
                <p data-reveal>Da análise de dados no financeiro à engenharia de sistemas completos.</p>
            </header>

            <div class="experience__grid">
                <div>
                    <h3 class="experience__subtitle">Experiência profissional.</h3>
                    <ol class="timeline">
                        <li v-for="job in jobs" :key="job.companyName" class="timeline__item" data-reveal-group>
                            <span class="timeline__dot" aria-hidden="true"></span>
                            <div class="timeline__body">
                                <p class="timeline__date" data-reveal>{{ period(job.startAt) }} – {{ period(job.endAt) }}</p>
                                <div class="timeline__head" data-reveal>
                                    <img :src="`/${job.companyImage}`" :alt="`Logo ${job.companyName}`" width="48" height="48" loading="lazy" />
                                    <div>
                                        <h4>{{ job.companyName }}</h4>
                                        <p class="timeline__role">{{ job.position }} · {{ job.locale }}</p>
                                    </div>
                                </div>
                                <p class="timeline__text" data-reveal>{{ job.description }}</p>
                                <ul v-if="job.highlights" class="timeline__highlights">
                                    <li v-for="item in job.highlights" :key="item" data-reveal>{{ item }}</li>
                                </ul>
                            </div>
                        </li>
                    </ol>
                </div>

                <div data-reveal-group>
                    <h3 class="experience__subtitle" data-reveal>O que eu entrego.</h3>
                    <div class="capabilities">
                        <article v-for="item in capabilities" :key="item.title" class="capability" data-reveal>
                            <h4>{{ item.title }}</h4>
                            <p>{{ item.text }}</p>
                        </article>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped lang="scss">
.experience {
    padding-block: var(--section);
    background: var(--light);
}

.experience__grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: clamp(40px, 7vw, 96px);
}

.experience__subtitle {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 32px;
}

.timeline {
    position: relative;
    list-style: none;

    &::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 6px;
        bottom: 0;
        width: 1px;
        background: #d6d6d3;
    }
}

.timeline__item {
    position: relative;
    padding-left: 44px;
    padding-bottom: 48px;

    &:last-child {
        padding-bottom: 0;
    }
}

.timeline__dot {
    position: absolute;
    left: 0;
    top: 5px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--black);
    box-shadow: 0 0 0 5px #e4e4e1;
}

.timeline__item:first-child .timeline__dot {
    background: var(--yellow);
    box-shadow: 0 0 0 5px rgb(242 194 0 / 0.3);
    animation: pulse 2.2s ease-out infinite;
}

@keyframes pulse {
    50% {
        box-shadow: 0 0 0 10px rgb(242 194 0 / 0.08);
    }
}

.timeline__date {
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.timeline__head {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 10px;

    img {
        width: 48px;
        height: 48px;
        object-fit: contain;
        padding: 4px;
        background: var(--white);
    }

    h4 {
        font-size: 19px;
        font-weight: 600;
        line-height: 1.3;
    }
}

.timeline__role {
    font-size: 13px;
    font-weight: 600;
}

.timeline__text {
    margin-top: 14px;
    color: var(--muted);
}

.timeline__highlights {
    list-style: none;
    display: grid;
    gap: 8px;
    margin-top: 14px;

    li {
        position: relative;
        padding-left: 22px;
        font-size: 15px;

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0.75em;
            width: 10px;
            height: 2px;
            background: var(--yellow);
        }
    }
}

.capabilities {
    display: grid;
    gap: 16px;
}

.capability {
    padding: 24px 26px;
    background: var(--white);
    border-left: 3px solid var(--yellow);
    transition: transform 0.3s var(--ease-out);

    &:hover {
        transform: translateX(6px);
    }

    h4 {
        font-family: var(--serif);
        font-size: 18px;
        margin-bottom: 6px;
    }

    p {
        color: var(--muted);
        font-size: 15px;
    }
}

@media (max-width: 860px) {
    .experience__grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>

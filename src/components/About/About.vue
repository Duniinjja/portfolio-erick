<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { animate, stagger } from 'animejs';
import Icon from '../Icon/Icon.vue';
import { contact, projects, skillAreas } from '../../data/portfolio';
import { reducedMotion } from '../../motion';

const SHOWN = 4;

/** Cada área lista os projetos do portfólio que a usam: o stack começa com um dos termos ou o projeto é da categoria. */
const areas = skillAreas.map((area) => {
    const uses: readonly string[] = 'uses' in area ? area.uses : [];
    const used = projects.filter(
        (project) =>
            ('category' in area && project.category === area.category) ||
            project.stack.some((item) => uses.some((term) => item.startsWith(term))),
    );
    return {
        ...area,
        count: used.length,
        shown: used.slice(0, SHOWN).map((project) => project.name),
        more: Math.max(0, used.length - SHOWN),
        also: 'also' in area ? area.also : [],
    };
});

const list = ref<HTMLElement | null>(null);

/** As etiquetas de projeto entram em cascata quando a lista aparece. */
onMounted(() => {
    const el = list.value;
    if (!el || reducedMotion()) return;

    const tags = el.querySelectorAll<HTMLElement>('.skill__tags li');
    tags.forEach((tag) => (tag.style.opacity = '0'));

    const observer = new IntersectionObserver(
        ([entry]) => {
            if (!entry?.isIntersecting) return;
            observer.disconnect();
            animate(tags, { opacity: [0, 1], scale: [0.7, 1], duration: 500, delay: stagger(28, { start: 300 }), ease: 'outBack(2)' });
        },
        { threshold: 0.25 },
    );
    observer.observe(el);
});
</script>

<template>
    <section id="sobre" class="about" aria-labelledby="sobre-titulo">
        <div class="container">
            <header class="section-head" data-reveal-group>
                <span class="section-kicker" data-reveal>Sobre</span>
                <h2 id="sobre-titulo" data-split>Um pouco sobre mim.</h2>
                <p data-reveal>Quem sou, o que faço e as ferramentas que uso todo dia.</p>
            </header>

            <div class="about__grid">
                <div class="about__intro" data-reveal-group>
                    <h3 data-reveal>Olá!</h3>
                    <p data-reveal>
                        Sou engenheiro de software full stack e construo sistemas completos: do modelo de dados ao deploy,
                        passando pela API, pela interface e pelo monitoramento em produção.
                    </p>
                    <p data-reveal>
                        Comecei na análise de dados, no financeiro da DOW Chemical, automatizando rotinas com Python e Excel.
                        Hoje, na <strong>Wertice Educação e Tecnologia</strong>, desenvolvo as plataformas da operação: um CRM com WhatsApp e IA
                        generativa, um SaaS financeiro multiempresa, APIs com dados oficiais e plataformas de ensino. Foram mais
                        de <strong>7.800 contribuições no GitHub</strong> no último ano.
                    </p>
                    <p data-reveal>
                        Também sou fundador da <a href="#woltek">Woltek</a>, meu estúdio de engenharia de software, com
                        três produtos SaaS próprios em produção que, juntos, atendem mais de 35 clientes.
                    </p>
                    <p data-reveal>
                        A base em dados continua comigo: antes de escrever código, eu entendo o processo e o número que a
                        pessoa precisa ver.
                    </p>

                    <div class="about__actions" data-reveal>
                        <a class="btn btn--yellow" :href="contact.cv" download="ErickAlves-CV.pdf">
                            <Icon name="download" /> Baixar currículo
                        </a>
                        <a class="btn btn--outline-dark" href="#contato">Fale comigo</a>
                    </div>
                </div>

                <div class="about__skills" data-reveal-group>
                    <h3 data-reveal>Minhas principais habilidades.</h3>
                    <p class="skills__note" data-reveal>Medidas pelos projetos em que cada uma está em uso, não por porcentagem.</p>
                    <ul ref="list" class="skills">
                        <li v-for="area in areas" :key="area.name" class="skill" data-reveal>
                            <div class="skill__head">
                                <span class="skill__name">{{ area.name }}</span>
                                <span class="skill__count">
                                    <strong :data-count="area.count">{{ area.count }}</strong>
                                    {{ area.count === 1 ? 'projeto' : 'projetos' }}
                                </span>
                            </div>
                            <p class="skill__text">{{ area.text }}</p>
                            <ul class="skill__tags" :aria-label="`Onde uso ${area.name}`">
                                <li v-for="name in area.shown" :key="name">{{ name }}</li>
                                <li v-if="area.more" class="skill__more">+{{ area.more }}</li>
                                <li v-for="place in area.also" :key="place" class="skill__also">{{ place }}</li>
                            </ul>
                        </li>
                    </ul>
                    <a class="skills__link" href="#projetos">Ver todos os projetos <Icon name="arrowUpRight" /></a>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped lang="scss">
.about {
    padding-block: var(--section);
    background: var(--white);
}

.about__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: clamp(40px, 7vw, 96px);
}

h3 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 22px;
}

.about__intro p {
    color: var(--muted);
    font-size: 16px;

    & + p {
        margin-top: 18px;
    }

    strong {
        color: var(--text);
        font-weight: 600;
    }
}

.about__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 36px;
}

.skills__note {
    margin: -10px 0 26px;
    color: var(--muted);
    font-size: 14px;
}

.skills {
    list-style: none;
    display: grid;
    border-top: 1px solid var(--line);
}

.skill {
    padding: 18px 0;
    border-bottom: 1px solid var(--line);
}

.skill__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
}

.skill__name {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.skill__count {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;

    strong {
        color: var(--text);
        font-family: var(--serif);
        font-size: 22px;
        font-variant-numeric: tabular-nums;
    }
}

.skill__text {
    margin-top: 4px;
    color: var(--muted);
    font-size: 14px;
}

.skill__tags {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;

    li {
        padding: 4px 10px;
        background: var(--text);
        color: var(--white);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.4;
    }

    .skill__more {
        background: var(--yellow);
        color: var(--black);
    }

    .skill__also {
        background: transparent;
        color: var(--text);
        box-shadow: inset 0 0 0 1px var(--line);
    }
}

.skills__link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin-top: 14px;
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--yellow);
    text-decoration-thickness: 2px;
    text-underline-offset: 5px;
}

@media (max-width: 860px) {
    .about__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .about__actions .btn {
        flex: 1 1 200px;
    }
}
</style>

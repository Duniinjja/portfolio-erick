<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { animate, stagger } from 'animejs';
import Icon from '../Icon/Icon.vue';
import { contact, skillLevels } from '../../data/portfolio';
import { reducedMotion } from '../../motion';

const bars = ref<HTMLElement | null>(null);

/** As barras crescem até o nível de cada habilidade quando entram na tela. */
onMounted(() => {
    const list = bars.value;
    if (!list || reducedMotion()) return;

    const fills = list.querySelectorAll<HTMLElement>('.skill__fill');
    const tags = list.querySelectorAll<HTMLElement>('.skill__value');
    fills.forEach((fill) => (fill.style.transform = 'scaleX(0)'));
    tags.forEach((tag) => (tag.style.opacity = '0'));

    const observer = new IntersectionObserver(
        ([entry]) => {
            if (!entry?.isIntersecting) return;
            observer.disconnect();
            animate(fills, { scaleX: [0, 1], duration: 1600, delay: stagger(120), ease: 'outExpo' });
            animate(tags, { opacity: [0, 1], translateY: [6, 0], duration: 600, delay: stagger(120, { start: 700 }), ease: 'outQuad' });
        },
        { threshold: 0.35 },
    );
    observer.observe(list);
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
                        Hoje, no <strong>Grupo UOP</strong>, desenvolvo as plataformas da operação: um CRM com WhatsApp e IA
                        generativa, um SaaS financeiro multiempresa, APIs com dados oficiais e plataformas de ensino. Foram mais
                        de <strong>7.800 contribuições no GitHub</strong> no último ano.
                    </p>
                    <p data-reveal>
                        Também sou fundador da <a href="#woltek">Woltek</a>, meu estúdio de engenharia de software, com
                        mais de 35 clientes ativos e três produtos SaaS próprios em produção.
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
                    <ul ref="bars" class="skills">
                        <li v-for="skill in skillLevels" :key="skill.name" class="skill" data-reveal>
                            <span class="skill__name">{{ skill.name }}</span>
                            <span class="skill__track" role="meter" :aria-valuenow="skill.level" aria-valuemin="0" aria-valuemax="100" :aria-label="skill.name">
                                <span class="skill__fill" :style="{ width: `${skill.level}%` }"></span>
                                <span class="skill__value" :style="{ left: `${skill.level}%` }">{{ skill.level }}%</span>
                            </span>
                        </li>
                    </ul>
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

.skills {
    list-style: none;
    display: grid;
    gap: 30px;
    padding-top: 8px;
}

.skill__name {
    display: block;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.skill__track {
    position: relative;
    display: block;
    height: 6px;
    background: var(--line);
}

.skill__fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--text);
    transform-origin: left;

    &::after {
        content: '';
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 34%;
        background: var(--yellow);
    }
}

.skill__value {
    position: absolute;
    bottom: calc(100% + 10px);
    translate: calc(-100% + 2px) 0;
    padding: 3px 7px;
    background: var(--black);
    color: var(--white);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.4;

    &::after {
        content: '';
        position: absolute;
        right: 6px;
        top: 100%;
        border: 5px solid transparent;
        border-top-color: var(--black);
    }
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

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from '../Icon/Icon.vue';
import { navItems, socials } from '../../data/portfolio';

const year = new Date().getFullYear();
const showTop = ref(false);
const onScroll = () => (showTop.value = window.scrollY > window.innerHeight * 0.8);

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
    <footer class="footer">
        <div class="footer__inner container">
            <a class="footer__brand" href="#inicio">Erick Alves<span>.</span></a>
            <nav class="footer__nav" aria-label="Rodapé">
                <a v-for="item in navItems" :key="item.id" :href="`#${item.id}`">{{ item.label }}</a>
            </nav>
            <ul class="footer__socials" aria-label="Redes">
                <li v-for="social in socials" :key="social.label">
                    <a :href="social.href" target="_blank" rel="noopener" :aria-label="social.label">
                        <Icon :name="social.icon" />
                    </a>
                </li>
            </ul>
        </div>
        <p class="footer__copy container">
            © {{ year }} Erick Alves · Fundador da
            <a href="https://woltek.com.br/" target="_blank" rel="noopener">Woltek</a>.
            <a class="footer__replay" href="?construir=1" rel="nofollow">Ver o site se construir</a>
        </p>

        <Transition name="fade">
            <a v-show="showTop" class="footer__top" href="#inicio" aria-label="Voltar ao topo">
                <Icon name="arrowUp" />
            </a>
        </Transition>
    </footer>
</template>

<style scoped lang="scss">
.footer {
    background: var(--black);
    color: var(--white);
    padding-block: 56px 32px;
}

.footer__inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--line-dark);
}

.footer__brand {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-family: var(--serif);
    font-weight: 700;
    font-size: 24px;
    text-decoration: none;

    span {
        color: var(--yellow);
    }
}

.footer__nav {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 26px;

    a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 44px;
        min-height: 44px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        text-decoration: none;
        transition: color 0.2s;

        &:hover {
            color: var(--yellow);
        }
    }
}

.footer__socials {
    list-style: none;
    display: flex;
    gap: 4px;

    a {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        font-size: 17px;
        transition: color 0.2s, transform 0.25s var(--ease-out);

        &:hover {
            color: var(--yellow);
            transform: translateY(-3px);
        }
    }
}

.footer__copy {
    padding-top: 24px;
    color: var(--muted-dark);
    font-size: 14px;

    a {
        color: var(--white);
        text-underline-offset: 3px;
    }
}

.footer__replay {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-left: 12px;
}

.footer__top {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 40;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    background: var(--yellow);
    color: var(--black);
    font-size: 20px;
    transition: transform 0.25s var(--ease-out), background-color 0.2s;

    &:hover {
        transform: translateY(-3px);
        background: var(--yellow-2);
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

@media (max-width: 760px) {
    .footer__inner {
        flex-direction: column;
        align-items: flex-start;
    }

    .footer__replay {
        display: flex;
        margin-left: 0;
    }
}
</style>

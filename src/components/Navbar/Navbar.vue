<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '../Icon/Icon.vue';
import { contact, navItems } from '../../data/portfolio';

const solid = ref(false);
const active = ref('inicio');
const open = ref(false);
const firstLink = ref<HTMLAnchorElement | null>(null);
const toggleBtn = ref<HTMLButtonElement | null>(null);

const onScroll = () => {
    solid.value = window.scrollY > 40;
};

const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open.value) {
        open.value = false;
        toggleBtn.value?.focus();
    }
};

watch(open, async (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (isOpen) {
        await nextTick();
        firstLink.value?.focus();
    }
});

let observer: IntersectionObserver | null = null;

onMounted(() => {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);

    // Marca no menu a seção que ocupa o meio da tela.
    observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) active.value = entry.target.id;
            });
        },
        { rootMargin: '-45% 0px -50% 0px' },
    );
    navItems.forEach((item) => {
        const section = document.getElementById(item.id);
        if (section) observer?.observe(section);
    });
});

onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('keydown', onKey);
    observer?.disconnect();
    document.body.style.overflow = '';
});
</script>

<template>
    <header :class="['navbar', { 'is-solid': solid || open }]">
        <div class="navbar__inner container">
            <a class="navbar__brand" href="#inicio" aria-label="Erick Alves, voltar ao início">
                Erick<span>.</span>
            </a>

            <nav class="navbar__links" aria-label="Seções">
                <a
                    v-for="item in navItems"
                    :key="item.id"
                    :href="`#${item.id}`"
                    :class="{ 'is-active': active === item.id }"
                    :aria-current="active === item.id ? 'true' : undefined"
                >
                    {{ item.label }}
                </a>
                <a class="navbar__cv" :href="contact.cv" download="ErickAlves-CV.pdf">
                    <Icon name="download" /> CV
                </a>
            </nav>

            <button
                ref="toggleBtn"
                class="navbar__toggle"
                type="button"
                :aria-expanded="open"
                aria-controls="menu-celular"
                :aria-label="open ? 'Fechar menu' : 'Abrir menu'"
                @click="open = !open"
            >
                <Icon :name="open ? 'close' : 'menu'" />
            </button>
        </div>

        <Transition name="drawer">
            <nav v-if="open" id="menu-celular" class="drawer" aria-label="Seções">
                <a
                    v-for="(item, index) in navItems"
                    :key="item.id"
                    :ref="index === 0 ? (el) => (firstLink = el as HTMLAnchorElement) : undefined"
                    :href="`#${item.id}`"
                    :class="{ 'is-active': active === item.id }"
                    @click="open = false"
                >
                    {{ item.label }}
                </a>
                <a class="btn btn--yellow drawer__cv" :href="contact.cv" download="ErickAlves-CV.pdf" @click="open = false">
                    <Icon name="download" /> Baixar currículo
                </a>
            </nav>
        </Transition>
    </header>
</template>

<style scoped lang="scss">
.navbar {
    position: fixed;
    inset: 0 0 auto;
    z-index: 50;
    background: var(--black);
    transition: box-shadow 0.35s;

    &.is-solid {
        box-shadow: 0 1px 0 var(--line-dark);
    }
}

.navbar__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--nav-h);
}

.navbar__brand {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--white);
    font-family: var(--serif);
    font-weight: 700;
    font-size: 24px;
    text-decoration: none;

    span {
        color: var(--yellow);
    }
}

.navbar__links {
    display: flex;
    align-items: center;
    gap: clamp(18px, 2.4vw, 34px);

    a {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        color: var(--white);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        text-decoration: none;
        transition: color 0.2s;

        &::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0.18em;
            bottom: 8px;
            height: 2px;
            background: var(--yellow);
            transform: scaleX(0);
            transform-origin: left;
            transition: transform 0.3s var(--ease-out);
        }

        &:hover,
        &.is-active {
            color: var(--yellow);
        }

        &:hover::after,
        &.is-active::after {
            transform: scaleX(1);
        }
    }
}

.navbar__cv {
    padding: 0 16px;
    border: 2px solid var(--yellow);
    color: var(--yellow) !important;

    &::after {
        display: none;
    }

    &:hover {
        background: var(--yellow);
        color: var(--black) !important;
    }

    .icon {
        font-size: 14px;
    }
}

.navbar__toggle {
    display: none;
    width: 48px;
    height: 48px;
    margin-right: -12px;
    place-items: center;
    color: var(--white);
    font-size: 26px;
}

.drawer {
    position: fixed;
    inset: var(--nav-h) 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 24px var(--gutter) 40px;
    background: var(--black);
    overflow-y: auto;

    a:not(.btn) {
        display: flex;
        align-items: center;
        min-height: 56px;
        color: var(--white);
        font-family: var(--serif);
        font-size: 26px;
        text-decoration: none;
        border-bottom: 1px solid var(--line-dark);

        &.is-active {
            color: var(--yellow);
        }
    }
}

.drawer__cv {
    margin-top: 28px;
}

.drawer-enter-active,
.drawer-leave-active {
    transition: opacity 0.3s, transform 0.4s var(--ease-out);
}

.drawer-enter-from,
.drawer-leave-to {
    opacity: 0;
    transform: translateY(-12px);
}

@media (max-width: 900px) {
    .navbar__links {
        display: none;
    }

    .navbar__toggle {
        display: grid;
    }
}
</style>

import { animate, splitText, stagger } from 'animejs';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Cada `[data-reveal-group]` entra uma vez quando aparece na tela: título, texto e
 * imagem sobem em sequência. Títulos com `data-split` entram letra por letra.
 * Sem script ou com movimento reduzido, tudo já está visível.
 */
export const setupReveals = () => {
    if (reducedMotion()) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);

                const parts = entry.target.querySelectorAll<HTMLElement>('[data-reveal]');
                animate(parts, {
                    opacity: [0, 1],
                    translateY: [28, 0],
                    duration: 900,
                    delay: stagger(75),
                    ease: 'outExpo',
                });

                entry.target.querySelectorAll<HTMLElement>('[data-split]').forEach((title) => {
                    const { chars } = splitText(title, { chars: true });
                    title.style.opacity = '1';
                    animate(chars, {
                        opacity: [0, 1],
                        translateY: ['0.6em', 0],
                        rotate: [8, 0],
                        duration: 800,
                        delay: stagger(22, { start: 120 }),
                        ease: 'outBack(1.4)',
                    });
                });
            });
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    document.querySelectorAll('[data-reveal-group]').forEach((group) => observer.observe(group));
};

/** Conta de 0 até o valor de cada `[data-count]` quando entra na tela. */
export const setupCounters = () => {
    const counters = document.querySelectorAll<HTMLElement>('[data-count]');
    if (reducedMotion()) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);

                const el = entry.target as HTMLElement;
                const target = Number(el.dataset.count);
                const state = { value: 0 };
                animate(state, {
                    value: target,
                    duration: 2000,
                    ease: 'outQuart',
                    onUpdate: () => {
                        el.textContent = Math.round(state.value).toLocaleString('pt-BR');
                    },
                });
            });
        },
        { threshold: 0.6 },
    );

    counters.forEach((el) => observer.observe(el));
};

/** Roda `callback` uma vez quando o elemento entra na tela. */
export const onceVisible = (el: Element, callback: () => void, threshold = 0.25) => {
    const observer = new IntersectionObserver(
        ([entry]) => {
            if (!entry?.isIntersecting) return;
            observer.disconnect();
            callback();
        },
        { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
};

<script setup lang="ts">
import { reactive, ref } from 'vue';
import Icon from '../Icon/Icon.vue';
import { contact } from '../../data/portfolio';

const channels = [
    { icon: 'mail', label: 'E-mail', value: contact.email, href: `mailto:${contact.email}` },
    { icon: 'whatsapp', label: 'WhatsApp', value: contact.phone, href: contact.whatsapp },
    { icon: 'linkedin', label: 'LinkedIn', value: 'in/erickalvesn', href: contact.linkedin },
    { icon: 'github', label: 'GitHub', value: 'Duniinjja', href: contact.github },
    { icon: 'kaggle', label: 'Kaggle', value: 'erickalves12', href: contact.kaggle },
];

const form = reactive({ name: '', email: '', subject: '', message: '' });
const errors = reactive({ name: '', message: '' });
const sent = ref(false);

const send = () => {
    errors.name = form.name.trim() ? '' : 'Diga o seu nome.';
    errors.message = form.message.trim() ? '' : 'Escreva a sua mensagem.';
    if (errors.name || errors.message) return;

    const subject = form.subject.trim() || `Contato pelo portfólio — ${form.name.trim()}`;
    const signature = [form.name.trim(), form.email.trim()].filter(Boolean).join('\n');
    const body = `${form.message.trim()}\n\n${signature}`;
    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    sent.value = true;
};
</script>

<template>
    <section id="contato" class="contact" aria-labelledby="contato-titulo">
        <div class="container">
            <header class="section-head section-head--dark" data-reveal-group>
                <span class="section-kicker" data-reveal>Contato</span>
                <h2 id="contato-titulo" data-split>Vamos conversar.</h2>
                <p data-reveal>Gostou do meu perfil? Fale comigo pelo canal que preferir.</p>
            </header>

            <div class="contact__grid">
                <ul class="channels" data-reveal-group>
                    <li v-for="channel in channels" :key="channel.label" data-reveal>
                        <a class="channel" :href="channel.href" target="_blank" rel="noopener">
                            <span class="channel__icon"><Icon :name="channel.icon" /></span>
                            <span>
                                <span class="channel__label">{{ channel.label }}</span>
                                <span class="channel__value">{{ channel.value }}</span>
                            </span>
                        </a>
                    </li>
                    <li class="channel channel--static" data-reveal>
                        <span class="channel__icon"><Icon name="pin" /></span>
                        <span>
                            <span class="channel__label">Localização</span>
                            <span class="channel__value">{{ contact.city }}</span>
                        </span>
                    </li>
                </ul>

                <form class="form" novalidate data-reveal-group @submit.prevent="send">
                    <div class="form__row" data-reveal>
                        <div class="field">
                            <label for="c-nome">Nome</label>
                            <input
                                id="c-nome"
                                v-model="form.name"
                                type="text"
                                autocomplete="name"
                                :aria-invalid="Boolean(errors.name)"
                                aria-describedby="c-nome-erro"
                            />
                            <p id="c-nome-erro" class="field__error">{{ errors.name }}</p>
                        </div>
                        <div class="field">
                            <label for="c-email">E-mail <span>(opcional)</span></label>
                            <input id="c-email" v-model="form.email" type="email" inputmode="email" autocomplete="email" />
                        </div>
                    </div>
                    <div class="field" data-reveal>
                        <label for="c-assunto">Assunto <span>(opcional)</span></label>
                        <input id="c-assunto" v-model="form.subject" type="text" />
                    </div>
                    <div class="field" data-reveal>
                        <label for="c-mensagem">Mensagem</label>
                        <textarea
                            id="c-mensagem"
                            v-model="form.message"
                            rows="5"
                            :aria-invalid="Boolean(errors.message)"
                            aria-describedby="c-mensagem-erro"
                        ></textarea>
                        <p id="c-mensagem-erro" class="field__error">{{ errors.message }}</p>
                    </div>
                    <div class="form__footer" data-reveal>
                        <button class="btn btn--yellow" type="submit">Enviar mensagem</button>
                        <p v-if="sent" class="form__status" role="status">
                            O seu programa de e-mail abriu com a mensagem pronta. É só enviar.
                        </p>
                        <p v-else class="form__hint">Abre o seu programa de e-mail com a mensagem preenchida.</p>
                    </div>
                </form>
            </div>
        </div>
    </section>
</template>

<style scoped lang="scss">
.contact {
    padding-block: var(--section);
    background: var(--dark);
    color: var(--white);
}

.contact__grid {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: clamp(40px, 6vw, 80px);
}

.channels {
    list-style: none;
    display: grid;
    gap: 10px;
    align-content: start;
}

.channel {
    display: flex;
    align-items: center;
    gap: 18px;
    min-height: 72px;
    padding: 14px 18px;
    background: var(--dark-2);
    color: var(--white);
    text-decoration: none;
    transition: background-color 0.25s, transform 0.25s var(--ease-out);

    &:not(.channel--static):hover {
        background: var(--dark-3);
        transform: translateX(6px);

        .channel__icon {
            background: var(--yellow);
            color: var(--black);
        }
    }

    > span:last-child {
        min-width: 0;
    }
}

.channel__icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border: 1px solid var(--line-dark);
    color: var(--yellow);
    font-size: 18px;
    transition: background-color 0.25s, color 0.25s;
}

.channel__label {
    display: block;
    color: var(--muted-dark);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    line-height: 1.5;
}

.channel__value {
    display: block;
    font-weight: 500;
    overflow-wrap: anywhere;
    line-height: 1.5;
}

.form {
    display: grid;
    gap: 6px;
}

.form__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
}

.field {
    display: grid;
    align-content: start;
    gap: 8px;

    label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;

        span {
            color: var(--muted-dark);
            font-weight: 500;
            letter-spacing: 0.04em;
            text-transform: none;
        }
    }

    input,
    textarea {
        width: 100%;
        min-height: 52px;
        padding: 13px 16px;
        background: var(--dark-2);
        border: 1px solid var(--line-dark);
        border-radius: 0;
        color: var(--white);
        font-size: 16px;
        transition: border-color 0.2s, background-color 0.2s;
        resize: vertical;

        &:hover {
            border-color: #45454c;
        }

        &:focus-visible {
            outline: none;
            border-color: var(--yellow);
            background: var(--dark-3);
        }

        &[aria-invalid='true'] {
            border-color: #ff8a80;
        }
    }
}

.field__error {
    min-height: 22px;
    color: #ff9e96;
    font-size: 13px;
    font-weight: 500;
}

.form__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 24px;
    margin-top: 6px;
}

.form__hint,
.form__status {
    color: var(--muted-dark);
    font-size: 14px;
}

.form__status {
    color: var(--yellow);
}

@media (max-width: 860px) {
    .contact__grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .form__row {
        grid-template-columns: minmax(0, 1fr);
        gap: 6px;
    }

    .form__footer .btn {
        width: 100%;
    }
}
</style>

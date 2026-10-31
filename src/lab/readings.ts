/** Leituras do rosto a partir das expressões (blendshapes) do MediaPipe, cada uma de 0 a 1. */
export type Blend = Record<string, number>;

export const toBlend = (categories: { categoryName: string; score: number }[] = []): Blend =>
    Object.fromEntries(categories.map((c) => [c.categoryName, c.score]));

const pair = (b: Blend, name: string) => ((b[`${name}Left`] ?? 0) + (b[`${name}Right`] ?? 0)) / 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ---------- Humor ---------- */

export const moods = [
    { id: 'feliz', label: 'Feliz', emoji: '😄', quip: 'Cara de quem viu o build passar de primeira.' },
    { id: 'surpreso', label: 'Surpreso', emoji: '😮', quip: 'Funcionou em produção e você não sabe por quê.' },
    { id: 'bravo', label: 'Bravo', emoji: '😠', quip: 'Alguém deu push direto na main.' },
    { id: 'triste', label: 'Triste', emoji: '😢', quip: 'O merge deu 47 conflitos.' },
    { id: 'neutro', label: 'Concentrado', emoji: '🧐', quip: 'Modo foco: lendo o log linha por linha.' },
] as const;

export type MoodId = (typeof moods)[number]['id'];

/**
 * Pontua cada humor; o maior vence. Cada expressão tem um "repouso" (um rosto sério já franze um pouco a
 * sobrancelha), descontado antes de pontuar. "Concentrado" tem um piso para o rosto parado não pular entre humores.
 */
export const scoreMoods = (b: Blend): Record<MoodId, number> => {
    const rest = (value: number, base: number) => Math.max(0, value - base);
    const smile = rest(pair(b, 'mouthSmile'), 0.08);
    const frown = rest(pair(b, 'mouthFrown'), 0.06);
    const browDown = rest(pair(b, 'browDown'), 0.25);
    const browUp = rest(b.browInnerUp ?? 0, 0.12);
    const wide = rest(pair(b, 'eyeWide'), 0.2);
    const jaw = rest(b.jawOpen ?? 0, 0.06);
    const sneer = rest(pair(b, 'noseSneer'), 0.05);
    const press = rest(pair(b, 'mouthPress'), 0.15);

    return {
        feliz: clamp01(smile * 1.4),
        surpreso: clamp01(jaw * 0.9 + browUp * 0.6 + wide * 1.2 - smile * 0.6),
        bravo: clamp01(browDown * 1.8 + sneer * 1.2 + press * 0.5 - smile),
        triste: clamp01(frown * 2.4 + browUp * 0.4 - smile - jaw * 0.5),
        neutro: 0.3,
    };
};

/** Suaviza as pontuações quadro a quadro (o rosto treme, a leitura não deve tremer). */
export class MoodMeter {
    values: Record<MoodId, number> = { feliz: 0, surpreso: 0, bravo: 0, triste: 0, neutro: 0.3 };

    update(b: Blend) {
        const next = scoreMoods(b);
        for (const key of Object.keys(next) as MoodId[]) {
            this.values[key] += (next[key] - this.values[key]) * 0.18;
        }
        return this.winner;
    }

    get winner(): MoodId {
        return (Object.keys(this.values) as MoodId[]).reduce((a, b) => (this.values[b] > this.values[a] ? b : a));
    }
}

/* ---------- Reações (valem em qualquer modo) ---------- */

export type ReactionId = 'dormindo' | 'acordou' | 'piscadinha' | 'sorriso' | 'beijo' | 'susto' | 'lingua' | 'tchau';

/**
 * Reconhece reações que duram um instante: cada uma precisa se manter por um tempo mínimo (evita disparo por
 * engano) e tem um intervalo antes de valer de novo. Dormir é um estado: começa com os dois olhos fechados por
 * 1,5 s e termina quando eles abrem ("acordou").
 */
export class ReactionMeter {
    asleep = false;
    private since = new Map<string, number>();
    private until = new Map<string, number>();

    /** Quanto tempo a condição está valendo (0 se não está). */
    private held(key: string, on: boolean, t: number) {
        if (!on) {
            this.since.delete(key);
            return 0;
        }
        if (!this.since.has(key)) this.since.set(key, t);
        return t - this.since.get(key)!;
    }

    private ready(key: string, t: number, cooldown: number) {
        if (t < (this.until.get(key) ?? 0)) return false;
        this.until.set(key, t + cooldown);
        return true;
    }

    update(b: Blend, t: number): ReactionId | null {
        const blinkL = b.eyeBlinkLeft ?? 0;
        const blinkR = b.eyeBlinkRight ?? 0;
        const closed = blinkL > 0.5 && blinkR > 0.5;

        if (this.held('olhos', closed, t) > 1.5 && !this.asleep) {
            this.asleep = true;
            return 'dormindo';
        }
        if (this.asleep && !closed) {
            this.asleep = false;
            return 'acordou';
        }
        if (this.asleep) return null;

        const wink = (blinkL > 0.55 && blinkR < 0.3) || (blinkR > 0.55 && blinkL < 0.3);
        const smile = pair(b, 'mouthSmile');
        const pucker = b.mouthPucker ?? 0;
        const jaw = b.jawOpen ?? 0;
        const scared = jaw > 0.45 && ((b.browInnerUp ?? 0) > 0.45 || pair(b, 'eyeWide') > 0.4);

        if (this.held('piscadinha', wink, t) > 0.18 && this.ready('piscadinha', t, 2)) return 'piscadinha';
        if (this.held('lingua', (b.tongueOut ?? 0) > 0.4, t) > 0.3 && this.ready('lingua', t, 4)) return 'lingua';
        if (this.held('susto', scared, t) > 0.25 && this.ready('susto', t, 4)) return 'susto';
        if (this.held('beijo', pucker > 0.6 && smile < 0.3, t) > 0.4 && this.ready('beijo', t, 4)) return 'beijo';
        if (this.held('sorriso', smile > 0.6, t) > 0.6 && this.ready('sorriso', t, 5)) return 'sorriso';
        return null;
    }
}

/**
 * Tchau: a mão aberta indo e voltando. Conta as viradas de direção do pulso (com amplitude mínima) no último
 * 1,2 s; três viradas valem um tchau.
 */
export class WaveMeter {
    private samples: { t: number; x: number }[] = [];
    private until = 0;

    /** Quanto a mão andou nos últimos instantes (para separar "mão aberta parada" de "tchau"). */
    motion(window = 0.5) {
        const last = this.samples[this.samples.length - 1]?.t ?? 0;
        const recent = this.samples.filter((s) => last - s.t <= window).map((s) => s.x);
        return recent.length ? Math.max(...recent) - Math.min(...recent) : 0;
    }

    update(x: number | null, t: number): boolean {
        if (x === null) {
            this.samples = [];
            return false;
        }
        this.samples.push({ t, x });
        while (this.samples.length && t - this.samples[0]!.t > 1.2) this.samples.shift();

        let turns = 0;
        let dir = 0;
        let anchor = this.samples[0]?.x ?? x;
        for (const s of this.samples) {
            const delta = s.x - anchor;
            if (Math.abs(delta) < 0.035) continue;
            const next = Math.sign(delta);
            if (dir && next !== dir) turns++;
            dir = next;
            anchor = s.x;
        }
        if (turns >= 3 && t > this.until) {
            this.until = t + 3;
            this.samples = [];
            return true;
        }
        return false;
    }
}

/* ---------- Preguiça ---------- */

export const lazyLevels = [
    { max: 20, label: 'Produtivo', quip: 'Modo deploy. Pode mandar a próxima tarefa.' },
    { max: 45, label: 'Aquecendo', quip: 'O cérebro ainda está compilando.' },
    { max: 70, label: 'Precisa de café', quip: 'Pausa recomendada antes do próximo commit.' },
    { max: 101, label: 'Hibernando', quip: 'Sexta-feira, 17h. Nada de deploy agora.' },
] as const;

export const lazyLevel = (score: number) => lazyLevels.find((l) => score < l.max) ?? lazyLevels[3];

type LazyEvent = 'bocejo' | 'cochilo';

/**
 * Mede a preguiça numa janela de 15 s: olhos fechados, piscadas longas (cochilos), bocejos e olhar para baixo.
 * `update` devolve o evento do quadro, se houver, para a tela reagir na hora.
 */
export class LazyMeter {
    score = 0;
    yawns = 0;
    naps = 0;
    private samples: { t: number; closed: boolean; down: boolean }[] = [];
    private events: { t: number; kind: LazyEvent }[] = [];
    private closedSince = -1;
    private jawSince = -1;
    private yawnCounted = false;
    private napCounted = false;

    update(b: Blend, t: number): LazyEvent | null {
        let event: LazyEvent | null = null;
        const closed = pair(b, 'eyeBlink') > 0.55;
        const down = pair(b, 'eyeLookDown') > 0.5;

        if (closed) {
            if (this.closedSince < 0) this.closedSince = t;
            if (!this.napCounted && t - this.closedSince > 0.6) {
                this.napCounted = true;
                event = 'cochilo';
            }
        } else {
            this.closedSince = -1;
            this.napCounted = false;
        }

        if ((b.jawOpen ?? 0) > 0.5) {
            if (this.jawSince < 0) this.jawSince = t;
            if (!this.yawnCounted && t - this.jawSince > 0.9) {
                this.yawnCounted = true;
                event = 'bocejo';
            }
        } else {
            this.jawSince = -1;
            this.yawnCounted = false;
        }

        if (event) this.events.push({ t, kind: event });
        this.samples.push({ t, closed, down });
        const since = t - 15;
        while (this.samples.length && this.samples[0]!.t < since) this.samples.shift();
        while (this.events.length && this.events[0]!.t < since) this.events.shift();

        const n = Math.max(1, this.samples.length);
        const closedShare = this.samples.filter((s) => s.closed).length / n;
        const downShare = this.samples.filter((s) => s.down).length / n;
        this.yawns = this.events.filter((e) => e.kind === 'bocejo').length;
        this.naps = this.events.filter((e) => e.kind === 'cochilo').length;

        const target = Math.min(100, closedShare * 140 + downShare * 40 + this.naps * 12 + this.yawns * 28);
        this.score += (target - this.score) * 0.06;
        return event;
    }

    /** Cafés recomendados: um a cada 25 pontos de preguiça. */
    get coffees() {
        return Math.ceil(this.score / 25);
    }
}

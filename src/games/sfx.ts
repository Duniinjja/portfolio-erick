/**
 * Efeitos sonoros sintetizados com Web Audio: nenhum arquivo de som para baixar.
 * O áudio só começa depois de um toque ou tecla (regra dos navegadores).
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
    try {
        return localStorage.getItem('arcade:muted') === '1';
    } catch {
        return false;
    }
})();

const audio = () => {
    if (!ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
};

interface ToneOptions {
    to?: number;
    dur?: number;
    type?: Wave;
    vol?: number;
    delay?: number;
}

const tone = (freq: number, { to, dur = 0.12, type = 'square', vol = 0.07, delay = 0 }: ToneOptions = {}) => {
    if (muted) return;
    const c = audio();
    if (!c || !master) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
};

const noise = ({ dur = 0.25, vol = 0.12, from = 1800, to = 200, delay = 0 } = {}) => {
    if (muted) return;
    const c = audio();
    if (!c || !master) return;
    const t = c.currentTime + delay;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
};

export const sfx = {
    unlock: () => audio(),
    click: () => tone(660, { dur: 0.05, vol: 0.05 }),
    count: (last = false) => tone(last ? 880 : 440, { dur: last ? 0.3 : 0.14, type: 'triangle', vol: 0.1 }),
    hit: (pitch = 1) => {
        tone(320 * pitch, { to: 90, dur: 0.12, vol: 0.08 });
        noise({ dur: 0.08, vol: 0.06, from: 3000, to: 600 });
    },
    squash: (combo = 1) => {
        tone(520 + Math.min(combo, 12) * 45, { to: 180, dur: 0.11, vol: 0.07 });
        noise({ dur: 0.1, vol: 0.08, from: 2500, to: 300 });
    },
    coin: (step = 0) => {
        const base = 880 * Math.pow(1.06, Math.min(step, 12));
        tone(base, { dur: 0.06, type: 'square', vol: 0.05 });
        tone(base * 1.5, { dur: 0.1, type: 'square', vol: 0.05, delay: 0.05 });
    },
    jump: (second = false) => tone(second ? 420 : 300, { to: second ? 900 : 700, dur: 0.16, type: 'square', vol: 0.05 }),
    land: () => noise({ dur: 0.06, vol: 0.05, from: 800, to: 200 }),
    duck: () => tone(300, { to: 160, dur: 0.1, type: 'triangle', vol: 0.06 }),
    powerup: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.1, type: 'triangle', vol: 0.08, delay: i * 0.06 })),
    shield: () => {
        tone(200, { to: 800, dur: 0.25, type: 'sawtooth', vol: 0.05 });
        noise({ dur: 0.2, vol: 0.05, from: 4000, to: 1000 });
    },
    hurt: () => {
        tone(200, { to: 60, dur: 0.3, type: 'sawtooth', vol: 0.09 });
        noise({ dur: 0.2, vol: 0.08, from: 1200, to: 100 });
    },
    explode: () => {
        noise({ dur: 0.6, vol: 0.2, from: 2400, to: 60 });
        tone(120, { to: 40, dur: 0.5, type: 'sawtooth', vol: 0.08 });
    },
    levelUp: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.14, type: 'square', vol: 0.06, delay: i * 0.08 })),
    boss: () => [110, 104, 98, 92].forEach((f, i) => tone(f, { dur: 0.3, type: 'sawtooth', vol: 0.08, delay: i * 0.22 })),
    gameOver: () => [392, 330, 262, 196].forEach((f, i) => tone(f, { dur: 0.22, type: 'triangle', vol: 0.09, delay: i * 0.16 })),
    record: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, { dur: 0.16, type: 'triangle', vol: 0.09, delay: i * 0.09 })),
    miss: () => tone(140, { dur: 0.06, type: 'triangle', vol: 0.04 }),
};

/** Nota de "piano" sintetizado: ataque rápido, decaimento longo, harmônico uma oitava acima. */
export const playNote = (midi: number, vol = 0.12) => {
    if (muted) return;
    const c = audio();
    if (!c || !master) return;
    const t = c.currentTime;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.9);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    filter.connect(gain).connect(master);
    [
        { type: 'triangle' as Wave, mult: 1, level: 1 },
        { type: 'sine' as Wave, mult: 2, level: 0.35 },
        { type: 'sine' as Wave, mult: 3, level: 0.12 },
    ].forEach(({ type, mult, level }) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq * mult, t);
        g.gain.value = level;
        osc.connect(g).connect(filter);
        osc.start(t);
        osc.stop(t + 1.25);
    });
};

/** Baixo do metrônomo: nota grave e curta que marca o compasso. */
export const playBass = (midi: number, vol = 0.09) => {
    tone(440 * Math.pow(2, (midi - 69) / 12), { dur: 0.22, type: 'sine', vol });
    tone(880 * Math.pow(2, (midi - 69) / 12), { dur: 0.05, type: 'triangle', vol: vol * 0.25 });
};

/** Erro de digitação: duas notas desafinadas e abafadas. */
export const playWrong = () => {
    tone(98, { dur: 0.16, type: 'sawtooth', vol: 0.06 });
    tone(104, { dur: 0.16, type: 'sawtooth', vol: 0.06 });
};

export const isMuted = () => muted;

export const setMuted = (value: boolean) => {
    muted = value;
    try {
        localStorage.setItem('arcade:muted', value ? '1' : '0');
    } catch {
        /* sem armazenamento: vale só nesta visita */
    }
};

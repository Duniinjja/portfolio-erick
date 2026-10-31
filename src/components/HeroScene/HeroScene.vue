<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as THREE from 'three';
import { animate } from 'animejs';
import photoUrl from '../../assets/erick-foto.webp';
import symbolUrl from '../../assets/woltek-simbolo.webp';
import { reducedMotion } from '../../motion';

/** Elemento que marca onde o rosto fica; o canvas cobre o pai inteiro. */
const props = defineProps<{ anchor: HTMLElement | null }>();
const emit = defineEmits<{ fallback: [] }>();

const canvasEl = ref<HTMLCanvasElement | null>(null);

const faceVertex = /* glsl */ `
    uniform float uProgress;
    uniform float uMix;
    uniform float uTime;
    uniform float uScatter;
    uniform float uScale;
    uniform float uPixelRatio;
    uniform float uCameraDist;
    uniform vec2 uMouse;

    attribute vec3 aTargetA;
    attribute vec3 aTargetB;
    attribute vec3 aColorA;
    attribute vec3 aColorB;
    attribute float aSizeA;
    attribute float aSizeB;
    attribute vec3 aStart;
    attribute float aDelay;
    attribute float aSeed;

    varying vec3 vColor;
    varying float vAlpha;

    float easeInOut(float t) {
        return t < 0.5 ? 8.0 * t * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 4.0) / 2.0;
    }

    void main() {
        float p = easeInOut(clamp((uProgress - aDelay * 0.4) / 0.6, 0.0, 1.0));
        // Troca de forma (rosto, símbolo, nome): cada ponto vai de A para B no seu tempo.
        float m = smoothstep(0.0, 1.0, clamp((uMix - aDelay * 0.3) / 0.7, 0.0, 1.0));
        vec3 target = mix(aTargetA, aTargetB, m) * uScale;
        vec3 pos = mix(aStart, target, p);

        pos.x += sin(uTime * 0.8 + aSeed * 6.2831) * 0.7;
        pos.y += cos(uTime * 0.6 + aSeed * 12.566) * 0.7;
        pos += (aStart - target) * uScatter;

        vec2 away = pos.xy - uMouse;
        float force = (1.0 - smoothstep(0.0, 95.0, length(away))) * 34.0 * p;
        pos.xy += normalize(away + 0.0001) * force;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(aSizeA, aSizeB, m) * uScale * uPixelRatio * (uCameraDist / -mv.z);

        float twinkle = 0.85 + 0.15 * sin(uTime * 2.0 + aSeed * 40.0);
        vColor = mix(aColorA, aColorB, m) * twinkle;
        vAlpha = mix(0.25, 1.0, p) * (1.0 - uScatter * 0.85);
    }
`;

const faceFragment = /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor, smoothstep(0.5, 0.2, d) * vAlpha);
    }
`;

const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

interface FaceData {
    target: Float32Array;
    color: Float32Array;
    size: Float32Array;
    delay: Float32Array;
    count: number;
    rows: number;
}

/** Uma forma que as mesmas partículas podem assumir. */
interface Shape {
    target: Float32Array;
    color: Float32Array;
    size: Float32Array;
}

/** Lê a foto numa grade: cada pixel claro vira uma partícula com a cor e o relevo dele. */
const sampleFace = (img: HTMLImageElement, cols: number): FaceData => {
    const rows = Math.round((cols * img.height) / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, cols, rows);
    const { data } = ctx.getImageData(0, 0, cols, rows);

    const target: number[] = [];
    const color: number[] = [];
    const size: number[] = [];
    const delay: number[] = [];

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = (y * cols + x) * 4;
            const r = (data[i] ?? 0) / 255;
            const g = (data[i + 1] ?? 0) / 255;
            const b = (data[i + 2] ?? 0) / 255;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            const nx = (x / cols - 0.5) * 2;
            const ny = (y / rows - 0.45) * 2;

            // Só a cabeça e o colo: o fundo da foto não é preto puro e formaria um quadrado.
            const oval = (nx / 0.78) ** 2 + (ny / 1.05) ** 2;
            if (oval > 1) continue;

            // Fundo e blusa pretos somem; o cabelo escuro fica rarefeito.
            if (lum < 0.075) continue;
            if (lum < 0.16 && Math.random() > 0.6) continue;

            // Plano e de frente: profundidade mínima para a perspectiva não entortar o rosto.
            target.push(
                x - cols / 2 + (Math.random() - 0.5) * 0.4,
                -(y - rows / 2) + (Math.random() - 0.5) * 0.4,
                lum * 4,
            );

            // Dissolve a parte de baixo (ombros) para o rosto flutuar.
            const bottom = y / rows;
            const fade = bottom > 0.64 ? Math.max(0, 1 - (bottom - 0.64) / 0.2) : 1;

            // Cor real do pixel (o tom), com os meios-tons clareados para o rosto aparecer no escuro.
            const light = Math.min(1, Math.pow(lum, 0.68) * 1.3);
            const peak = Math.max(r, g, b, 0.01);
            color.push(
                ((r / peak) * 0.62 + 0.38) * light * fade,
                ((g / peak) * 0.62 + 0.38) * light * fade,
                ((b / peak) * 0.62 + 0.38) * light * fade,
            );
            size.push(0.36 + light * 0.78);

            delay.push(Math.min(1, Math.hypot(nx, ny) * 0.55 + Math.random() * 0.3));
        }
    }

    return {
        target: new Float32Array(target),
        color: new Float32Array(color),
        size: new Float32Array(size),
        delay: new Float32Array(delay),
        count: size.length,
        rows,
    };
};

type Ink = (r: number, g: number, b: number, a: number) => number;
type Tint = (r: number, g: number, b: number) => readonly [number, number, number];

/** Lê o desenho numa grade de `cols` colunas e devolve as casas com tinta. */
const inkGrid = (source: CanvasImageSource, srcWidth: number, srcHeight: number, cols: number, ink: Ink) => {
    const rows = Math.max(1, Math.round((cols * srcHeight) / srcWidth));
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, cols, rows);
    const { data } = ctx.getImageData(0, 0, cols, rows);
    const cells: { x: number; y: number; ink: number; rgb: [number, number, number] }[] = [];
    for (let i = 0; i < cols * rows; i++) {
        const rgb: [number, number, number] = [data[i * 4]! / 255, data[i * 4 + 1]! / 255, data[i * 4 + 2]! / 255];
        const amount = Math.min(1, ink(...rgb, data[i * 4 + 3]! / 255));
        if (amount > 0.18) cells.push({ x: i % cols, y: Math.floor(i / cols), ink: amount, rgb });
    }
    return { cells, cols, rows };
};

/**
 * Desenha uma imagem com as partículas, em retícula como o rosto: uma partícula por casa com tinta, do tamanho
 * da tinta. A grade é a mais fina que cabe em `count` partículas; as que sobram ficam invisíveis.
 * O desenho ocupa `width` unidades (as mesmas da grade do rosto), centrado.
 */
const sampleInk = (
    source: CanvasImageSource,
    srcWidth: number,
    srcHeight: number,
    count: number,
    width: number,
    ink: Ink,
    tint: Tint,
): Shape => {
    let low = 30;
    let high = Math.min(srcWidth, 420);
    let grid = inkGrid(source, srcWidth, srcHeight, low, ink);
    while (high - low > 2) {
        const mid = Math.round((low + high) / 2);
        const attempt = inkGrid(source, srcWidth, srcHeight, mid, ink);
        if (attempt.cells.length <= count) {
            grid = attempt;
            low = mid;
        } else {
            high = mid;
        }
    }

    // Ordem embaralhada: na explosão, cada ponto do rosto vai para um lugar qualquer do desenho.
    const cells = grid.cells;
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j]!, cells[i]!];
    }

    const unit = width / grid.cols;
    const target = new Float32Array(count * 3);
    const color = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let n = 0; n < count; n++) {
        const cell = cells[n % Math.max(1, cells.length)];
        if (!cell) break;
        target[n * 3] = (cell.x + 0.5 - grid.cols / 2 + (Math.random() - 0.5) * 0.3) * unit;
        target[n * 3 + 1] = -(cell.y + 0.5 - grid.rows / 2 + (Math.random() - 0.5) * 0.3) * unit;
        target[n * 3 + 2] = cell.ink * 3;
        if (n >= cells.length) continue; // sobra: fica no lugar de outra, sem cor nem tamanho
        const [r, g, b] = tint(...cell.rgb);
        const light = 0.45 + cell.ink * 0.55;
        color.set([r * light, g * light, b * light], n * 3);
        size[n] = unit * (0.5 + cell.ink * 0.7);
    }
    return { target, color, size };
};

const CREAM = [0.96, 0.9, 0.78] as const;
const GOLD = [1, 0.72, 0.22] as const;

/** Símbolo da Woltek: o traço preto vira creme e o brilho laranja do centro vira dourado. */
const sampleSymbol = (img: HTMLImageElement, count: number, width: number) =>
    sampleInk(
        img,
        img.width,
        img.height,
        count,
        width,
        (r, g, b, a) => a * (1 - (0.299 * r + 0.587 * g + 0.114 * b)) * 1.3 + a * Math.max(0, r - b) * 1.6,
        (r, _g, b) => {
            const warm = Math.min(1, Math.max(0, (r - b) * 2.5));
            return [
                CREAM[0] + (GOLD[0] - CREAM[0]) * warm,
                CREAM[1] + (GOLD[1] - CREAM[1]) * warm,
                CREAM[2] + (GOLD[2] - CREAM[2]) * warm,
            ];
        },
    );

/** O nome WOLTEK na fonte do site, espaçado como no logotipo. */
const sampleWord = (count: number, width: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 700 150px Montserrat, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    const letters = [...'WOLTEK'];
    const gap = 46;
    const total = letters.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + gap * (letters.length - 1);
    let x = (canvas.width - total) / 2;
    for (const ch of letters) {
        ctx.fillText(ch, x, canvas.height / 2);
        x += ctx.measureText(ch).width + gap;
    }
    return sampleInk(canvas, canvas.width, canvas.height, count, width, (r, _g, _b, a) => a * r, () => CREAM);
};

let cleanup = () => {};

onMounted(async () => {
    const canvas = canvasEl.value;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
        emit('fallback');
        return;
    }

    let img: HTMLImageElement;
    let symbolImg: HTMLImageElement | null = null;
    try {
        img = await loadImage(photoUrl);
        symbolImg = await loadImage(symbolUrl).catch(() => null);
    } catch {
        emit('fallback');
        return;
    }

    const still = reducedMotion();
    const narrow = window.innerWidth < 760;
    const host = canvas.parentElement!;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 8000);

    /* ---------- Rosto ---------- */
    const face = sampleFace(img, narrow ? 120 : 190);
    const start = new Float32Array(face.count * 3);
    const seed = new Float32Array(face.count).map(() => Math.random());

    const faceGeometry = new THREE.BufferGeometry();
    const faceShape: Shape = { target: face.target, color: face.color, size: face.size };

    // A e B são as duas formas da troca atual; começam ambas no rosto.
    const targetA = new THREE.BufferAttribute(face.target.slice(), 3);
    const targetB = new THREE.BufferAttribute(face.target.slice(), 3);
    const colorA = new THREE.BufferAttribute(face.color.slice(), 3);
    const colorB = new THREE.BufferAttribute(face.color.slice(), 3);
    const sizeA = new THREE.BufferAttribute(face.size.slice(), 1);
    const sizeB = new THREE.BufferAttribute(face.size.slice(), 1);
    faceGeometry.setAttribute('position', new THREE.BufferAttribute(face.target, 3));
    faceGeometry.setAttribute('aTargetA', targetA);
    faceGeometry.setAttribute('aTargetB', targetB);
    faceGeometry.setAttribute('aColorA', colorA);
    faceGeometry.setAttribute('aColorB', colorB);
    faceGeometry.setAttribute('aSizeA', sizeA);
    faceGeometry.setAttribute('aSizeB', sizeB);
    faceGeometry.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    faceGeometry.setAttribute('aDelay', new THREE.BufferAttribute(face.delay, 1));
    faceGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    const uniforms = {
        uProgress: { value: still ? 1 : 0 },
        uMix: { value: 1 },
        uTime: { value: 0 },
        uScatter: { value: 0 },
        uScale: { value: 1 },
        uPixelRatio: { value: 1 },
        uCameraDist: { value: 1000 },
        uMouse: { value: new THREE.Vector2(99999, 99999) },
    };

    const faceMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: faceVertex,
        fragmentShader: faceFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const facePoints = new THREE.Points(faceGeometry, faceMaterial);
    facePoints.frustumCulled = false;
    const faceGroup = new THREE.Group();
    faceGroup.add(facePoints);
    scene.add(faceGroup);

    /* ---------- Rede (plexus) ---------- */
    const nodeCount = narrow ? 38 : 84;
    const linkDistance = narrow ? 115 : 150;
    const nodes = new Float32Array(nodeCount * 3);
    const velocity = new Float32Array(nodeCount * 2);
    const maxSegments = (nodeCount * (nodeCount - 1)) / 2 + nodeCount;
    const linePositions = new Float32Array(maxSegments * 6);
    const lineColors = new Float32Array(maxSegments * 6);

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodes, 3));
    const nodePoints = new THREE.Points(
        nodeGeometry,
        new THREE.PointsMaterial({ color: 0x8a8a92, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.6 }),
    );
    nodePoints.frustumCulled = false;

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    const lines = new THREE.LineSegments(
        lineGeometry,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    lines.frustumCulled = false;
    scene.add(lines, nodePoints);

    let width = 1;
    let height = 1;
    const mouse = { x: 99999, y: 99999, active: false };
    const faceCenter = new THREE.Vector2();
    let faceRadius = 1;

    const seedNetwork = () => {
        for (let i = 0; i < nodeCount; i++) {
            nodes[i * 3] = (Math.random() - 0.5) * width;
            nodes[i * 3 + 1] = (Math.random() - 0.5) * height;
            nodes[i * 3 + 2] = (Math.random() - 0.5) * 120;
            velocity[i * 2] = (Math.random() - 0.5) * 0.32;
            velocity[i * 2 + 1] = (Math.random() - 0.5) * 0.32;
        }
    };

    const updateNetwork = (move: boolean) => {
        const halfW = width / 2 + 20;
        const halfH = height / 2 + 20;
        if (move) {
            for (let i = 0; i < nodeCount; i++) {
                nodes[i * 3]! += velocity[i * 2]!;
                nodes[i * 3 + 1]! += velocity[i * 2 + 1]!;
                if (Math.abs(nodes[i * 3]!) > halfW) velocity[i * 2]! *= -1;
                if (Math.abs(nodes[i * 3 + 1]!) > halfH) velocity[i * 2 + 1]! *= -1;
            }
        }

        let segment = 0;
        const pushSegment = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, strength: number) => {
            // Linhas se apagam ao passar pelo rosto.
            const toFace = Math.hypot((ax + bx) / 2 - faceCenter.x, (ay + by) / 2 - faceCenter.y) / faceRadius;
            const clear = Math.min(1, Math.max(0, (toFace - 0.85) / 0.6));
            if (clear <= 0) return;
            const o = segment * 6;
            linePositions.set([ax, ay, az, bx, by, bz], o);
            const c = strength * 0.2 * clear;
            lineColors.set([c, c, c * 1.02, c, c, c * 1.02], o);
            segment++;
        };

        for (let i = 0; i < nodeCount; i++) {
            const ax = nodes[i * 3]!;
            const ay = nodes[i * 3 + 1]!;
            const az = nodes[i * 3 + 2]!;
            for (let j = i + 1; j < nodeCount; j++) {
                const dx = ax - nodes[j * 3]!;
                const dy = ay - nodes[j * 3 + 1]!;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < linkDistance) {
                    pushSegment(ax, ay, az, nodes[j * 3]!, nodes[j * 3 + 1]!, nodes[j * 3 + 2]!, 1 - dist / linkDistance);
                }
            }
        }

        lineGeometry.setDrawRange(0, segment * 2);
        lineGeometry.attributes.position!.needsUpdate = true;
        lineGeometry.attributes.color!.needsUpdate = true;
        nodeGeometry.attributes.position!.needsUpdate = true;
    };

    const render = () => renderer.render(scene, camera);

    const layout = () => {
        width = host.clientWidth;
        height = host.clientHeight;
        const ratio = Math.min(window.devicePixelRatio, 2);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);

        const dist = height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        camera.aspect = width / height;
        camera.position.set(0, 0, dist);
        camera.updateProjectionMatrix();
        uniforms.uPixelRatio.value = ratio;
        uniforms.uCameraDist.value = dist;

        const hostRect = host.getBoundingClientRect();
        const slot = props.anchor?.getBoundingClientRect();
        const slotSize = slot ? Math.min(slot.width, slot.height) : Math.min(width, height) * 0.6;
        const cx = slot ? slot.left + slot.width / 2 - hostRect.left : width * 0.7;
        const cy = slot ? slot.top + slot.height / 2 - hostRect.top : height / 2;

        // A foto tem margem preta em volta: amplia para o rosto ocupar o espaço.
        const faceSize = slotSize * (narrow ? 1.2 : 1.3);
        uniforms.uScale.value = faceSize / face.rows;
        faceGroup.position.set(cx - width / 2, height / 2 - cy - faceSize * 0.04, 0);
        faceCenter.set(faceGroup.position.x, faceGroup.position.y + faceSize * 0.08);
        faceRadius = faceSize * 0.36;

        // As partículas do rosto partem de uma nuvem larga, como se viessem da rede.
        for (let i = 0; i < face.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = (0.45 + Math.random() * 0.8) * Math.max(width, height) * 0.6;
            start[i * 3] = Math.cos(angle) * radius;
            start[i * 3 + 1] = Math.sin(angle) * radius * 0.7;
            start[i * 3 + 2] = (Math.random() - 0.5) * 900;
        }
        faceGeometry.attributes.aStart!.needsUpdate = true;

        seedNetwork();
        updateNetwork(false);
        render();
    };

    const onPointerMove = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        const inside = event.clientY >= rect.top && event.clientY <= rect.bottom;
        mouse.active = inside;
        mouse.x = event.clientX - rect.left - width / 2;
        mouse.y = height / 2 - (event.clientY - rect.top);
    };

    const onPointerLeave = () => {
        mouse.active = false;
    };

    // Formas da sequência do clique: o símbolo da Woltek e o nome, na escala da grade do rosto.
    // São montadas no primeiro clique, quando a fonte do nome já carregou.
    const faceWidth = face.rows * 0.82;
    let story: Shape[] | null = null;
    const buildStory = () => {
        const shapes: Shape[] = [];
        if (symbolImg) shapes.push(sampleSymbol(symbolImg, face.count, faceWidth));
        shapes.push(sampleWord(face.count, faceWidth * (narrow ? 0.92 : 0.82)));
        // Encaixa as formas no espaço do rosto (no desktop, um pouco à direita, longe do texto).
        const lift = face.rows * (narrow ? 0.12 : 0.14);
        const shift = narrow ? 0 : face.rows * 0.07;
        for (const shape of shapes) {
            for (let i = 0; i < shape.target.length; i += 3) {
                shape.target[i]! += shift;
                shape.target[i + 1]! += lift;
            }
        }
        return shapes;
    };

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    /** Explode a forma atual e recompõe as partículas na próxima. */
    const morphTo = (shape: Shape) => {
        targetA.copy(targetB);
        colorA.copy(colorB);
        sizeA.copy(sizeB);
        targetB.set(shape.target);
        colorB.set(shape.color);
        sizeB.set(shape.size);
        for (const attr of [targetA, targetB, colorA, colorB, sizeA, sizeB]) attr.needsUpdate = true;
        uniforms.uMix.value = 0;

        animate(uniforms.uProgress, {
            value: [
                { to: 0.4, duration: 550, ease: 'outCubic' },
                { to: 1, duration: 1500, ease: 'inOutQuart' },
            ],
        });
        return animate(uniforms.uMix, { value: 1, duration: 1300, delay: 450, ease: 'inOutSine' });
    };

    // Um clique no rosto: explode, vira o símbolo da Woltek, depois o nome, e volta ao rosto.
    let playing = false;
    const onPointerDown = async (event: PointerEvent) => {
        if (!props.anchor || playing) return;
        const slot = props.anchor.getBoundingClientRect();
        const inside =
            event.clientX > slot.left && event.clientX < slot.right && event.clientY > slot.top && event.clientY < slot.bottom;
        if (!inside) return;
        playing = true;
        story ??= buildStory();
        for (const shape of story) {
            await morphTo(shape);
            await wait(1700);
        }
        await morphTo(faceShape);
        playing = false;
    };

    let running = false;
    let visible = true;
    let frame = 0;
    const clock = new THREE.Clock();

    const tick = () => {
        if (!running) return;
        frame = requestAnimationFrame(tick);
        const t = clock.getElapsedTime();
        uniforms.uTime.value = t;

        const scroll = Math.min(1, Math.max(0, window.scrollY / (height * 0.85)));
        uniforms.uScatter.value += (scroll - uniforms.uScatter.value) * 0.1;

        // O rosto fica parado; o mouse só afasta os pontos por onde passa.
        if (mouse.active) {
            uniforms.uMouse.value.set(mouse.x - faceGroup.position.x, mouse.y - faceGroup.position.y);
        } else {
            uniforms.uMouse.value.set(99999, 99999);
        }

        updateNetwork(true);
        render();
    };

    const play = () => {
        if (running || still || !visible || document.hidden) return;
        running = true;
        clock.start();
        tick();
    };

    const pause = () => {
        running = false;
        cancelAnimationFrame(frame);
    };

    const visibility = new IntersectionObserver(([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) play();
        else pause();
    });
    visibility.observe(host);

    const onVisibilityChange = () => (document.hidden ? pause() : play());
    let lastWidth = 0;
    const resize = new ResizeObserver(() => {
        // Barras do navegador no celular mudam só a altura: não recomeça a cena por isso.
        if (Math.abs(host.clientWidth - lastWidth) < 2 && running) return;
        lastWidth = host.clientWidth;
        layout();
    });
    resize.observe(host);

    layout();
    canvas.classList.add('is-ready');

    if (!still) {
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        host.addEventListener('pointerleave', onPointerLeave);
        window.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('visibilitychange', onVisibilityChange);
        animate(uniforms.uProgress, { value: 1, duration: 3000, delay: 300, ease: 'inOutSine' });
        play();
    }

    cleanup = () => {
        pause();
        visibility.disconnect();
        resize.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        host.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        faceGeometry.dispose();
        faceMaterial.dispose();
        nodeGeometry.dispose();
        lineGeometry.dispose();
        renderer.dispose();
    };
});

onBeforeUnmount(() => cleanup());
</script>

<template>
    <canvas ref="canvasEl" class="heroScene" aria-hidden="true"></canvas>
</template>

<style scoped lang="scss">
.heroScene {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.8s;

    &.is-ready {
        opacity: 1;
    }
}
</style>

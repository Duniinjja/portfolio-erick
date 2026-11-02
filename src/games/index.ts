import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from './ArcadeScene';
import { BugHunt } from './BugHunt';
import { KartDeploy } from './KartDeploy';
import { PythonInfinito } from './PythonInfinito';
import { StarSyntax } from './StarSyntax';
import { isMuted, setMuted } from './sfx';

export type GameId = 'bug-hunt' | 'kart-deploy' | 'python-infinito' | 'star-syntax';

const scenes = { 'bug-hunt': BugHunt, 'kart-deploy': KartDeploy, 'python-infinito': PythonInfinito, 'star-syntax': StarSyntax };

export interface GameController {
    destroy: () => void;
    togglePause: () => void;
    setMuted: (muted: boolean) => void;
    isMuted: () => boolean;
    /** Envia um caractere digitado (jogos de digitação). */
    type: (ch: string) => void;
}

/** Cria o jogo dentro de `parent`. Este módulo é carregado só quando alguém abre o arcade. */
export const launchGame = (id: GameId, parent: HTMLElement, onScore: (score: number, best: number) => void): GameController => {
    // Desenha na resolução real da tela (até o dobro) em vez de esticar 960x540; a câmera aproxima o mesmo tanto.
    const view = Math.min(2, Math.max(1, Math.ceil((parent.clientWidth * (window.devicePixelRatio || 1)) / WIDTH)));
    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width: WIDTH * view,
        height: HEIGHT * view,
        backgroundColor: COLORS.black,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { activePointers: 2 },
        render: { antialias: true, roundPixels: false },
        scene: [scenes[id]],
        banner: false,
    });
    game.registry.set('view', view);
    game.events.on('arcade-score', ({ score, best }: { score: number; best: number }) => onScore(score, best));
    // Só em desenvolvimento: deixa os testes automáticos lerem o estado do jogo.
    if (import.meta.env.DEV) (window as unknown as { __arcade?: Phaser.Game }).__arcade = game;

    return {
        destroy: () => game.destroy(true),
        togglePause: () => game.events.emit('arcade-toggle-pause'),
        setMuted,
        isMuted,
        type: (ch: string) => game.events.emit('arcade-type', ch),
    };
};

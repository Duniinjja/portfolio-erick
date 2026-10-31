import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from './ArcadeScene';
import { BugHunt } from './BugHunt';
import { KartDeploy } from './KartDeploy';
import { LeadFunnel } from './LeadFunnel';
import { CodeSonata } from './CodeSonata';
import { isMuted, setMuted } from './sfx';

export type GameId = 'bug-hunt' | 'kart-deploy' | 'lead-funnel' | 'code-sonata';

const scenes = { 'bug-hunt': BugHunt, 'kart-deploy': KartDeploy, 'lead-funnel': LeadFunnel, 'code-sonata': CodeSonata };

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
    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: COLORS.black,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { activePointers: 2 },
        render: { antialias: true, roundPixels: false },
        scene: [scenes[id]],
        banner: false,
    });
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

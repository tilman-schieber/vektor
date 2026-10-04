// Game modes; each has its own high score table.
export type ModeId = 'normal' | 'hard';

export interface Mode {
  id: ModeId;
  name: string;
  lives: number;
  /** Bullets fly faster. */
  hard: boolean;
  blurb: string;
}

export const MODES: Mode[] = [
  { id: 'normal', name: 'NORMAL', lives: 3, hard: false, blurb: '3 SHIPS. THE ARCADE GAME.' },
  { id: 'hard', name: 'HARD', lives: 3, hard: true, blurb: 'FASTER BULLETS FROM THE START.' },
];

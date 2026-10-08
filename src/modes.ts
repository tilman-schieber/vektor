// The game modes. Each keeps its own high score tables, here and on the server.
export type ModeId = 'normal' | 'easy';

export interface Mode {
  id: ModeId;
  name: string;
  lives: number;
  /** The ship carries a shield that takes one hit and comes back SHIELD_REGEN frames later. */
  shield: boolean;
}

export const MODES: Mode[] = [
  { id: 'normal', name: 'NORMAL', lives: 3, shield: false },
  { id: 'easy', name: 'EASY', lives: 3, shield: true },
];

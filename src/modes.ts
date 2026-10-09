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

/** The high score tables: one per mode, and one per mode for 2-player games ('normal2'). */
export type TableId = ModeId | `${ModeId}2`;
export const TABLES: TableId[] = MODES.flatMap((m) => [m.id, `${m.id}2` as TableId]);
export const tableId = (mode: Mode, players: number): TableId => (players > 1 ? `${mode.id}2` : mode.id);

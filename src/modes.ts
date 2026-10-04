// The game mode. There is one for now; scores are still kept per mode, so more can join later.
export type ModeId = 'normal';

export interface Mode {
  id: ModeId;
  name: string;
  lives: number;
}

export const MODES: Mode[] = [{ id: 'normal', name: 'NORMAL', lives: 3 }];

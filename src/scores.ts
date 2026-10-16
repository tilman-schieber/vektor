// High scores, one table per mode and player count, in this browser and worldwide (a Val Town val:
// tilmanschieber/vektor-scores). The tables themselves are arcade-kit's.
import { createScores } from 'arcade-kit/scores';
import { TABLES, TableId } from './modes';

export { load, save } from 'arcade-kit/storage';

export interface ScoreEntry {
  name: string;
  score: number;
  /** Loop reached: 2 means the stage was cleared once. */
  loop: number;
  medals: number;
}

export type Tables = Record<TableId, ScoreEntry[]>;

export const { MAX_SCORES, loadTables, saveTables, rankFor, fetchGlobal, submitGlobal, flushPending } = createScores<
  TableId,
  ScoreEntry
>({
  game: 'vektor',
  tables: TABLES,
  url: 'https://tilmanschieber--01a106fad69c71ee992209b04743a676.web.val.run',
  normalize: (e) => ({
    name: e.name,
    score: e.score,
    loop: Number(e.loop) || 1,
    medals: Number(e.medals) || 0,
  }),
});

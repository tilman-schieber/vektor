// The stages in order; after the last one the game loops back to the first, faster.
import { STAGE1 } from './stage1';
import { STAGE2 } from './stage2';
import { STAGE3 } from './stage3';
import { STAGE4 } from './stage4';
import { STAGE5 } from './stage5';
import { STAGE6 } from './stage6';

export const STAGES = [STAGE1, STAGE2, STAGE3, STAGE4, STAGE5, STAGE6];

// Waves run in order of distance; keep them sorted however they were written.
for (const st of STAGES) st.waves.sort((a, b) => a.at - b.at);

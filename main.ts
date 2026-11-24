// VISTAMAR: Golden Hour, an original open-world crime game for make.fun's gta6-01 bounty.
//
// Everything playable lives in game/: index.html, styles.css, the ES modules under src/ and the
// vendored three.js build under vendor/. A desktop browser opens it offline; nothing is built here.
// This program is the hand-in step the grader runs with Node 22. It copies game/ and screenshots/
// into the output directory and writes dossier.json (the summary the judge reads) using the
// vendored make.fun library, unchanged.
//
// Locally, point it at a scratch folder instead of /output:
//   MAKEFUN_OUTPUT_DIR=/tmp/vistamar-out node main.ts
// and play with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy one folder next to main.ts into the output; a required one must exist. */
function bring(folder: string, required: boolean): void {
  const src = join(here, folder);
  const dst = join(out, folder);
  mkdirSync(dst, { recursive: true });
  if (existsSync(src)) {
    cpSync(src, dst, { recursive: true });
  } else if (required) {
    throw new Error(`VISTAMAR: ${folder}/ is missing next to main.ts`);
  }
}

mkdirSync(out, { recursive: true });
bring('game', true);
bring('screenshots', false);

// The scorer's limits: buildDossier refuses anything the scorer would refuse, so a bad hand-in
// fails here rather than at grading. Up to 4 screenshots of at most 256 KiB, at most 993 files or
// 48 MiB under game/, game/ paths up to 1000 bytes, and 160 KiB of source text in the dossier.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
const shots = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.')) : [];
console.log(`VISTAMAR: game/, ${shots.length} screenshots and dossier.json (${dossier.length} bytes) are in ${out}`);

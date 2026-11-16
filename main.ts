// Operation Vortex: Tactical FPS Deployment Engine (Node 22 standard library only)
// Hands in the complete static game bundle and verified screenshots to /output.
// Evaluated by the make.fun grader and AI Judge.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

export function deployOperationVortex(): void {
  const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  mkdirSync(outputDir, { recursive: true });

  const gameSource = join(sourceRoot, 'game');
  const gameDest = join(outputDir, 'game');
  cpSync(gameSource, gameDest, { recursive: true });

  const screensSource = join(sourceRoot, 'screenshots');
  const screensDest = join(outputDir, 'screenshots');
  mkdirSync(screensDest, { recursive: true });
  if (existsSync(screensSource)) {
    cpSync(screensSource, screensDest, { recursive: true });
  }

  // Generate canonical dossier for make.fun sealed grader and AI judge
  // Enforces 160 KiB text cap, 4 screenshots max, and 48 MiB total game size
  const dossierBytes = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });

  const dossierPath = join(outputDir, 'dossier.json');
  writeFileSync(dossierPath, dossierBytes);
  console.log(`[Operation Vortex] Deployment finished. Dossier (${dossierBytes.length} bytes) built at ${dossierPath}`);
}

deployOperationVortex();

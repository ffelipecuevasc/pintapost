/**
 * Copia los archivos de la fuente variable Inter desde node_modules a
 * public/static/assets/fonts/ (ADR-010: fuentes auto-hospedadas).
 *
 * Se copian los subconjuntos latin y latin-ext del eje de peso (wght), mas el
 * vietnamita por las marcas diacriticas combinables (ver FILES).
 * Las variantes "standard" y "opsz" del paquete incluyen además el eje de
 * tamaño optico y pesan un 50% mas sin que el proyecto lo aproveche.
 *
 * Se ejecuta desde `pnpm run build:fonts`, encadenado en `pnpm run build`.
 */

import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('@fontsource-variable/inter/package.json'));
const sourceDir = join(packageRoot, 'files');
const targetDir = resolve(process.cwd(), 'public/static/assets/fonts');

const FILES = [
  'inter-latin-wght-normal.woff2',
  'inter-latin-wght-italic.woff2',
  'inter-latin-ext-wght-normal.woff2',
  'inter-latin-ext-wght-italic.woff2',
  // Subconjunto vietnamita: no se copia por el vietnamita, sino porque es el
  // unico que trae las marcas diacriticas combinables U+0301 (acento agudo) y
  // U+0303 (virgulilla) que necesita la composicion de ADR-005. En styles.css
  // su unicode-range se acota a esas marcas.
  'inter-vietnamese-wght-normal.woff2',
  'inter-vietnamese-wght-italic.woff2',
];

mkdirSync(targetDir, { recursive: true });

let total = 0;
for (const file of FILES) {
  const from = join(sourceDir, file);
  const to = join(targetDir, file);
  copyFileSync(from, to);
  total += statSync(to).size;
  console.log(`  ${file}`);
}

console.log(`Fuentes copiadas: ${FILES.length} archivos, ${(total / 1024).toFixed(1)} kB.`);

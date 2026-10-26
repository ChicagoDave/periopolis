/**
 * @file Pack the chosen CC0 kit models into the Board's assets folder (ADR-0024 Decisions 1 and 4): each GLB named in
 * scripts/selection.json is read from the kits folder (apps/board/kits/<kit>/Models/GLB format/, downloaded by hand
 * from the kit's page and not committed), flattened to one mesh, welded, deduplicated, pruned, quantized and
 * meshopt-compressed, and written to public/assets/models/<id>.glb; its native bounding box is measured before any of
 * that and written with its kit, source and licence to public/assets/manifest.json (what the pure kit module reads)
 * and MANIFEST.md (what a reader reads). Run: pnpm --filter @city/board assets:pack.
 * Owner context: Board (adapter), build tooling.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, flatten, join as joinMeshes, prune, quantize, reorder, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const here = dirname(fileURLToPath(import.meta.url));
const board = join(here, '..');
const selection = JSON.parse(readFileSync(join(here, 'selection.json'), 'utf8'));
const outDir = join(board, 'public', 'assets', 'models');
mkdirSync(outDir, { recursive: true });

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const manifest = { kits: selection.kits, models: [] };
let totalBytes = 0;
for (const m of selection.models) {
  const src = join(board, 'kits', m.kit, 'Models', 'GLB format', `${m.file}.glb`);
  const document = await io.read(src);
  const scene = document.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const round = (v) => Math.round(v * 1000) / 1000;
  const native = { min: min.map(round), max: max.map(round), size: max.map((v, i) => round(v - min[i])) };
  // Simplified to about a third of its triangles within a 0.5% error: a kit model is seen among thousands, and the flows
  // render on software GL; the meshopt simplifier keeps silhouettes and the palette UVs.
  await document.transform(flatten(), joinMeshes(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.05 }), dedup(), prune(), quantize(), reorder({ encoder: MeshoptEncoder }));
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const dst = join(outDir, `${m.id}.glb`);
  await io.write(dst, document);
  const bytes = statSync(dst).size;
  totalBytes += bytes;
  const tris = document
    .getRoot()
    .listMeshes()
    .reduce((t, mesh) => t + mesh.listPrimitives().reduce((u, p) => u + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
  manifest.models.push({ id: m.id, kit: m.kit, file: `${m.file}.glb`, for: m.for, licence: selection.kits[m.kit].licence, source: selection.kits[m.kit].url, bytes, triangles: Math.round(tris), native });
  console.log(`${m.id.padEnd(16)} ${String(bytes).padStart(7)} B  ${String(Math.round(tris)).padStart(5)} tris  ${native.size.join(' x ')}`);
}
manifest.totalBytes = totalBytes;
writeFileSync(join(board, 'public', 'assets', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const lines = [
  '# The Board\'s model assets',
  '',
  'Every model here is CC0 1.0 (public domain dedication), packed from the kits below by `scripts/pack-assets.mjs` from `scripts/selection.json` (ADR-0024 Decision 1). The kits are downloaded from their pages into `apps/board/kits/` (not committed); the packed files are.',
  '',
  '| Kit | Source | Licence |',
  '|---|---|---|',
  ...Object.values(selection.kits).map((k) => `| ${k.name} | ${k.url} | ${k.licence} |`),
  '',
  '| Model | Kit | File | For | Bytes | Triangles | Native size |',
  '|---|---|---|---|---|---|---|',
  ...manifest.models.map((m) => `| ${m.id} | ${m.kit} | ${m.file} | ${m.for} | ${m.bytes} | ${m.triangles} | ${m.native.size.join(' × ')} |`),
  '',
  `Total: ${manifest.models.length} models, ${totalBytes} bytes.`,
  '',
];
writeFileSync(join(board, 'public', 'assets', 'MANIFEST.md'), lines.join('\n'));
console.log(`total ${totalBytes} bytes in ${manifest.models.length} models`);

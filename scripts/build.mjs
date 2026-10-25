// Build script (esbuild). Usage:
//   node scripts/build.mjs            -> production build in dist/
//   node scripts/build.mjs --serve    -> dev server with live rebuild on http://localhost:5173
//   node scripts/build.mjs --single   -> additionally writes dist-single/index.html (JS+CSS inlined, one file)
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const serve = args.has('--serve');
const single = args.has('--single');
const outdir = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const common = {
  entryPoints: [join(root, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  mainFields: ['module', 'browser', 'main'],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  legalComments: 'none',
  logLevel: 'info',
};

function writeHtml(scriptTag) {
  const tpl = readFileSync(join(root, 'index.html'), 'utf8');
  return tpl.replace('<!--GAME_SCRIPT-->', scriptTag);
}

function copyPublic() {
  const pub = join(root, 'public');
  if (existsSync(pub)) cpSync(pub, outdir, { recursive: true });
}

if (serve) {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  copyPublic();
  writeFileSync(join(outdir, 'index.html'), writeHtml('<script src="./game.js"></script>'));
  const ctx = await esbuild.context({ ...common, outfile: join(outdir, 'game.js'), sourcemap: true });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, port: 5173, host: '0.0.0.0' });
  console.log(`\n  BOUNCE REBORN dev server -> http://localhost:${port}\n`);
} else {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(join(outdir, 'assets'), { recursive: true });
  copyPublic();
  const result = await esbuild.build({ ...common, write: false, minify: true, sourcemap: false, outfile: 'game.js' });
  const code = result.outputFiles[0].contents;
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
  const file = `assets/game.${hash}.js`;
  writeFileSync(join(outdir, file), code);
  writeFileSync(join(outdir, 'index.html'), writeHtml(`<script src="./${file}"></script>`));
  writeFileSync(join(outdir, '.nojekyll'), '');
  console.log(`built dist/${file} (${(code.length / 1024).toFixed(0)} KB)`);
  if (single) {
    const singleDir = join(root, 'dist-single');
    mkdirSync(singleDir, { recursive: true });
    const js = Buffer.from(code).toString('utf8').replace(/<\/script/gi, '<\\/script');
    let html = writeHtml(`<script>${js}</script>`);
    // Inline the icon as data URI so the single file has no external references.
    const iconPath = join(root, 'public/icon-192.png');
    if (existsSync(iconPath)) {
      const b64 = readFileSync(iconPath).toString('base64');
      html = html.replace(/href="\.\/icon-192\.png"/g, `href="data:image/png;base64,${b64}"`);
    }
    html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');
    writeFileSync(join(singleDir, 'index.html'), html);
    console.log(`built dist-single/index.html (${(html.length / 1024).toFixed(0)} KB)`);
  }
}

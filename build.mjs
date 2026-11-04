// Builds the app into docs/, which GitHub Pages serves.
// Output is one self-contained index.html plus the offline worker and icons.
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';

const OUT = 'docs';
await fs.mkdir(OUT, { recursive: true });

const bundle = (preview) => build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: ['safari15', 'chrome100'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', __PREVIEW__: String(preview) },
  loader: { '.js': 'jsx' },
});
const js = (await bundle(false)).outputFiles[0].text;
// Open Props supplies the shared scales (sizes, easings); the app's own tokens in styles.css build on them.
const OPEN_PROPS = ['sizes', 'easings'];
const openProps = (await Promise.all(OPEN_PROPS.map((f) => fs.readFile(`node_modules/open-props/${f}.min.css`, 'utf8')))).join('');
const css = openProps + await fs.readFile('src/styles.css', 'utf8');
const version = crypto.createHash('sha1').update(js + css).digest('hex').slice(0, 10);

// The design system's three typefaces ship with the app, so it works offline
// and never waits on a font service.
await fs.mkdir(`${OUT}/fonts`, { recursive: true });
const NM = 'node_modules';
const FONTS = [
  { file: 'instrument-serif-normal.woff2', src: `${NM}/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2`, family: 'Instrument Serif', weight: '400', style: 'normal' },
  { file: 'instrument-serif-italic.woff2', src: `${NM}/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2`, family: 'Instrument Serif', weight: '400', style: 'italic' },
  { file: 'dm-sans.woff2', src: `${NM}/@fontsource-variable/dm-sans/files/dm-sans-latin-standard-normal.woff2`, family: 'DM Sans', weight: '100 1000', style: 'normal' },
  { file: 'dm-sans-italic.woff2', src: `${NM}/@fontsource-variable/dm-sans/files/dm-sans-latin-standard-italic.woff2`, family: 'DM Sans', weight: '100 1000', style: 'italic' },
  { file: 'caveat.woff2', src: `${NM}/@fontsource/caveat/files/caveat-latin-500-normal.woff2`, family: 'Caveat', weight: '500', style: 'normal' },
];
await fs.rm(`${OUT}/fonts`, { recursive: true, force: true });
await fs.mkdir(`${OUT}/fonts`, { recursive: true });
for (const f of FONTS) await fs.copyFile(f.src, `${OUT}/fonts/${f.file}`);
const fontFaces = FONTS.map((f) => `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};font-display:swap;src:url(fonts/${f.file}) format('woff2')}`).join('');

const html = `<!doctype html>
<html lang="en" data-palette="2">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>note to self</title>
<meta name="theme-color" content="#FAF9F7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#262624" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="note to self">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="preload" href="fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/instrument-serif-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${fontFaces}${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
await fs.writeFile(`${OUT}/index.html`, html);

const sw = (await fs.readFile('src/sw.js', 'utf8')).replace('__VERSION__', version);
await fs.writeFile(`${OUT}/sw.js`, sw);

await fs.writeFile(`${OUT}/manifest.webmanifest`, JSON.stringify({
  name: 'note to self',
  short_name: 'note to self',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#FAF9F7',
  theme_color: '#FAF9F7',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}, null, 2));

// Icon: three colour blocks on cream, in Theme 2 (Linen) colours: queen pink, lavender dust, azureish white.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FAF9F7"/>
  <rect x="96" y="96" width="150" height="320" rx="48" fill="#E8CCD7"/>
  <rect x="266" y="96" width="150" height="150" rx="75" fill="#CFC9DD"/>
  <rect x="266" y="266" width="150" height="150" rx="48" fill="#DEE5ED"/>
</svg>`;
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(`${OUT}/${name}`);
}
await fs.writeFile(`${OUT}/fonts/LICENSE.txt`, 'Instrument Serif, DM Sans and Caveat are licensed under the SIL Open Font License 1.1.\n');
await fs.writeFile(`${OUT}/.nojekyll`, '');
// A hosted preview with sample data (no GitHub, no offline worker), written as
// page content only, since the preview host supplies the document skeleton.
const previewJs = (await bundle(true)).outputFiles[0].text;
await fs.rm('preview/fonts', { recursive: true, force: true });
await fs.mkdir('preview/fonts', { recursive: true });
for (const f of FONTS) await fs.copyFile(f.src, `preview/fonts/${f.file}`);
await fs.writeFile('preview/index.html', `<title>note to self</title>
<style>${fontFaces}${css}</style>
<div id="root"></div>
<script>${previewJs.replace(/<\/script/gi, '<\\/script')}</script>
`);
console.log(`Built ${OUT}/ (version ${version}, ${(html.length / 1024).toFixed(0)} KB)`);

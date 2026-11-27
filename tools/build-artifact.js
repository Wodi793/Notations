// Builds dist/notations-artifact.html, one self-contained file for the Claude artifact, and stamps sw.js with
// a version taken from the app files' contents. Run at the end of every stage: node tools/build-artifact.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const index = read('index.html');
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const body = index.split('<!-- APP:BODY -->')[1].split('<!-- /APP:BODY -->')[0];
const css = read('css/app.css');
const labCases = JSON.parse(read('tests/lab-cases.json')).cases;
const progCases = JSON.parse(read('tests/progressions.json'));
// Piano samples are inlined only if the whole set is under 2 MB; otherwise the artifact uses the synthesized piano.
const sampleDir = path.join(root, 'samples/piano'), sampleFiles = fs.existsSync(sampleDir) ? fs.readdirSync(sampleDir).filter((f) => f.endsWith('.m4a')) : [];
const sampleBytes = sampleFiles.reduce((a, f) => a + fs.statSync(path.join(sampleDir, f)).size, 0);
const samples = sampleBytes && sampleBytes < 2 * 1024 * 1024 ? Object.fromEntries(sampleFiles.map((f) => [f.replace('.m4a', ''), fs.readFileSync(path.join(sampleDir, f)).toString('base64')])) : null;
const stripExports = (s) => s.replace(/\nif \(typeof module[^\n]*\n?/g, '\n');
const out = `<title>Notations</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap">
<style>
${css}</style>
${body}
<script>window.NOTATIONS_BUILD = 'artifact'; window.NOTATIONS_LAB_CASES = ${JSON.stringify(labCases)}; window.NOTATIONS_PROG_CASES = ${JSON.stringify(progCases)};${samples ? ` window.NOTATIONS_PIANO_SAMPLES = ${JSON.stringify(samples)};` : ''}</script>
<script type="text/plain" id="worker-src">
${read('js/engine-worker.js')}</script>
${scripts.map((s) => `<script${s === 'js/engine.js' ? ' id="engine-src"' : s === 'js/progcheck.js' ? ' id="progcheck-src"' : ''}>\n/* ${s} */\n${stripExports(read(s))}</script>`).join('\n')}
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/notations-artifact.html'), out);
// Stamp the service worker with a hash of everything it caches.
const sw = read('sw.js');
const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
const h = crypto.createHash('sha256');
for (const f of shell) if (f !== './') h.update(fs.readFileSync(path.join(root, f)));
const version = h.digest('hex').slice(0, 10);
fs.writeFileSync(path.join(root, 'sw.js'), sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`));
console.log(`dist/notations-artifact.html ${(out.length / 1024).toFixed(0)} KB (piano samples ${samples ? 'inlined, ' + (sampleBytes / 1024).toFixed(0) + ' KB' : 'not inlined'}); sw.js version ${version}`);

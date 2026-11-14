// Builds the single-file artifact: node build.js  →  notations.html
const fs = require('fs');
const r = (f) => fs.readFileSync(__dirname + '/src/' + f, 'utf8');
const strip = (s) => s.replace(/\nif \(typeof module[^\n]*\n?/g, '\n');
const out = `<title>Notations</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap">
<style>
${r('app.css')}</style>
${r('app.html')}
<script>
${strip(r('engine.js'))}</script>
<script>
${strip(r('tests.js'))}</script>
<script>
(function () {
'use strict';
${r('app-core.js')}
${r('app-sheets.js')}
})();
</script>
`;
fs.writeFileSync(__dirname + '/notations.html', out);
console.log('notations.html', (out.length / 1024).toFixed(0) + ' KB');

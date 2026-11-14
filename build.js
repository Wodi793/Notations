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
// Standalone page for hosting (GitHub Pages) and installing to the Home Screen.
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Notations">
<meta name="theme-color" content="#000000">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<style>html{box-sizing:border-box;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);background:#000}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${out}</body>
</html>
`;
fs.writeFileSync(__dirname + '/index.html', page);
fs.writeFileSync(__dirname + '/manifest.webmanifest', JSON.stringify({ name: 'Notations', short_name: 'Notations', description: 'Translates chord voicings between piano and fretted instruments.', start_url: './', scope: './', display: 'standalone', background_color: '#000000', theme_color: '#000000', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }, null, 1));
console.log('notations.html', (out.length / 1024).toFixed(0) + ' KB');

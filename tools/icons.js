// Exports the PNG icons from the master SVG: node tools/icons.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../icons');
const master = fs.readFileSync(path.join(dir, 'notations-icon.svg'), 'utf8');
// Favicon only: the five lines are thickened so they stay distinct at 32 px. The master is untouched.
const favicon = master.replace(/stroke-width="2.6"/g, 'stroke-width="4.2"');
(async () => {
  const b = await chromium.launch();
  for (const [file, size, svg] of [['icon-180.png', 180, master], ['icon-192.png', 192, master], ['icon-512.png', 512, master], ['favicon-32.png', 32, favicon]]) {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:#050807">${svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body>`);
    await p.screenshot({ path: path.join(dir, file), omitBackground: false });
    await p.close();
  }
  await b.close();
  console.log('icons written');
})();

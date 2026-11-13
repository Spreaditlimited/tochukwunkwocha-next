// Reproducible vector artwork refined from the ImageGen brand concept.
// Font outlines are embedded in the exported SVGs; no font files are shipped.
const fs = require('node:fs');
const path = require('node:path');
const fontkit = require('fontkit');
const sharp = require('sharp');
const out = path.join(__dirname, '../public/brand');
const regular = fontkit.openSync('/System/Library/Fonts/Supplemental/Arial.ttf');
const bold = fontkit.openSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
const lime = '#c1ec8e', cream = '#f4f6f1', forest = '#141b17';
const mark = (color) => `<g fill="none" stroke="${color}" stroke-linecap="butt" stroke-linejoin="round"><path d="M224 93 A102 102 0 1 0 230 128" stroke-width="20"/><path d="M68 174 C84 205 119 211 151 199 C180 188 194 165 194 138" stroke-width="11"/></g><path fill="${color}" d="M106 65 L137 48 L137 94 H193 C189 110 180 118 161 118 H137 V156 C137 179 150 186 169 179 C161 199 143 204 125 196 C112 190 106 177 106 158 V118 H76 L88 94 H106 Z"/>`;
function svg(viewBox, title, content) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="brand-title"><title id="brand-title">${title}</title>${content}</svg>\n`; }
function lettering(text, font, size, tracking, x, baseline, color) {
  const run = font.layout(text); let cursor = x;
  const parts = run.glyphs.map((glyph, i) => {
    const pos = run.positions[i];
    const element = `<path fill="${color}" d="${glyph.path.toSVG()}" transform="translate(${(cursor + pos.xOffset * size / font.unitsPerEm).toFixed(3)} ${(baseline - pos.yOffset * size / font.unitsPerEm).toFixed(3)}) scale(${size / font.unitsPerEm} ${-size / font.unitsPerEm})"/>`;
    cursor += pos.xAdvance * size / font.unitsPerEm + tracking;
    return element;
  }).join('');
  return { parts, end: cursor - tracking };
}
function logo(symbolColor, textColor) {
  const top = lettering('TOCHUKWU’S', regular, 28, 6.5, 290, 102, textColor);
  const bottom = lettering('INNER CIRCLE', bold, 64, 1.2, 286, 178, textColor);
  const width = Math.ceil(Math.max(top.end, bottom.end) + 24);
  return svg(`0 0 ${width} 256`, 'Tochukwu’s Inner Circle', mark(symbolColor) + top.parts + bottom.parts);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const icon = svg('0 0 256 256', 'Tochukwu’s Inner Circle icon', mark(lime));
  const primary = logo(lime, cream);
  const light = logo('#244a35', '#172c20');
  const app = svg('0 0 256 256', 'Tochukwu’s Inner Circle app icon', `<rect width="256" height="256" rx="52" fill="${forest}"/><g transform="translate(16 16) scale(.875)">${mark(lime)}</g>`);
  fs.writeFileSync(path.join(out, 'inner-circle-icon.svg'), icon);
  fs.writeFileSync(path.join(out, 'inner-circle-logo.svg'), primary);
  fs.writeFileSync(path.join(out, 'inner-circle-logo-light.svg'), light);
  fs.writeFileSync(path.join(out, 'inner-circle-app-icon.svg'), app);
  await Promise.all([
    sharp(Buffer.from(icon)).resize(1024).png().toFile(path.join(out, 'inner-circle-icon.png')),
    sharp(Buffer.from(primary)).resize(1920).png().toFile(path.join(out, 'inner-circle-logo.png')),
    sharp(Buffer.from(light)).resize(1920).png().toFile(path.join(out, 'inner-circle-logo-light.png')),
    sharp(Buffer.from(app)).resize(512).png().toFile(path.join(out, 'inner-circle-app-icon.png')),
    sharp(Buffer.from(app)).resize(32).png().toFile(path.join(out, 'favicon.png')),
    sharp(Buffer.from(app)).resize(180).png().toFile(path.join(out, 'apple-touch-icon.png')),
  ]);
  const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="820" viewBox="0 0 1440 820"><rect width="1440" height="820" fill="${forest}"/><text x="80" y="85" fill="#98ab9b" font-size="14" font-family="Arial" letter-spacing="4">TOCHUKWU’S INNER CIRCLE / BRAND IDENTITY</text><svg x="70" y="160" width="1000" height="295" viewBox="${primary.match(/viewBox="([^"]+)/)[1]}">${primary.replace(/^[\s\S]*?<title[^>]*>[\s\S]*?<\/title>/,'').replace(/<\/svg>\s*$/,'')}</svg><line x1="80" y1="490" x2="1360" y2="490" stroke="#ffffff20"/><svg x="90" y="550" width="150" height="150" viewBox="0 0 256 256">${mark(lime)}</svg><svg x="330" y="550" width="150" height="150" viewBox="0 0 256 256"><rect width="256" height="256" rx="52" fill="#203126"/><g transform="translate(16 16) scale(.875)">${mark(lime)}</g></svg><text x="610" y="590" fill="${cream}" font-size="24" font-family="Arial">An inner circle. A personal mark.</text><text x="610" y="635" fill="#98ab9b" font-size="17" font-family="Arial">Pale lime · Forest green · Warm off-white</text><text x="610" y="675" fill="#98ab9b" font-size="17" font-family="Arial">Primary logo / Standalone mark / App icon</text></svg>`;
  await sharp(Buffer.from(preview)).png().toFile(path.join(out, 'brand-preview.png'));
  console.log('Generated SVG logos, transparent PNGs, app icon, favicon, and brand preview.');
})();

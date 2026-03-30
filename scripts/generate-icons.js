// Run with: node scripts/generate-icons.js
// Generates PWA icons using canvas (node-canvas or just creates placeholder SVGs)
const fs = require('fs');
const sizes = [192, 512];

for (const size of sizes) {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#F47820"/>
    <text x="50%" y="55%" text-anchor="middle" dominant-baseline="central"
          font-family="Arial,sans-serif" font-weight="700" font-size="${size * 0.5}" fill="white">S</text>
  </svg>`;
  fs.writeFileSync(`public/icon-${size}.svg`, svg);
  console.log('Created icon-' + size + '.svg');
}
// Note: For PNG, convert SVGs with: npx sharp-cli --input public/icon-192.svg --output public/icon-192.png
console.log('SVG icons created. Convert to PNG for production.');

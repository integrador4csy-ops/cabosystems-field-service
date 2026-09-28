const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgRaw = fs.readFileSync('./assets/images/Logo-CSY- Navbar.svg', 'utf8');

// Extract just the path data from the SVG
const pathsMatch = svgRaw.match(/<g id="Capa_1[^"]*"[^>]*>([\s\S]*?)<\/g>/);
const paths = pathsMatch ? pathsMatch[1] : '';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 477.6 122.63">${paths}</svg>`;

async function createIcons() {
  // App icon: orange rounded square with white CSY logo centered
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="200" fill="#f78c26"/>
    <g transform="translate(100, 350) scale(1.8)">
      ${paths}
    </g>
  </svg>`;

  // Adaptive icon (needs safe zone - logo centered)
  const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="#f78c26"/>
    <g transform="translate(100, 350) scale(1.8)">
      ${paths}
    </g>
  </svg>`;

  // Favicon
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="200" fill="#f78c26"/>
    <g transform="translate(100, 350) scale(1.8)">
      ${paths}
    </g>
  </svg>`;

  // Splash
  const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
    <rect width="1284" height="2778" fill="#ffffff"/>
    <g transform="translate(180, 1200) scale(2.0)">
      ${paths}
    </g>
  </svg>`;

  await sharp(Buffer.from(iconSvg)).resize(1024, 1024).png().toFile('./assets/images/icon.png');
  console.log('icon.png created');

  await sharp(Buffer.from(adaptiveSvg)).resize(1024, 1024).png().toFile('./assets/images/adaptive-icon.png');
  console.log('adaptive-icon.png created');

  await sharp(Buffer.from(faviconSvg)).resize(48, 48).png().toFile('./assets/images/favicon.png');
  console.log('favicon.png created');

  await sharp(Buffer.from(splashSvg)).resize(1284, 2778).png().toFile('./assets/images/splash-icon.png');
  console.log('splash-icon.png created');

  const files = ['icon.png', 'adaptive-icon.png', 'favicon.png', 'splash-icon.png'];
  for (const f of files) {
    const meta = await sharp(path.join('./assets/images', f)).metadata();
    console.log(`${f}: ${meta.width}x${meta.height}`);
  }

  // Generate full unified CaboSystems Field Service Logos
  const fullSvgWhite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 160" width="1000" height="320">
  <defs>
    <style>
      .cls-1{fill:#FFFFFF;fill-rule:evenodd;}
      .cls-2{fill:#f78c26;fill-rule:evenodd;}
      .st-text{font-family:'Montserrat',sans-serif,Arial;font-weight:800;font-size:22px;fill:#f78c26;letter-spacing:6px;}
    </style>
  </defs>
  <g transform="translate(11.2, 10)">
    ${paths}
  </g>
  <text x="250" y="146" text-anchor="middle" class="st-text">FIELD SERVICE</text>
</svg>`;

  const pathsDark = paths
    .replace(/class="cls-1"/g, 'style="fill:#161c22;fill-rule:evenodd;"')
    .replace(/class="cls-2"/g, 'style="fill:#f78c26;fill-rule:evenodd;"');

  const fullSvgDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 160" width="1000" height="320">
  <defs>
    <style>
      .st-text{font-family:'Montserrat',sans-serif,Arial;font-weight:800;font-size:22px;fill:#f78c26;letter-spacing:6px;}
    </style>
  </defs>
  <g transform="translate(11.2, 10)">
    ${pathsDark}
  </g>
  <text x="250" y="146" text-anchor="middle" class="st-text">FIELD SERVICE</text>
</svg>`;

  fs.writeFileSync('./assets/images/Logo-CaboSystems-Field-Service-White.svg', fullSvgWhite, 'utf8');
  fs.writeFileSync('./assets/images/Logo-CaboSystems-Field-Service-Dark.svg', fullSvgDark, 'utf8');
  await sharp(Buffer.from(fullSvgWhite)).png().toFile('./assets/images/Logo-CaboSystems-Field-Service-White.png');
  await sharp(Buffer.from(fullSvgDark)).png().toFile('./assets/images/Logo-CaboSystems-Field-Service-Dark.png');
  console.log('Logo-CaboSystems-Field-Service SVG & PNG created successfully!');
}

createIcons().catch(e => console.error(e));

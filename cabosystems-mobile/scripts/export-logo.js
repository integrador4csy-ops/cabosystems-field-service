const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, '../assets/images/Logo-CSY- Navbar.svg');
const svgRaw = fs.readFileSync(svgPath, 'utf8');
const pathsMatch = svgRaw.match(/<g id=Capa_1[^]*[^>]*>([\s\S]*?)<\/g>/);
const paths = pathsMatch ? pathsMatch[1] : '';

// 1. Unified SVG White with Orange (ideal for dark backgrounds like the app header)
const fullSvgWhite = <?xml version=1.0 encoding=UTF-8?>
<svg xmlns=http://www.w3.org/2000/svg viewBox=0 0 500 160 width=1000 height=320>
 <style>
 .cls-1 { fill: #FFFFFF; }
 .cls-2 { fill: #f78c26; }
 .st-text { font-family: 'Montserrat', sans-serif, Arial; font-weight: 800; font-size: 22px; fill: #f78c26; letter-spacing: 6px; }
 </style>
 <g transform=translate(11.2, 10)>
 
 </g>
 <text x=250 y=146 text-anchor=middle class=st-text>FIELD SERVICE</text>
</svg>;

// 2. Unified SVG Dark with Orange (ideal for light backgrounds, papers, presentations)
const pathsDark = paths
 .replace(/class=cls-1/g, 'class=cls-dark')
 .replace(/class=cls-2/g, 'class=cls-2');

const fullSvgDark = <?xml version=1.0 encoding=UTF-8?>
<svg xmlns=http://www.w3.org/2000/svg viewBox=0 0 500 160 width=1000 height=320>
 <style>
 .cls-dark { fill: #161c22; }
 .cls-2 { fill: #f78c26; }
 .st-text { font-family: 'Montserrat', sans-serif, Arial; font-weight: 800; font-size: 22px; fill: #f78c26; letter-spacing: 6px; }
 </style>
 <g transform=translate(11.2, 10)>
 
 </g>
 <text x=250 y=146 text-anchor=middle class=st-text>FIELD SERVICE</text>
</svg>;

const outDir = path.join(__dirname, '../assets/images');
const whiteSvgPath = path.join(outDir, 'Logo-CaboSystems-Field-Service-White.svg');
const darkSvgPath = path.join(outDir, 'Logo-CaboSystems-Field-Service-Dark.svg');
const whitePngPath = path.join(outDir, 'Logo-CaboSystems-Field-Service-White.png');
const darkPngPath = path.join(outDir, 'Logo-CaboSystems-Field-Service-Dark.png');

fs.writeFileSync(whiteSvgPath, fullSvgWhite, 'utf8');
fs.writeFileSync(darkSvgPath, fullSvgDark, 'utf8');

async function exportPngs() {
 await sharp(Buffer.from(fullSvgWhite)).png().toFile(whitePngPath);
 await sharp(Buffer.from(fullSvgDark)).png().toFile(darkPngPath);
 console.log('SUCCESS: Generated full SVG and PNG logos:');
 console.log('1. ' + whiteSvgPath);
 console.log('2. ' + darkSvgPath);
 console.log('3. ' + whitePngPath);
 console.log('4. ' + darkPngPath);
}

exportPngs().catch(console.error);

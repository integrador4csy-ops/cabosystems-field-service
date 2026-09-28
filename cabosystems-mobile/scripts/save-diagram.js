const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const width = 1600;
const height = 1020;

let lines = [];
let elements = [];

function addLine(x1, y1, x2, y2, dashed) {
  const dash = dashed ? ' stroke-dasharray="6,4"' : '';
  lines.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#1e293b" stroke-width="2"' + dash + ' />');
}

function addEntity(name, x, y, w, h) {
  w = w || 150;
  h = h || 50;
  const rx = x - w / 2;
  const ry = y - h / 2;
  elements.push(
    '<g>' +
    '<rect x="' + rx + '" y="' + ry + '" width="' + w + '" height="' + h + '" fill="#ffffff" stroke="#0f172a" stroke-width="2.5" rx="2" />' +
    '<text x="' + x + '" y="' + (y + 6) + '" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#0f172a">' + name + '</text>' +
    '</g>'
  );
}

function addRelationship(name, x, y, w, h, card) {
  w = w || 130;
  h = h || 55;
  const points = x + ',' + (y - h/2) + ' ' + (x + w/2) + ',' + y + ' ' + x + ',' + (y + h/2) + ' ' + (x - w/2) + ',' + y;
  const cardLabel = card ? '<text x="' + x + '" y="' + (y - h/2 - 8) + '" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#475569">' + card + '</text>' : '';
  elements.push(
    '<g>' +
    '<polygon points="' + points + '" fill="#ffffff" stroke="#0f172a" stroke-width="2" />' +
    '<text x="' + x + '" y="' + (y + 5) + '" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#0f172a">' + name + '</text>' +
    cardLabel +
    '</g>'
  );
}

function addAttribute(name, x, y, isPk, rx, ry) {
  rx = rx || 48;
  ry = ry || 21;
  const underline = isPk ? ' font-weight="bold" text-decoration="underline"' : '';
  elements.push(
    '<g>' +
    '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="#ffffff" stroke="#334155" stroke-width="1.8" />' +
    '<text x="' + x + '" y="' + (y + 5) + '" font-family="Arial, sans-serif" font-size="13"' + underline + ' text-anchor="middle" fill="#0f172a">' + name + '</text>' +
    '</g>'
  );
}

function addLabel(text, x, y) {
  elements.push('<text x="' + x + '" y="' + y + '" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0f172a">' + text + '</text>');
}

// 1. Entities Coordinates
const P_PROY = { x: 280, y: 280 };
const P_PERF = { x: 1300, y: 280 };
const P_TAREA = { x: 790, y: 470 };
const P_PEND = { x: 280, y: 760 };
const P_SUBT = { x: 790, y: 780 };
const P_REG = { x: 1300, y: 760 };

// Atributos PROYECTO
const attrProy = [
  { name: 'id', isPk: true, x: 130, y: 190, rx: 42 },
  { name: 'desarrollo', isPk: false, x: 240, y: 170, rx: 54 },
  { name: 'villa', isPk: false, x: 370, y: 180, rx: 42 },
  { name: 'estatus', isPk: false, x: 110, y: 280, rx: 45 },
  { name: 'descripcion', isPk: false, x: 130, y: 370, rx: 58 }
];
attrProy.forEach(function(a) {
  addLine(P_PROY.x, P_PROY.y, a.x, a.y);
  addAttribute(a.name, a.x, a.y, a.isPk, a.rx, 21);
});

// Atributos PERFIL
const attrPerf = [
  { name: 'id', isPk: true, x: 1300, y: 160, rx: 42 },
  { name: 'nombre', isPk: false, x: 1170, y: 180, rx: 48 },
  { name: 'rol', isPk: false, x: 1420, y: 180, rx: 44 },
  { name: 'activo', isPk: false, x: 1460, y: 280, rx: 44 }
];
attrPerf.forEach(function(a) {
  addLine(P_PERF.x, P_PERF.y, a.x, a.y);
  addAttribute(a.name, a.x, a.y, a.isPk, a.rx, 21);
});

// Atributos TAREA
const attrTarea = [
  { name: 'id', isPk: true, x: 790, y: 340, rx: 42 },
  { name: 'titulo', isPk: false, x: 690, y: 375, rx: 44 },
  { name: 'estatus', isPk: false, x: 890, y: 375, rx: 46 },
  { name: 'descripcion', isPk: false, x: 650, y: 550, rx: 58 }
];
attrTarea.forEach(function(a) {
  addLine(P_TAREA.x, P_TAREA.y, a.x, a.y);
  addAttribute(a.name, a.x, a.y, a.isPk, a.rx, 21);
});

// Atributos SUBTAREA
const attrSubt = [
  { name: 'id', isPk: true, x: 660, y: 890, rx: 42 },
  { name: 'titulo', isPk: false, x: 790, y: 900, rx: 46 },
  { name: 'completada', isPk: false, x: 920, y: 890, rx: 58 }
];
attrSubt.forEach(function(a) {
  addLine(P_SUBT.x, P_SUBT.y, a.x, a.y);
  addAttribute(a.name, a.x, a.y, a.isPk, a.rx, 21);
});

// Atributos PENDIENTE
const attrPend = [
  { name: 'id', isPk: true, x: 140, y: 680, rx: 42 },
  { name: 'descripcion', isPk: false, x: 130, y: 760, rx: 58 },
  { name: 'prioridad', isPk: false, x: 140, y: 840, rx: 50 },
  { name: 'estatus', isPk: false, x: 280, y: 880, rx: 46 }
];
attrPend.forEach(function(a) {
  addLine(P_PEND.x, P_PEND.y, a.x, a.y);
  addAttribute(a.name, a.x, a.y, a.isPk, a.rx, 21);
});

// Atributos REGISTRO_CAMPO
const attrReg = [
  { name: 'id', isPk: true, x: 1450, y: 670, rx: 42 },
  { name: 'tipo', isPk: false, x: 1470, y: 760, rx: 44 },
  { name: 'latitud', isPk: false, x: 1450, y: 840, rx: 48 },
  { name: 'longitud', isPk: false, x: 1340, y: 890, rx: 50 },
  { name: 'foto_url', isPk: false, x: 1220, y: 890, rx: 50 },
  { name: 'fecha_hora', isPk: false, x: 1100, y: 880, rx: 54 }
];
attrReg.forEach(function(a) {
  addLine(P_REG.x, P_REG.y, a.x, a.y);
  addAttribute(a.name, a.x, a.y, a.isPk, a.rx, 21);
});

// Relaciones (Rombos)
// 1. Proyecto -> Tarea (Tiene)
const R_TIENE = { x: 520, y: 395 };
addLine(P_PROY.x, P_PROY.y, R_TIENE.x, R_TIENE.y);
addLine(R_TIENE.x, R_TIENE.y, P_TAREA.x, P_TAREA.y);
addRelationship('Tiene', R_TIENE.x, R_TIENE.y, 110, 52, '1:N');
addLabel('1', 370, 325);
addLabel('N', 660, 445);

// 2. Perfil -> Tarea (Asignada a)
const R_ASIG = { x: 1060, y: 395 };
addLine(P_PERF.x, P_PERF.y, R_ASIG.x, R_ASIG.y);
addLine(R_ASIG.x, R_ASIG.y, P_TAREA.x, P_TAREA.y);
addRelationship('Asignada a', R_ASIG.x, R_ASIG.y, 130, 52, '1:N');
addLabel('1', 1200, 325);
addLabel('N', 910, 445);

// 3. Tarea -> Subtarea (Se compone)
const R_COMP = { x: 790, y: 625 };
addLine(P_TAREA.x, P_TAREA.y, R_COMP.x, R_COMP.y);
addLine(R_COMP.x, R_COMP.y, P_SUBT.x, P_SUBT.y);
addRelationship('Se compone', R_COMP.x, R_COMP.y, 130, 52, '1:N');
addLabel('1', 805, 535);
addLabel('N', 805, 725);

// 4. Proyecto -> Pendiente (Presenta)
const R_PRES = { x: 280, y: 520 };
addLine(P_PROY.x, P_PROY.y, R_PRES.x, R_PRES.y);
addLine(R_PRES.x, R_PRES.y, P_PEND.x, P_PEND.y);
addRelationship('Presenta', R_PRES.x, R_PRES.y, 110, 52, '1:N');
addLabel('1', 295, 345);
addLabel('N', 295, 695);

// 5. Tarea -> Registro_Campo (Genera)
const R_GEN = { x: 1045, y: 620 };
addLine(P_TAREA.x, P_TAREA.y, R_GEN.x, R_GEN.y);
addLine(R_GEN.x, R_GEN.y, P_REG.x, P_REG.y);
addRelationship('Genera', R_GEN.x, R_GEN.y, 110, 52, '1:N');
addLabel('1', 890, 535);
addLabel('N', 1180, 705);

// 6. Perfil -> Registro_Campo (Realiza)
const R_REAL = { x: 1300, y: 520 };
addLine(P_PERF.x, P_PERF.y, R_REAL.x, R_REAL.y);
addLine(R_REAL.x, R_REAL.y, P_REG.x, P_REG.y);
addRelationship('Realiza', R_REAL.x, R_REAL.y, 110, 52, '1:N');
addLabel('1', 1315, 345);
addLabel('N', 1315, 695);

// 7. Perfil -> Pendiente (Reporta)
const R_REP = { x: 535, y: 760 };
addLine(P_PEND.x, P_PEND.y, R_REP.x, R_REP.y);
lines.push('<path d="M ' + R_REP.x + ' ' + R_REP.y + ' C 650 760, 950 560, ' + P_PERF.x + ' ' + (P_PERF.y + 25) + '" fill="none" stroke="#1e293b" stroke-width="2" stroke-dasharray="6,4" />');
addRelationship('Reporta', R_REP.x, R_REP.y, 110, 52, '1:N');
addLabel('N', 390, 750);
addLabel('1', 1235, 335);

// Entidades (Rectangulos)
addEntity('Proyecto', P_PROY.x, P_PROY.y, 150, 50);
addEntity('Perfil (Técnico)', P_PERF.x, P_PERF.y, 160, 50);
addEntity('Tarea', P_TAREA.x, P_TAREA.y, 150, 50);
addEntity('Subtarea', P_SUBT.x, P_SUBT.y, 150, 50);
addEntity('Pendiente', P_PEND.x, P_PEND.y, 150, 50);
addEntity('Registro_Campo', P_REG.x, P_REG.y, 170, 50);

const title = '<g>' +
  '<text x="800" y="48" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="#0f172a">DIAGRAMA ENTIDAD - RELACIÓN (NOTACIÓN DE CHEN)</text>' +
  '<text x="800" y="76" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#64748b">Rectángulos = Entidades  |  Rombos = Relaciones  |  Óvalos = Atributos (Claves primarias subrayadas)  |  1:N = Cardinalidad</text>' +
  '</g>';

const svgContent = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '">\n' +
  '<rect width="100%" height="100%" fill="#ffffff" />\n' +
  title + '\n' +
  '<g id="lines">\n' + lines.join('\n') + '\n</g>\n' +
  '<g id="elements">\n' + elements.join('\n') + '\n</g>\n' +
  '</svg>';

async function main() {
  const root = path.resolve(__dirname, '..', '..');
  const svgFile = path.join(root, 'diagrama_er_chen_cabosystems.svg');
  const pngFile = path.join(root, 'diagrama_er_chen_cabosystems.png');

  fs.writeFileSync(svgFile, svgContent, 'utf8');
  console.log('Saved SVG:', svgFile);

  await sharp(Buffer.from(svgContent))
    .png({ quality: 100 })
    .toFile(pngFile);
  console.log('Saved PNG:', pngFile);

  const brainDir = 'C:\\Users\\integ\\.gemini\\antigravity\\brain\\35dcc6f4-06a0-40a3-8c67-f6365f397dbf';
  if (fs.existsSync(brainDir)) {
    fs.copyFileSync(pngFile, path.join(brainDir, 'diagrama_er_chen_cabosystems.png'));
    fs.copyFileSync(svgFile, path.join(brainDir, 'diagrama_er_chen_cabosystems.svg'));
  }
}

main().catch(console.error);

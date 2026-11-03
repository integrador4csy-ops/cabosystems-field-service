const test = require('node:test');
const assert = require('node:assert/strict');

// Import helper functions (can be tested directly or replicated logic)
function extractFileExtension(fileNameOrUrl) {
  if (!fileNameOrUrl) return '';
  const clean = fileNameOrUrl.split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

function getDocumentCategory(fileName, mimeType, url) {
  const ext = extractFileExtension(fileName) || extractFileExtension(url);
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime === 'application/pdf' || mime.includes('/pdf')) {
    return { category: 'pdf', label: 'PDF', color: '#DC2626' };
  }
  if (
    ['doc', 'docx', 'rtf', 'odt'].includes(ext) ||
    mime.includes('word') ||
    mime === 'application/msword'
  ) {
    return { category: 'word', label: ext.toUpperCase() || 'DOCX', color: '#2563EB' };
  }
  if (
    ['xls', 'xlsx', 'csv', 'tsv'].includes(ext) ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime === 'text/csv'
  ) {
    return { category: 'excel', label: ext.toUpperCase() || 'XLSX', color: '#16A34A' };
  }
  if (
    ['ppt', 'pptx'].includes(ext) ||
    mime.includes('powerpoint') ||
    mime.includes('presentation')
  ) {
    return { category: 'powerpoint', label: ext.toUpperCase() || 'PPTX', color: '#EA580C' };
  }
  if (['zip', 'rar', '7z'].includes(ext) || mime.includes('zip')) {
    return { category: 'archive', label: ext.toUpperCase() || 'ZIP', color: '#D97706' };
  }
  return { category: 'generic', label: ext.toUpperCase() || 'DOC', color: '#0D9488' };
}

test('identifies PDF documents with red theme', () => {
  const pdfInfo = getDocumentCategory('reporte_instalacion.pdf', 'application/pdf');
  assert.equal(pdfInfo.category, 'pdf');
  assert.equal(pdfInfo.label, 'PDF');
  assert.equal(pdfInfo.color, '#DC2626');
});

test('identifies Word documents with blue theme', () => {
  const docxInfo = getDocumentCategory('contrato_servicio.docx');
  assert.equal(docxInfo.category, 'word');
  assert.equal(docxInfo.label, 'DOCX');
  assert.equal(docxInfo.color, '#2563EB');

  const docInfo = getDocumentCategory('anexo.doc');
  assert.equal(docInfo.category, 'word');
  assert.equal(docInfo.label, 'DOC');
});

test('identifies Excel spreadsheets with green theme', () => {
  const xlsxInfo = getDocumentCategory('lista_precios.xlsx');
  assert.equal(xlsxInfo.category, 'excel');
  assert.equal(xlsxInfo.label, 'XLSX');
  assert.equal(xlsxInfo.color, '#16A34A');

  const csvInfo = getDocumentCategory('datos_sensores.csv', 'text/csv');
  assert.equal(csvInfo.category, 'excel');
  assert.equal(csvInfo.label, 'CSV');
});

test('identifies PowerPoint presentations with orange theme', () => {
  const pptInfo = getDocumentCategory('presentacion_cliente.pptx');
  assert.equal(pptInfo.category, 'powerpoint');
  assert.equal(pptInfo.label, 'PPTX');
  assert.equal(pptInfo.color, '#EA580C');
});

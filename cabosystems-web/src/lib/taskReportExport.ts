import { reportColumns, reportValues, reportSummary, reportPeople, type TaskReport } from './taskReports';

export async function taskReportExcel(report: TaskReport, en: boolean): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CaboSystems';
  const summary = workbook.addWorksheet(en ? 'Summary' : 'Resumen');
  summary.addRows([
    ['CaboSystems · Field Service'], [en ? 'Task activity report' : 'Informe de actividad de tareas'],
    [en ? 'From' : 'Desde', report.from], [en ? 'To' : 'Hasta', report.to],
    [en ? 'Performed by' : 'Realizado por', report.person], [en ? 'Villa' : 'Villa', report.project],
    [en ? 'Date zone' : 'Zona de fecha', 'America/Mazatlan'],
    [en ? 'Actions' : 'Acciones', report.rows.length],
    [en ? 'Tasks with activity' : 'Tareas con actividad', reportSummary(report.rows).tasks],
    [en ? 'Note' : 'Nota', en ? 'Assigned person differs from the person who performed the action. History starts when tracking was activated.' : 'El encargado asignado es distinto de quien realizó la acción. El historial comienza al activar el registro.'],
  ]);
  summary.columns = [{ width: 28 }, { width: 100 }]; summary.getColumn(2).alignment = { wrapText: true };
  const sheet = workbook.addWorksheet(en ? 'Activity' : 'Actividad', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(reportColumns(en));
  for (const row of report.rows) sheet.addRow(reportValues(row, en));
  sheet.columns = [14, 25, 25, 18, 44, 44, 32, 22, 22, 28].map(width => ({ width }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF343E48' } };
  sheet.autoFilter = { from: 'A1', to: 'J1' };
  sheet.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function taskReportPdf(report: TaskReport, en: boolean): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const people = reportPeople(report.rows, en ? 'en-US' : 'es-MX');
  // One section per identity (names may match or change), with a fresh page
  // for each person. Repeat their identity and filters on continuation pages.
  for (const [index, person] of people.entries()) {
    if (index) doc.addPage();
    doc.setFontSize(9);
    const meta = [`${report.from} — ${report.to} · America/Mazatlan`, `Villa: ${report.project}`,
      `${en ? 'Performed by' : 'Realizado por'}: ${person.name}`,
      `${person.rows.length} ${en ? 'actions' : 'acciones'} · ${reportSummary(person.rows).tasks} ${en ? 'tasks with activity' : 'tareas con actividad'}`];
    const lines = meta.map(text => doc.splitTextToSize(text, 267) as string[]);
    const tableTop = 33 + lines.reduce((height, line) => height + line.length * 4.5 + 1, 0);
    autoTable(doc, { startY: tableTop, head: [reportColumns(en)], body: person.rows.map(row => reportValues(row, en).map(value => value.replace(/→/g, ' > '))),
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' }, headStyles: { fillColor: [52, 62, 72], textColor: 255 },
      margin: { top: tableTop, bottom: 18 }, rowPageBreak: 'avoid', horizontalPageBreak: false,
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 25 }, 2: { cellWidth: 23 }, 3: { cellWidth: 18 }, 4: { cellWidth: 38 }, 5: { cellWidth: 38 } },
      willDrawPage() {
        doc.setTextColor(52, 62, 72); doc.setFontSize(18); doc.text('CaboSystems · Field Service', 14, 16);
        doc.setFontSize(12); doc.text(en ? 'Task activity report' : 'Informe de actividad de tareas', 14, 24);
        doc.setFontSize(9); let y = 31;
        for (const line of lines) { doc.text(line, 14, y); y += line.length * 4.5 + 1; }
      },
    });
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(80);
    doc.text(`${en ? 'Page' : 'Página'} ${page} / ${doc.getNumberOfPages()}`, 283, 202, { align: 'right' });
    doc.text(en ? 'Activity history. Assigned person and performer are distinct.' : 'Historial de actividad. El encargado y quien realizó la acción son distintos.', 14, 202);
  }
  return doc.output('blob');
}

export function downloadTaskReport(blob: Blob, report: TaskReport, extension: 'pdf' | 'xlsx') {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `CaboSystems-informe-${report.from}-${report.to}.${extension}`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

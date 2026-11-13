import { reportAction, reportPeople, type TaskActivity, type TaskReport } from './taskReports';

const COLORS = {
  orange: 'FFF78C26',
  slate: 'FF343E48',
  gray: 'FFF3F3F3',
  white: 'FFFFFFFF',
};

function reportDate(value: string, en: boolean) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(en ? 'en-US' : 'es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

function activityName(row: TaskActivity, en: boolean) {
  if (row.accion === 'subtarea' && row.subtarea_titulo) {
    return `${en ? 'Subtask' : 'Subtarea'}\n${row.subtarea_titulo}`;
  }
  return `${en ? 'Task' : 'Tarea'}\n${row.tarea_titulo}`;
}

function activityValues(row: TaskActivity, en: boolean) {
  return [
    row.desarrollo,
    row.villa,
    activityName(row, en),
    reportAction(row, en).replace(/→/g, ' > '),
    row.comentario?.trim() || (en ? 'No comments' : 'Sin comentarios'),
  ];
}

function activityColumns(en: boolean) {
  return en
    ? ['Development', 'Villa', 'Performed', 'Action', 'Comments']
    : ['Desarrollo', 'Villa', 'Realizó', 'Acción', 'Comentarios'];
}

function reportSections(rows: TaskActivity[], en: boolean) {
  return reportPeople(rows, en ? 'en-US' : 'es-MX').flatMap((person) => {
    const dates = new Map<string, TaskActivity[]>();
    for (const row of person.rows) {
      const values = dates.get(row.fecha) || [];
      values.push(row);
      dates.set(row.fecha, values);
    }
    return [...dates.entries()].map(([date, values]) => ({
      personId: person.id,
      title: `${reportDate(date, en)} - ${person.name}`,
      rows: values,
    }));
  });
}

async function taskReportLogo() {
  if (typeof document === 'undefined') return null;
  try {
    const response = await fetch(new URL('task-report-logo.jpg', document.baseURI));
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function taskReportExcel(report: TaskReport, en: boolean): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CaboSystems';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(en ? 'Activity' : 'Actividad', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.properties.defaultRowHeight = 22;
  sheet.columns = [24, 18, 36, 31, 52].map(width => ({ width }));

  sheet.mergeCells('A1:E1');
  const title = sheet.getCell('A1');
  title.value = en ? 'Task activity report' : 'Informe de actividad de tareas';
  title.font = { name: 'Arial', size: 18, bold: true, color: { argb: COLORS.slate } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 32;
  sheet.addRow([]).height = 8;

  const sections = reportSections(report.rows, en);
  for (const [sectionIndex, section] of sections.entries()) {
    const bandRow = sheet.addRow([section.title]);
    sheet.mergeCells(bandRow.number, 1, bandRow.number, 5);
    bandRow.height = 27;
    bandRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    const headerRow = sheet.addRow(activityColumns(en));
    headerRow.height = 25;
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.orange } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.white } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.slate } } };
    });

    for (const [rowIndex, activity] of section.rows.entries()) {
      const row = sheet.addRow(activityValues(activity, en));
      row.height = 42;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 ? COLORS.gray : COLORS.white } };
        cell.font = { name: 'Arial', size: 10, color: { argb: COLORS.slate } };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.slate } },
          left: { style: 'thin', color: { argb: COLORS.slate } },
          bottom: { style: 'thin', color: { argb: COLORS.slate } },
          right: { style: 'thin', color: { argb: COLORS.slate } },
        };
      });
    }

    if (sectionIndex < sections.length - 1) sheet.addRow([]).height = 8;
  }

  sheet.pageSetup.margins = { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  sheet.headerFooter.oddFooter = '&LCaboSystems Field Service&R&P / &N';
  sheet.pageSetup.printArea = `A1:E${Math.max(sheet.rowCount, 1)}`;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function taskReportPdf(report: TaskReport, en: boolean): Promise<Blob> {
  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    taskReportLogo(),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const sections = reportSections(report.rows, en);
  const pageWidth = doc.internal.pageSize.getWidth();
  const drawHeader = () => {
    doc.setTextColor(52, 62, 72);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(en ? 'Task activity report' : 'Informe de actividad de tareas', 14, 18);
    if (logo) doc.addImage(logo, 'JPEG', pageWidth - 46, 4, 32, 29, undefined, 'FAST');
  };

  let nextStartY = 39;
  let previousPerson = '';
  for (const [sectionIndex, section] of sections.entries()) {
    if (sectionIndex && section.personId !== previousPerson) {
      doc.addPage();
      nextStartY = 39;
    } else if (nextStartY > 175) {
      doc.addPage();
      nextStartY = 39;
    }

    autoTable(doc, {
      startY: nextStartY,
      head: [
        [{ content: section.title, colSpan: 5, styles: { fillColor: [52, 62, 72], textColor: 255, halign: 'center', fontStyle: 'bold', fontSize: 10.5, minCellHeight: 12 } }],
        activityColumns(en),
      ],
      body: section.rows.map(row => activityValues(row, en)),
      showHead: 'everyPage',
      styles: { font: 'helvetica', fontSize: 9.5, textColor: [52, 62, 72], fillColor: 255, cellPadding: 3, valign: 'middle', overflow: 'linebreak', lineColor: [52, 62, 72], lineWidth: 0.12, minCellHeight: 18 },
      headStyles: { fillColor: [247, 140, 38], textColor: 255, halign: 'center', fontStyle: 'bold', fontSize: 9.5, minCellHeight: 11 },
      alternateRowStyles: { fillColor: [243, 243, 243] },
      margin: { top: 39, right: 14, bottom: 17, left: 14 },
      rowPageBreak: 'avoid',
      horizontalPageBreak: false,
      columnStyles: {
        0: { cellWidth: 43 },
        1: { cellWidth: 33 },
        2: { cellWidth: 62 },
        3: { cellWidth: 48 },
        4: { cellWidth: 83 },
      },
      willDrawPage: drawHeader,
    });
    const table = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable;
    nextStartY = (table?.finalY || 39) + 7;
    previousPerson = section.personId;
  }

  if (!sections.length) drawHeader();
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(52, 62, 72);
    doc.text('CaboSystems Field Service', 14, 202);
    doc.text(`${en ? 'Page' : 'Página'} ${page} / ${doc.getNumberOfPages()}`, 283, 202, { align: 'right' });
  }
  return doc.output('blob');
}

export function downloadTaskReport(blob: Blob, report: TaskReport, extension: 'pdf' | 'xlsx') {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `CaboSystems-informe-${report.from}-${report.to}.${extension}`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

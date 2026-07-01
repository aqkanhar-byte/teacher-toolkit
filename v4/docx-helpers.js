const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, WidthType, Table, TableRow, TableCell, ShadingType, VerticalAlign, HeadingLevel, PageBreak } = require('docx');

const NAVY = "1F3864", GOLD = "BF8F00", LGOLD = "FFF2CC", LNAVY = "D6E4F0",
  LGREEN = "E2EFDA", LRED = "FCE4D6", WHITE = "FFFFFF", GRAY = "F2F2F2", MID = "D9D9D9";

const border0 = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const borderN = { style: BorderStyle.SINGLE, size: 4, color: NAVY };
const borderG = { style: BorderStyle.SINGLE, size: 4, color: GOLD };
const borderT = { style: BorderStyle.SINGLE, size: 2, color: MID };
const thinBorders = { top: borderT, bottom: borderT, left: borderT, right: borderT };
const navyBorders = { top: borderN, bottom: borderN, left: borderN, right: borderN };

function cell(text, opts = {}) {
  const { bold = false, italic = false, size = 20, color = "000000", font = "Arial",
    fill = WHITE, align = AlignmentType.LEFT, valign = VerticalAlign.CENTER,
    borders = thinBorders, colSpan, w = 1000 } = opts;
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: valign, columnSpan: colSpan,
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text == null ? '' : text), bold, italic, size, color, font })] })]
  });
}
function hCell(text, opts = {}) { return cell(text, { bold: true, color: WHITE, fill: NAVY, borders: navyBorders, size: 20, ...opts }); }

function para(text, opts = {}) {
  const { bold = false, size = 20, color = "000000", align = AlignmentType.LEFT,
    spacing = { before: 60, after: 60 }, font = "Arial", italic = false } = opts;
  return new Paragraph({ alignment: align, spacing, children: [new TextRun({ text: String(text == null ? '' : text), bold, size, color, font, italics: italic })] });
}

function bismillahBlock() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 200 },
    children: [new TextRun({ text: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ", bold: true, size: 32, color: GOLD, font: "Arial" })]
  });
}

function govHeader(schoolName) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 20 },
      children: [new TextRun({ text: "GOVERNMENT OF SINDH", bold: true, size: 22, color: NAVY, font: "Arial" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 20 },
      children: [new TextRun({ text: "Education & Literacy Department", size: 18, color: "595959", font: "Arial" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 6 } },
      children: [new TextRun({ text: (schoolName || 'School Name'), bold: true, size: 26, color: NAVY, font: "Arial" })] }),
  ];
}

function documentTitleBlock(title, subtitle) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: subtitle ? 20 : 160 },
      children: [new TextRun({ text: title, bold: true, size: 30, color: NAVY, font: "Arial" })]
    })
  ];
  if (subtitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: subtitle, size: 20, color: "595959", font: "Arial", italics: true })]
    }));
  }
  return children;
}

function refDateLine(refLabel, refValue, dateValue) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [new TableRow({ children: [
      new TableCell({ borders: { top: border0, bottom: border0, left: border0, right: border0 }, width: { size: 4680, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: `${refLabel}: ${refValue || '_______________'}`, size: 19, font: "Arial" })] })] }),
      new TableCell({ borders: { top: border0, bottom: border0, left: border0, right: border0 }, width: { size: 4680, type: WidthType.DXA },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Date: ${dateValue || '_______________'}`, size: 19, font: "Arial" })] })] }),
    ]})]
  });
}

function fieldsTable(pairs) {
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i], b = pairs[i + 1];
    const cells = [
      cell(`${a.label}: `, { bold: true, w: 1600, fill: GRAY, size: 19 }),
      cell(a.value || '_______________', { w: 3080, size: 19 }),
    ];
    if (b) {
      cells.push(cell(`${b.label}: `, { bold: true, w: 1600, fill: GRAY, size: 19 }));
      cells.push(cell(b.value || '_______________', { w: 3080, size: 19 }));
    } else {
      cells.push(cell('', { w: 1600, fill: WHITE, borders: { top: border0, bottom: border0, left: border0, right: border0 } }));
      cells.push(cell('', { w: 3080, fill: WHITE, borders: { top: border0, bottom: border0, left: border0, right: border0 } }));
    }
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1600, 3080, 1600, 3080], rows });
}

function bodyParagraphs(textBlocks) {
  return (textBlocks || []).map(t => para(t, { size: 21, spacing: { before: 120, after: 120 } }));
}

function signatureBlocks(blocks) {
  // blocks = [{label, name}]
  const rows = blocks.map((b, i) => new TableRow({ children: [
    new TableCell({
      borders: { top: borderT, bottom: border0, left: border0, right: border0 },
      width: { size: 9360, type: WidthType.DXA },
      margins: { top: 200, bottom: 200, left: 100, right: 100 },
      children: [
        new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: b.label, bold: true, size: 19, color: NAVY, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: `Name: ${b.name || '_______________________'}`, size: 18, font: "Arial" })] }),
        new Paragraph({ spacing: { before: 60, after: 0 }, children: [new TextRun({ text: "Signature: _______________________        Stamp:", size: 18, font: "Arial" })] }),
      ]
    })
  ]}));
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows });
}

function genericTable(headers, rows, colWidths) {
  const w = colWidths || headers.map(() => Math.floor(9360 / headers.length));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({ children: headers.map((h, i) => hCell(h, { w: w[i] })) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((c, ci) => cell(c, { w: w[ci], fill: ri % 2 === 0 ? GRAY : WHITE, size: 19 })) }))
    ]
  });
}

function footerBlock(preparedByName, schoolName, extra) {
  return [
    new Paragraph({ spacing: { before: 240, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: MID, space: 6 } },
      children: [new TextRun({ text: `${preparedByName || ''}${schoolName ? ' | ' + schoolName : ''}`, size: 18, font: "Arial", color: "595959" })] }),
    extra ? para(extra, { size: 16, color: "888888", italic: true }) : null,
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 200 },
      children: [new TextRun({ text: "generated by aqkanhar — teacher toolkit", size: 15, color: "AAAAAA", font: "Arial", italics: true })] }),
  ].filter(Boolean);
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

module.exports = {
  NAVY, GOLD, LGOLD, LNAVY, LGREEN, LRED, WHITE, GRAY, MID,
  cell, hCell, para, bismillahBlock, govHeader, documentTitleBlock, refDateLine,
  fieldsTable, bodyParagraphs, signatureBlocks, genericTable, footerBlock, pageBreak,
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, WidthType, Table, TableRow, TableCell, ShadingType, VerticalAlign
};

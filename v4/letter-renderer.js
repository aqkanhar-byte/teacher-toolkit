const H = require('./docx-helpers.js');

// For: Leave Application, Official Letter, Parent Complaint Letter, Complaint Letter, NOC
// data = { schoolName, inwardOutward:{inward,outward}, toLines:[...], subject, salutation, bodyParagraphs:[...], signatureName, signatureRole, includeStampSignature }
function renderLetter(data) {
  const { schoolName, inwardOutward, toLines, subject, salutation, bodyParagraphs, signatureName, signatureRole, includeStampSignature } = data;
  const children = [];

  children.push(H.bismillahBlock());
  children.push(...H.govHeader(schoolName));

  if (inwardOutward && (inwardOutward.inward || inwardOutward.outward)) {
    children.push(H.refDateLine('Inward No', inwardOutward.inward, null));
    children.push(H.para(`Outward No: ${inwardOutward.outward || '_______________'}        Date: _______________`, { size: 19, spacing: { before: 0, after: 160 } }));
  } else {
    children.push(H.para(`Date: _______________`, { size: 19, align: H.AlignmentType.RIGHT, spacing: { before: 0, after: 160 } }));
  }

  if (toLines && toLines.length) {
    children.push(H.para('To,', { size: 20, spacing: { before: 0, after: 20 } }));
    toLines.forEach(l => children.push(H.para(l, { size: 20, spacing: { before: 0, after: 20 } })));
    children.push(H.para('', { spacing: { before: 60, after: 60 } }));
  }

  if (subject) {
    children.push(H.para(`Subject: ${subject}`, { bold: true, size: 20, spacing: { before: 60, after: 160 } }));
  }

  if (salutation) {
    children.push(H.para(salutation, { size: 20, spacing: { before: 0, after: 120 } }));
  }

  (bodyParagraphs || []).forEach(p => children.push(H.para(p, { size: 21, spacing: { before: 100, after: 140 } })));

  children.push(H.para('', { spacing: { before: 200, after: 0 } }));

  if (includeStampSignature) {
    children.push(H.signatureBlocks([{ label: signatureRole || 'Head Master', name: signatureName }]));
  } else {
    children.push(H.para(signatureName || '', { bold: true, size: 20, spacing: { before: 100, after: 0 } }));
    children.push(H.para(signatureRole || 'Head Master', { size: 19, spacing: { before: 0, after: 0 } }));
  }

  children.push(...H.footerBlock(null, schoolName));
  return children;
}

module.exports = { renderLetter };

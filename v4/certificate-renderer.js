const H = require('./docx-helpers.js');

// Generic certificate-style renderer used for: Character, Bonafide, Transfer, Leaving,
// NOC, Experience, Salary, Prize certificates — all share the same visual shape:
// Bismillah -> Gov header -> Title -> Ref/Date -> Cert No -> body paragraph(s) -> fields table -> signature
function renderCertificate(data) {
  const { schoolName, title, certNoLabel, bodyText, fields, signatureName, signatureRole } = data;

  const children = [];
  children.push(H.bismillahBlock());
  children.push(...H.govHeader(schoolName));
  children.push(...H.documentTitleBlock(title));
  children.push(H.refDateLine(certNoLabel || 'Certificate No', '_______', '_______'));
  children.push(H.para('', { spacing: { before: 100, after: 100 } }));

  if (Array.isArray(bodyText)) {
    bodyText.forEach(t => children.push(H.para(t, { size: 21, spacing: { before: 100, after: 100 } })));
  } else {
    children.push(H.para(bodyText, { size: 21, spacing: { before: 100, after: 200 } }));
  }

  if (fields && fields.length) {
    children.push(H.para('', { spacing: { before: 60, after: 60 } }));
    children.push(H.fieldsTable(fields));
  }

  children.push(H.para('', { spacing: { before: 300, after: 0 } }));
  children.push(H.signatureBlocks([{ label: signatureRole || 'Head Master', name: signatureName }]));
  children.push(...H.footerBlock(signatureName, schoolName));

  return children;
}

module.exports = { renderCertificate };

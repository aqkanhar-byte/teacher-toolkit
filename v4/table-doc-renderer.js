const H = require('./docx-helpers.js');

// For: Result Card, Stock Register, Library Register, CRQ Answer Key tables, etc.
// data = { schoolName, title, subtitle, fieldPairs:[{label,value}...], tableHeaders, tableRows, signatures:[{label,name}], notes }
function renderTableDocument(data) {
  const { schoolName, title, subtitle, fieldPairs, tableHeaders, tableRows, signatures, notes } = data;
  const children = [];

  children.push(H.bismillahBlock());
  children.push(...H.govHeader(schoolName));
  children.push(...H.documentTitleBlock(title, subtitle));

  if (fieldPairs && fieldPairs.length) {
    children.push(H.fieldsTable(fieldPairs));
    children.push(H.para('', { spacing: { before: 100, after: 100 } }));
  }

  if (tableHeaders && tableRows) {
    children.push(H.genericTable(tableHeaders, tableRows));
    children.push(H.para('', { spacing: { before: 100, after: 100 } }));
  }

  if (notes) {
    children.push(H.para(notes, { size: 18, italic: true, color: '595959' }));
  }

  if (signatures && signatures.length) {
    children.push(H.para('', { spacing: { before: 200, after: 0 } }));
    children.push(H.signatureBlocks(signatures));
  }

  children.push(...H.footerBlock(null, schoolName));
  return children;
}

module.exports = { renderTableDocument };

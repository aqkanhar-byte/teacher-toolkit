/* Teacher uploaded a full/large book but only wants a specific page range used — cheaper and
   more focused than reading the whole attachment, and directly reduces the large-file token
   cost this app now prices for. Doesn't crop the PDF server-side (no new dependency); relies on
   Claude's own page-aware PDF reading, which is reliable for clearly-numbered pages. */
function pageRangeInstruction(pageFrom, pageTo) {
  const from = parseInt(pageFrom), to = parseInt(pageTo);
  if (!from && !to) return '';
  if (from && to) return `\nPAGE RANGE: Only use pages ${from} to ${to} of the attached document — ignore everything outside that range, even if more pages are attached.`;
  if (from) return `\nPAGE RANGE: Only use pages from ${from} onward in the attached document.`;
  return `\nPAGE RANGE: Only use pages up to ${to} in the attached document.`;
}

module.exports = { pageRangeInstruction };

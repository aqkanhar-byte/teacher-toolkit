// Maps each document type to:
//  1. an extraction prompt suffix telling Claude exactly what JSON shape to return
//  2. a renderer function that takes that JSON + form data and returns docx Paragraph/Table array

const { renderCertificate } = require('./certificate-renderer.js');
const { renderTableDocument } = require('./table-doc-renderer.js');
const { renderLetter } = require('./letter-renderer.js');
const { renderLessonPlan } = require('./lesson-plan-renderer.js');
const H = require('./docx-helpers.js');

function ageFromDOB(dobStr) {
  if (!dobStr) return '';
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return '';
  const now = new Date();
  let y = now.getFullYear() - dob.getFullYear();
  let m = now.getMonth() - dob.getMonth();
  let d = now.getDate() - dob.getDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  return `${y} years, ${m} months`;
}

// JSON schema instructions per document type — appended to the Claude prompt.
// Claude must respond with ONLY valid JSON matching this shape (no markdown fences, no extra text).
const SCHEMAS = {

  certificate: `Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{"bodyText": ["paragraph 1 text", "paragraph 2 text if needed"]}
The body text should be the certifying paragraph(s) in formal government certificate language, in the requested output language. Use the exact field values given (student name, father name, class, etc.) naturally woven into the sentence — do not invent different values.`,

  letter: `Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{"toLines": ["Recipient title line 1", "Recipient line 2 if needed"], "bodyParagraphs": ["paragraph 1", "paragraph 2", "paragraph 3 if needed"]}
Write 2-4 formal paragraphs in the requested output language, addressing the specific subject/reason given. Government office letter tone.`,

  resultCard: `Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{"subjects": [{"name":"Subject Name","total":100,"obtained":"___","grade":"___"}, ...], "result":"PASS/FAIL placeholder text", "position":"___ out of ___", "attendance":"___%"}
Tailor the subject list to the class level: ECCE/KG should use 4-5 simple developmental areas with grading words (Excellent/Good/Needs Improvement) instead of numeric marks; Class 1-5 use standard 6 primary subjects each /100; Class 6-8 add Science and Computer; Class 9-12 use proper SSC/HSC subject combinations with /100 or /75 marks as appropriate and A1/A/B/C/D/F grading. Leave obtained marks and grades as blank placeholders ("___") since actual marks aren't provided — only fill in subject names, totals, and structure.`,

  attendanceSheet: `Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{"periodLabel": "the month or date range being covered", "notes": "any helpful note about how to use this sheet"}`,

  genericTable: `Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{"tableHeaders": ["Col1","Col2","Col3"], "tableRows": [["row1col1","row1col2","row1col3"], ["row2col1","row2col2","row2col3"]], "notes": "optional short note"}
Generate realistic, useful row content (placeholders where actual data isn't known, e.g. "_______" for blank entry fields) appropriate to the document type requested.`,

  lessonPlan: `Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{
  "scopeLabel": "e.g. Unit 3: Family and Friends",
  "slos": [{"level":"Remember","en":"English SLO text","ur":"Urdu translation"}, ...],
  "lessons": [{"title":"Lesson title","phases":[{"phase":"Warm-up","time":"5 min","activity":"activity description bilingual"}, {"phase":"Presentation","time":"10 min","activity":"..."}, {"phase":"Practice","time":"10 min","activity":"..."}, {"phase":"Production","time":"5 min","activity":"..."}]}, ...],
  "homework": ["task 1", "task 2", "task 3"],
  "rubric": [{"skill":"Skill name","beginning":"descriptor","developing":"descriptor","achieved":"descriptor"}, ...],
  "worksheetActivities": [{"title":"Activity 1 title","instructions":"full bilingual instructions"}, ...]
}
Generate 3 lessons minimum, 4-5 SLOs across Bloom's levels, at least 4 rubric rows, and 4 worksheet activities. Follow Sindh Textbook Board curriculum standards. Output language per the language instruction given.`,

  examPaper: `Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{"timeAllowed":"1.5 Hours","totalMarks":50,"mcqs":[{"question":"...","options":["a) ...","b) ...","c) ...","d) ..."]}, ...],"shortQuestions":["q1","q2",...],"longQuestions":["q1","q2",...]}
Generate the exact count of MCQs/short/long questions requested, based directly on the specified syllabus scope.`,

  crqPaper: `Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{"mcqs":[{"question":"...","options":["a) ...","b) ...","c) ...","d) ..."]}, ...],"shortQuestions":["q1 (3 marks)","q2 (3 marks)",...],"longQuestions":["q1 (5 marks)","q2 (5 marks)",...],"bloomCoverage":{"Remember":"Q1-Q4","Understand":"Q5-Q8"},"answerKey": {"mcqAnswers":["a","c","b",...],"shortAnswers":["model answer 1","model answer 2"],"longAnswers":["model answer with marking scheme 1","model answer with marking scheme 2"]}}
Only include answerKey if explicitly requested. Generate the exact counts requested, directly based on the specified scope.`,
};

const CONFIG = {

  'Character Certificate': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'Character Certificate', certNoLabel: 'Certificate No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master',
    fields: [
      { label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName },
      { label: 'Class', value: d.className }, { label: 'G.R No', value: d.grNumber },
      { label: 'Seat No', value: d.seatNumber }, { label: 'Purpose', value: d.purpose },
    ]
  })},

  'Bonafide Certificate': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'Bonafide Certificate', certNoLabel: 'Certificate No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master',
    fields: [
      { label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName },
      { label: 'Class', value: d.className }, { label: 'G.R No', value: d.grNumber },
      { label: 'Purpose', value: d.purpose },
    ]
  })},

  'Transfer Certificate': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'Transfer Certificate', certNoLabel: 'TC No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master',
    fields: [
      { label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName },
      { label: 'Class', value: d.className }, { label: 'G.R No', value: d.grNumber },
      { label: 'Reason', value: d.reason }, { label: 'Fee Dues', value: 'NIL' },
    ]
  })},

  'School Leaving Certificate': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'School Leaving Certificate', certNoLabel: 'Certificate No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master',
    fields: [
      { label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName },
      { label: 'Class', value: d.className }, { label: 'G.R No', value: d.grNumber },
      { label: 'Date of Birth', value: d.dob }, { label: 'Reason', value: d.reason },
    ]
  })},

  'NOC Letter': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'No Objection Certificate', certNoLabel: 'Ref No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master',
    fields: [
      { label: 'Name', value: d.personName }, { label: 'CNIC', value: d.cnic },
      { label: 'Designation', value: d.designation }, { label: 'Purpose', value: d.purpose },
    ]
  })},

  'Experience Certificate': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'Experience Certificate', certNoLabel: 'Certificate No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master',
    fields: [
      { label: 'Name', value: d.personName }, { label: 'CNIC', value: d.cnic },
      { label: 'Designation', value: d.designation }, { label: 'Duration', value: d.duration },
    ]
  })},

  'Salary Certificate': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'Salary Certificate', certNoLabel: 'Certificate No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master',
    fields: [
      { label: 'Name', value: d.personName }, { label: 'CNIC', value: d.cnic },
      { label: 'Designation', value: d.designation }, { label: 'Purpose', value: d.purpose },
    ]
  })},

  'Prize Certificate': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'Certificate of Achievement', certNoLabel: 'Certificate No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master',
    fields: [
      { label: "Child's Name", value: d.studentName }, { label: 'Class', value: d.className },
      { label: 'Event', value: d.eventName }, { label: 'Position', value: d.position },
    ]
  })},

  'Affidavit': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'Affidavit', certNoLabel: 'Affidavit No',
    bodyText: j.bodyText, signatureName: d.personName, signatureRole: 'Deponent',
    fields: [{ label: 'Name', value: d.personName }, { label: 'Purpose', value: d.purpose }]
  })},

  'Leave Application': { schema: 'letter', renderer: (j, d) => renderLetter({
    schoolName: d.schoolName,
    inwardOutward: { inward: d.inwardNumber, outward: d.outwardNumber },
    toLines: j.toLines || ['The District Education Officer,', 'District Khairpur, Sindh.'],
    subject: 'Application for Grant of Leave',
    salutation: 'Respected Sir/Madam,',
    bodyParagraphs: j.bodyParagraphs,
    signatureName: d.teacherName, signatureRole: d.designation || 'Head Master',
    includeStampSignature: true
  })},

  'Official Letter': { schema: 'letter', renderer: (j, d) => renderLetter({
    schoolName: d.schoolName,
    toLines: j.toLines || [d.recipientDesignation || ''],
    subject: d.subjectLine,
    salutation: 'Respected Sir/Madam,',
    bodyParagraphs: j.bodyParagraphs,
    signatureName: d.teacherName, signatureRole: 'Head Master',
    includeStampSignature: true
  })},

  'Parent Complaint Letter': { schema: 'letter', renderer: (j, d) => renderLetter({
    schoolName: d.schoolName,
    toLines: [`Parent/Guardian of ${d.studentName || '[Student]'}`, `Father: ${d.fatherName || '[Father]'}, Class ${d.className || ''}, Roll/Seat No: ${d.seatNumber || ''}, G.R: ${d.grNumber || ''}`],
    subject: 'Regarding Your Child\u2019s Performance / Attendance / Behaviour',
    salutation: 'Dear Parent/Guardian,',
    bodyParagraphs: j.bodyParagraphs,
    signatureName: d.teacherName, signatureRole: 'Head Master',
    includeStampSignature: false
  })},

  'Complaint Letter': { schema: 'letter', renderer: (j, d) => renderLetter({
    schoolName: d.schoolName,
    toLines: j.toLines || [''],
    subject: 'Complaint',
    salutation: 'Respected Sir/Madam,',
    bodyParagraphs: j.bodyParagraphs,
    signatureName: d.teacherName, signatureRole: 'Head Master',
    includeStampSignature: false
  })},

  'Result Card': { schema: 'resultCard', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Annual Result Card', subtitle: 'Session 2025-26',
    fieldPairs: [
      { label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName },
      { label: 'Class', value: d.className }, { label: 'G.R No', value: d.grNumber },
      { label: 'Seat No', value: d.seatNumber }, { label: 'Date of Birth', value: d.dob },
      { label: 'Current Age', value: ageFromDOB(d.dob) }, { label: 'Result', value: j.result },
    ],
    tableHeaders: ['Subject', 'Total Marks', 'Obtained', 'Grade'],
    tableRows: (j.subjects || []).map(s => [s.name, String(s.total), s.obtained, s.grade]),
    notes: `Position: ${j.position || '___'}    Attendance: ${j.attendance || '___%'}`,
    signatures: [
      { label: 'Class Teacher', name: d.teacherName },
      { label: 'Principal / Head Master', name: '' },
      { label: 'Beat Officer (verification)', name: '' },
    ]
  })},

  'Attendance Sheet': { schema: 'attendanceSheet', renderer: (j, d) => {
    const days = Array.from({length: 31}, (_, i) => String(i + 1));
    const rows = Array.from({length: 25}, (_, i) => [String(i + 1), '', '', '', ...days.map(() => '')]);
    return renderTableDocument({
      schoolName: d.schoolName, title: 'Attendance Register',
      subtitle: `Class: ${d.className || ''} | Period: ${j.periodLabel || d.month || d.customDuration || ''}`,
      tableHeaders: ['Sr#', 'Name', 'G.R', 'Seat#', ...days],
      tableRows: rows,
      notes: j.notes || 'P = Present, A = Absent. Mark daily attendance in the boxes above.',
      signatures: [{ label: 'Class Teacher', name: d.teacherName }, { label: 'Head Master', name: '' }]
    });
  }},

  'Enrollment Form': { schema: 'certificate', renderer: (j, d) => {
    const children = [];
    children.push(H.bismillahBlock());
    children.push(...H.govHeader(d.schoolName));
    children.push(...H.documentTitleBlock('Student Enrollment Form'));
    children.push(H.fieldsTable([
      { label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName },
      { label: 'Class', value: d.className }, { label: 'G.R No', value: d.grNumber },
      { label: 'Date of Birth', value: d.dob }, { label: 'Current Age', value: ageFromDOB(d.dob) },
    ]));
    children.push(H.para('', { spacing: { before: 100, after: 100 } }));
    if (j.bodyText) (Array.isArray(j.bodyText) ? j.bodyText : [j.bodyText]).forEach(t => children.push(H.para(t, { size: 20, spacing: { before: 60, after: 60 } })));
    children.push(H.para('Father\u2019s Affidavit', { bold: true, size: 21, color: H.NAVY, spacing: { before: 200, after: 60 } }));
    children.push(H.para(`I, ${d.fatherName || '[Father Name]'}, do hereby solemnly declare that ${d.studentName || '[Student Name]'} is my own child, and the information provided above is true and correct to the best of my knowledge.`, { size: 19, spacing: { before: 0, after: 60 } }));
    children.push(H.para('Father\u2019s Signature: _______________________   Date: _______', { size: 19, spacing: { before: 0, after: 200 } }));
    children.push(H.signatureBlocks([
      { label: 'Class Teacher', name: d.teacherName },
      { label: 'Principal / Head Master', name: '' },
      { label: 'Beat Officer (verification)', name: '' },
    ]));
    children.push(...H.footerBlock(null, d.schoolName));
    return children;
  }},

  'Student Profile': { schema: 'certificate', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Student Profile',
    fieldPairs: [
      { label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName },
      { label: 'Class', value: d.className }, { label: 'G.R No', value: d.grNumber },
      { label: 'Seat No', value: d.seatNumber }, { label: 'Date of Birth', value: d.dob },
      { label: 'Current Age', value: ageFromDOB(d.dob) },
    ],
    tableHeaders: ['Field', 'Details'],
    tableRows: (Array.isArray(j.bodyText) ? j.bodyText : [j.bodyText || '']).map((t, i) => [`Note ${i + 1}`, t]),
  })},

  'Scholarship Form': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: 'Scholarship Application Form', certNoLabel: 'Application No',
    bodyText: j.bodyText, signatureName: d.teacherName, signatureRole: 'Head Master (Recommendation)',
    fields: [
      { label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName },
      { label: 'Class', value: d.className }, { label: 'G.R No', value: d.grNumber },
      { label: 'Seat No', value: d.seatNumber },
    ]
  })},

  'Progress Report': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Student Progress Report',
    fieldPairs: [{ label: 'Student', value: d.studentName }, { label: 'Father', value: d.fatherName }, { label: 'Class', value: d.className }],
    tableHeaders: j.tableHeaders || ['Area', 'Comments'],
    tableRows: j.tableRows || [],
    signatures: [{ label: 'Class Teacher', name: d.teacherName }]
  })},

  'Meeting Minutes': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Staff / SMC Meeting Minutes', subtitle: `Date: ${d.meetingDate || ''}`,
    tableHeaders: j.tableHeaders || ['Agenda Item', 'Discussion / Decision'],
    tableRows: j.tableRows || [],
    signatures: [{ label: 'Chairperson', name: d.teacherName }, { label: 'Secretary', name: '' }]
  })},

  'Budget Statement': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Budget Statement',
    tableHeaders: j.tableHeaders || ['Item', 'Amount'],
    tableRows: j.tableRows || [],
    signatures: [{ label: 'Head Master', name: d.teacherName }]
  })},

  'Inspection Report': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'School Inspection Report',
    tableHeaders: j.tableHeaders || ['Criteria', 'Observation'],
    tableRows: j.tableRows || [],
    signatures: [{ label: 'Head Master', name: d.teacherName }, { label: 'Inspecting Officer', name: '' }]
  })},

  'Stock Register': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Stock Register',
    tableHeaders: j.tableHeaders || ['Item', 'Quantity', 'Date Received', 'Condition'],
    tableRows: j.tableRows || [],
  })},

  'Library Register': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Library Register',
    tableHeaders: j.tableHeaders || ['Book Title', 'Student Name', 'Issue Date', 'Return Date'],
    tableRows: j.tableRows || [],
  })},

  'School Improvement Plan': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'School Improvement Plan', subtitle: 'Session 2025-26',
    tableHeaders: j.tableHeaders || ['Area', 'Target / Action'],
    tableRows: j.tableRows || [],
    signatures: [{ label: 'Head Master', name: d.teacherName }]
  })},

  'Annual Teaching Plan': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Annual Teaching Plan', subtitle: `${d.className || ''} | ${d.subject || ''} | Session 2025-26`,
    tableHeaders: j.tableHeaders || ['Month', 'Topics / Units'],
    tableRows: j.tableRows || [],
  })},

  'Monthly Teaching Plan': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Monthly Teaching Plan', subtitle: `${d.className || ''} | ${d.subject || ''}`,
    tableHeaders: j.tableHeaders || ['Week', 'Topics / Activities'],
    tableRows: j.tableRows || [],
  })},

  'Assessment Rubric': { schema: 'genericTable', renderer: (j, d) => renderTableDocument({
    schoolName: d.schoolName, title: 'Assessment Rubric', subtitle: `${d.className || ''} | ${d.subject || ''}`,
    tableHeaders: ['Skill', 'Beginning', 'Developing', 'Achieved'],
    tableRows: j.tableRows || [],
  })},

  'Event Banner Content': { schema: 'certificate', renderer: (j, d) => renderCertificate({
    schoolName: d.schoolName, title: d.eventName || 'School Event', certNoLabel: 'Event Date', bodyText: j.bodyText,
    signatureName: null, signatureRole: 'Organizing Committee',
    fields: [{ label: 'Event', value: d.eventName }, { label: 'Date', value: d.eventDate }]
  })},

  'Lesson Plan': { schema: 'lessonPlan', renderer: (j, d) => renderLessonPlan({
    schoolName: d.schoolName, teacherName: d.teacherName, className: d.className, subject: d.subject,
    scopeLabel: j.scopeLabel, slos: j.slos, lessons: j.lessons, homework: j.homework,
    rubric: j.rubric, worksheetActivities: j.worksheetActivities
  })},

  'Worksheet': { schema: 'lessonPlan', renderer: (j, d) => {
    const acts = j.worksheetActivities && j.worksheetActivities.length ? j.worksheetActivities :
      (j.lessons || []).flatMap(l => l.phases || []).map(p => ({ title: p.phase, instructions: p.activity }));
    const children = [];
    children.push(H.bismillahBlock());
    children.push(...H.govHeader(d.schoolName));
    children.push(...H.documentTitleBlock('Worksheet', j.scopeLabel));
    children.push(H.para(`Student Name: _______________   Class: _______   Date: _______`, { size: 19, spacing: { before: 0, after: 160 } }));
    acts.forEach((a, i) => {
      children.push(H.para(`Activity ${i + 1}: ${a.title || ''}`, { bold: true, size: 20, color: H.NAVY, spacing: { before: 140, after: 60 } }));
      children.push(H.para(a.instructions || '', { size: 19, spacing: { before: 0, after: 100 } }));
    });
    children.push(...H.footerBlock(d.teacherName, d.schoolName));
    return children;
  }},

  'Exam Paper': { schema: 'examPaper', renderer: (j, d) => {
    const children = [];
    children.push(H.bismillahBlock());
    children.push(...H.govHeader(d.schoolName));
    children.push(...H.documentTitleBlock('Examination Paper', `${d.className || ''} | ${d.subject || ''}`));
    children.push(H.para(`Time Allowed: ${j.timeAllowed || '1.5 Hours'}        Total Marks: ${j.totalMarks || 50}`, { size: 19, spacing: { before: 0, after: 60 } }));
    children.push(H.para(`Student Name: _______________   Roll No: _______`, { size: 19, spacing: { before: 0, after: 160 } }));
    children.push(H.para('Section A: Multiple Choice Questions', { bold: true, size: 22, color: H.NAVY, spacing: { before: 160, after: 80 } }));
    (j.mcqs || []).forEach((q, i) => {
      children.push(H.para(`${i + 1}. ${q.question}`, { size: 19, spacing: { before: 60, after: 20 } }));
      children.push(H.para((q.options || []).join('    '), { size: 18, spacing: { before: 0, after: 40 } }));
    });
    children.push(H.para('Section B: Short Questions', { bold: true, size: 22, color: H.NAVY, spacing: { before: 200, after: 80 } }));
    (j.shortQuestions || []).forEach((q, i) => children.push(H.para(`${i + 1}. ${q}`, { size: 19, spacing: { before: 60, after: 20 } })));
    children.push(H.para('Section C: Long Questions', { bold: true, size: 22, color: H.NAVY, spacing: { before: 200, after: 80 } }));
    (j.longQuestions || []).forEach((q, i) => children.push(H.para(`${i + 1}. ${q}`, { size: 19, spacing: { before: 60, after: 20 } })));
    children.push(...H.footerBlock(`Paper Setter: ${d.teacherName}`, d.schoolName));
    return children;
  }},

  'CRQ Paper': { schema: 'crqPaper', renderer: (j, d) => {
    const children = [];
    children.push(H.bismillahBlock());
    children.push(...H.govHeader(d.schoolName));
    children.push(...H.documentTitleBlock('CRQ Assessment Paper', `${d.className || ''} | ${d.subject || ''}`));
    children.push(H.para(`Student Name: _______________   Roll No: _______        Date: _______`, { size: 19, spacing: { before: 0, after: 160 } }));
    children.push(H.para('Section A: Multiple Choice Questions', { bold: true, size: 22, color: H.NAVY, spacing: { before: 160, after: 80 } }));
    (j.mcqs || []).forEach((q, i) => {
      children.push(H.para(`${i + 1}. ${q.question}`, { size: 19, spacing: { before: 60, after: 20 } }));
      children.push(H.para((q.options || []).join('    '), { size: 18, spacing: { before: 0, after: 40 } }));
    });
    children.push(H.para('Section B: Short Response Questions', { bold: true, size: 22, color: H.NAVY, spacing: { before: 200, after: 80 } }));
    (j.shortQuestions || []).forEach((q, i) => children.push(H.para(`${i + 1}. ${q}`, { size: 19, spacing: { before: 60, after: 20 } })));
    children.push(H.para('Section C: Long / Constructed Response', { bold: true, size: 22, color: H.NAVY, spacing: { before: 200, after: 80 } }));
    (j.longQuestions || []).forEach((q, i) => children.push(H.para(`${i + 1}. ${q}`, { size: 19, spacing: { before: 60, after: 20 } })));
    if (j.answerKey) {
      children.push(H.pageBreak());
      children.push(H.para('Answer Key (Teacher Copy)', { bold: true, size: 24, color: H.GOLD, spacing: { before: 0, after: 100 } }));
      if (j.answerKey.mcqAnswers) children.push(H.para('MCQ Answers: ' + j.answerKey.mcqAnswers.join(', '), { size: 19, spacing: { before: 60, after: 80 } }));
      (j.answerKey.shortAnswers || []).forEach((a, i) => children.push(H.para(`B${i + 1}: ${a}`, { size: 18, spacing: { before: 40, after: 40 } })));
      (j.answerKey.longAnswers || []).forEach((a, i) => children.push(H.para(`C${i + 1}: ${a}`, { size: 18, spacing: { before: 40, after: 40 } })));
    }
    children.push(...H.footerBlock(`Paper Setter: ${d.teacherName}`, d.schoolName));
    return children;
  }},
};


CONFIG['Student Database List'] = { schema: 'genericTable', renderer: (j, d) => {
  const H2 = require('./docx-helpers.js');
  const children = [];
  children.push(H2.bismillahBlock());
  children.push(...H2.govHeader(d.schoolName));
  children.push(...H2.documentTitleBlock('Student Database', 'Complete School Record — ECCE to Class 12'));
  children.push(H2.genericTable(
    ['Sr#', 'Name', 'Father Name', 'Class', 'G.R No', 'Seat No', 'Date of Birth'],
    (d.students || []).map((s, i) => [String(i + 1), s.name, s.father || '-', s.cls, s.gr, s.seat || '-', s.dob || '-']),
    [700, 2200, 2200, 1500, 1200, 900, 660]
  ));
  children.push(...H2.footerBlock(d.teacherName, d.schoolName, 'Total students: ' + (d.students || []).length));
  return children;
}};

module.exports = { CONFIG, SCHEMAS };

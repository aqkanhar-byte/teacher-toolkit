require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, WidthType, ShadingType, Table, TableRow, TableCell } = require('docx');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(require('cors')());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

/* ─── NO-AI document types — instant, offline, zero API cost ─────────────── */
const NO_AI_TYPES = [
  'Result Card','Attendance Sheet','Student Profile','Enrollment Form',
  'Character Certificate','Bonafide Certificate','Transfer Certificate',
  'School Leaving Certificate','NOC Letter','Experience Certificate',
  'Salary Certificate','Prize Certificate','Affidavit','Scholarship Form'
];

/* ─── Field labels for AI prompt building ────────────────────────────────── */
const LABELS = {
  schoolName:'School', teacherName:'Prepared by', className:'Class', group:'Group',
  subject:'Subject', unitInfo:'Unit/Lessons', duration:'Duration', examTerm:'Exam term',
  totalMarks:'Total marks', timeAllowed:'Time allowed', academicYear:'Session/Year',
  month:'Month', term:'Term', studentName:'Student name', childName:"Child's name",
  fatherName:"Father's name", grNumber:'G.R number', rollNumber:'Roll/Seat no',
  dob:'Date of birth', age:'Current age', address:'Address', guardianContact:'Guardian contact',
  fatherCnic:'Father CNIC', purpose:'Purpose', reason:'Reason', conduct:'Conduct',
  periodFrom:'Period from', periodTo:'Period to', admissionClass:'Class of admission',
  leavingClass:'Class at leaving', leavingDate:'Date of leaving', personName:'Name',
  designation:'Designation', cnic:'CNIC', fromDate:'From', toDate:'To',
  leaveType:'Leave type', refNumber:'Inward/Outward no', recipientDesignation:'Addressed to',
  subjectLine:'Letter subject', bodyPoints:'Main points', prizeTitle:'Prize/Position',
  eventName:'Event', eventDate:'Date', meetingDate:'Meeting date', agenda:'Agenda',
  bps:'BPS/Grade', basicPay:'Monthly salary', costCentre:'Cost centre',
  section:'Section', workingDays:'Working days', attDuration:'Duration',
  sessionYear:'Session', noticeReason:'Notice detail', extraData:'Additional information'
};

/* ─── Per-document AI guidance ───────────────────────────────────────────── */
const DOC_GUIDE = {
  'Lesson Plan':'Use the PPP teaching model (Presentation, Practice, Production) with TPR activities. Align every objective with Bloom\'s Taxonomy (Remember/Understand/Apply). Include SLOs, warm-up, phase-wise time allocation, differentiation for struggling and advanced students, homework, and a 3-level assessment rubric (Beginning/Developing/Achieved). If "Full Book" or a lesson range is given, cover every unit/lesson in that range.',
  'Worksheet':'Create a printable student worksheet with varied activity types (trace/write, circle/match, fill-in-the-blank, short answer). Include a student info header (Name, Class, Date, Roll No as blank lines to fill) and a self-check box. Cover the given unit(s)/lesson range completely.',
  'Assessment Rubric':'Create a 3-level rubric (Beginning / Developing / Achieved) for each SLO of the given unit/topic, in a clear table.',
  'Exam Paper':'Create a complete exam paper with sections (MCQs, short questions, long questions), marks distribution per section, clear instructions, and space indications. Match difficulty to the class level. Cover the given unit(s)/lesson range.',
  'Annual Teaching Plan':'Create a month-by-month annual teaching plan table covering the full academic session for the given class and subject, following the Sindh Textbook Board sequence.',
  'Monthly Teaching Plan':'Create a week-by-week plan for the given month, listing units/lessons, SLOs, activities, and assessment for each week.',
  'Progress Report':'Create a student progress report with subject-wise performance table (subjects auto-selected for the class level), teacher remarks, strengths, areas of improvement, and signature blocks for Class Teacher and Head Master.',
  'School Improvement Plan':'Create a structured SIP with priority areas, objectives, activities, timeline, responsible persons, and success indicators, suitable for a Sindh government school.',
  'Leave Application':'Write a formal leave application to the concerned authority with proper official format: reference number line, date, subject line, respectful body, and signature block with designation. Include Inward/Outward register number lines.',
  'Official Letter':'Write a formal government-style official letter with reference number line, date, recipient designation, subject line, respectful formal body covering the given main points, and signature block. Do NOT include any student details.',
  'Meeting Minutes':'Create formal meeting minutes with attendees section, agenda items, discussion summary, decisions taken, action items with responsible persons, and signature block.',
  'Budget Statement':'Create a school budget statement with income/expenditure table, item-wise breakdown, totals, and certification/signature block.',
  'Inspection Report':'Create a school inspection/visit report with sections: general information, enrollment, attendance, cleanliness, teaching quality observations, facilities, recommendations, and signature blocks.',
  'Stock Register':'Create a stock register format table with columns: S.No, Item name, Quantity received, Date, Quantity issued, Balance, Remarks. Include 15 blank numbered rows.',
  'Library Register':'Create a library register format table with columns: S.No, Book title, Author, Book number, Issue date, Issued to, Return date, Remarks. Include 15 blank numbered rows.',
  'Parent Complaint Letter':'Write a respectful notice/letter to the parent about the given matter, mentioning the child\'s name, class, roll number and G.R number in the header block only. Keep the tone constructive and invite the parent for a meeting.',
  'Age Calculator Sheet':'Create an age eligibility record sheet table with columns: S.No, Student name, Father name, Date of birth, Age on cutoff date, Eligible (Yes/No). Include 15 blank numbered rows.',
  'Event Banner Content':'Create event announcement content: main heading, tagline, key details (date, time, venue), and 3 short promotional lines.',
  'Complaint Letter':'Write a formal complaint letter with reference line, date, recipient, subject, factual respectful body covering the main points, requested action, and signature block.'
};

/* ─── GENERATE ───────────────────────────────────────────────────────────── */
app.post('/generate', async (req, res) => {
  const { documentType, language } = req.body;
  const fields = req.body.fields || {};
  const marks = req.body.marks || [];
  const studentsList = req.body.studentsList || [];

  /* Instant offline documents — no API call */
  if (NO_AI_TYPES.includes(documentType)) {
    try {
      const content = buildOfflineDocument(documentType, fields, marks, studentsList);
      return res.json({ success: true, content, offline: true });
    } catch (e) {
      return res.json({ success: false, error: e.message });
    }
  }

  const langInstructions = {
    english: 'Write ONLY in English.',
    urdu: 'Write ONLY in Urdu (Nastaliq script).',
    sindhi: 'Write ONLY in Sindhi (Nastaliq script).',
    roman_urdu: 'Write ONLY in Roman Urdu (Urdu words in Latin/English letters).',
    bilingual_en_ur: 'Write in BOTH English AND Urdu — every heading, label, and content in both languages side by side.',
    bilingual_en_sd: 'Write in BOTH English AND Sindhi — every part bilingual.',
    trilingual: 'Write in English, Urdu, AND Sindhi — all three languages throughout.',
    en_ur_roman: 'Write in English, Urdu script, AND Roman Urdu — all three throughout.'
  };

  const detailLines = Object.entries(fields)
    .filter(([k, v]) => v && !k.startsWith('_'))
    .map(([k, v]) => `${LABELS[k] || k}: ${v}`)
    .join('\n');

  const prompt = `You are a professional educator creating a ${documentType} for a Government of Sindh school in Pakistan.

DETAILS:
${detailLines || '(none provided)'}

DOCUMENT INSTRUCTIONS: ${DOC_GUIDE[documentType] || 'Create a complete, professional, classroom-ready document.'}

LANGUAGE INSTRUCTION: ${langInstructions[language] || langInstructions.bilingual_en_ur}

RULES:
- Follow Sindh Textbook Board (STB) curriculum standards and Sindh Education & Literacy Department conventions.
- Use ONLY the details provided above. Do NOT invent or include any student names, school names, or personal details that were not provided.
- Use markdown headings (#, ##, ###) and pipe tables (| col | col |) where a table improves clarity.
- Generate COMPLETE content — no placeholders like [insert here].`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ success: true, content: response.content[0].text });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/* ─── GENERATE CRQ ───────────────────────────────────────────────────────── */
app.post('/generate-crq', upload.single('file'), async (req, res) => {
  const { schoolName, teacherName, className, subject, unitName, difficulty, bloomLevels, mcqCount, shortCount, longCount, includeAnswerKey, language } = req.body;
  const bl = JSON.parse(bloomLevels || '["Remember","Understand","Apply"]');

  let fileContent = '';
  if (req.file) {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) {
      const imgData = fs.readFileSync(req.file.path).toString('base64');
      const imgType = ext === '.png' ? 'image/png' : 'image/jpeg';
      try {
        const vr = await client.messages.create({
          model: 'claude-sonnet-4-6', max_tokens: 2000,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: imgType, data: imgData } },
            { type: 'text', text: 'Extract all text from this textbook page. Return only the extracted text.' }
          ]}]
        });
        fileContent = vr.content[0].text;
      } catch(e) {}
    }
    try { fs.unlinkSync(req.file.path); } catch(e) {}
  }

  const prompt = `You are a professional exam paper creator for Government of Sindh schools in Pakistan.
Create a complete CRQ paper for:
${schoolName ? 'School: ' + schoolName : ''} ${teacherName ? '| Teacher: ' + teacherName : ''}
Class: ${className} | Subject: ${subject}
Unit/Lessons: ${unitName} (if a range like "Lessons 3-7" or "Full Book" is given, cover all of it)
Difficulty: ${difficulty} | Bloom's Levels: ${bl.join(', ')}
MCQs: ${mcqCount} | Short Questions: ${shortCount} | Long Questions: ${longCount}
Include Answer Key: ${includeAnswerKey}
${fileContent ? 'Based on this textbook content:\n' + fileContent : ''}
Language: ${language === 'bilingual_en_ur' ? 'Bilingual English + Urdu' : language}
Follow the Sindh Textbook Board curriculum. Do NOT include any student personal details.
Generate a complete, professional exam paper with all sections and marks distribution.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ success: true, content: response.content[0].text });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/* ─── UPLOAD & GENERATE ──────────────────────────────────────────────────── */
app.post('/upload-generate', upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ success: false, error: 'No file uploaded' });
  const { documentType, schoolName, teacherName, className, subject, language } = req.body;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const imgData = fs.readFileSync(req.file.path).toString('base64');
  const imgType = ext === '.png' ? 'image/png' : 'image/jpeg';

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 8000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: imgType, data: imgData } },
        { type: 'text', text: `Create a ${documentType}${schoolName ? ' for ' + schoolName : ''}${className ? ', ' + className : ''}${subject ? ', Subject: ' + subject : ''}${teacherName ? ', Prepared by: ' + teacherName : ''}. Language: ${language}. ${DOC_GUIDE[documentType] || ''} Based on this textbook page content, generate a complete professional document. Do NOT include any student personal details.` }
      ]}]
    });
    fs.unlinkSync(req.file.path);
    res.json({ success: true, content: response.content[0].text });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

/* ═══════════════ OFFLINE DOCUMENT BUILDERS ═══════════════
   14 instant documents — proper built-in content, zero API cost.
   Uses ONLY the fields provided by the form (no hardcoded school/SEMIS). */

const BISMILLAH = 'بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ';

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch(e) { return d; }
}
function today() { return fmt(new Date()); }
function blank(v, len) { return v && String(v).trim() ? String(v).trim() : '_'.repeat(len || 15); }
function sd(name) { return name ? `son/daughter of ${name}` : 'son/daughter of ' + '_'.repeat(20); }

function headerBlock(f, title) {
  return `${BISMILLAH}\n\n# ${blank(f.schoolName, 40)}\n## ${title}\n\nDate: ${today()}${f.refNumber ? '\nRef / Inward-Outward No: ' + f.refNumber : ''}\n`;
}
function signBlock3() {
  return `\n\n| Class Teacher | Head Master / Principal | Beat Officer / Supervisor |\n|---|---|---|\n| \u00A0 | \u00A0 | \u00A0 |\n| \u00A0 | \u00A0 | \u00A0 |\n| Signature & Stamp | Signature & Stamp | Signature & Stamp |`;
}
function signBlockHM(f) {
  return `\n\n\n_______________________\n**Head Master / Principal**\n${blank(f.teacherName, 25)}\n${blank(f.schoolName, 35)}\nSignature & Official Stamp`;
}
function gradeOf(pct) {
  if (pct >= 80) return 'A-1 (Outstanding)';
  if (pct >= 70) return 'A (Excellent)';
  if (pct >= 60) return 'B (Very Good)';
  if (pct >= 50) return 'C (Good)';
  if (pct >= 40) return 'D (Fair)';
  if (pct >= 33) return 'E (Pass)';
  return 'F (Fail)';
}

const OFFLINE_BUILDERS = {

  'Character Certificate': (f) => {
    const conduct = (f.conduct || 'Good').toUpperCase();
    return headerBlock(f, 'CHARACTER CERTIFICATE') +
`\nThis is to certify that **${blank(f.studentName, 25)}**, ${sd(f.fatherName)}, bearing G.R No. **${blank(f.grNumber, 8)}**, ${f.className ? 'is/was a student of **' + f.className + '**' : 'is/was a student'} at this institution${f.periodFrom || f.periodTo ? ` from **${fmt(f.periodFrom) || '________'}** to **${fmt(f.periodTo) || '________'}**` : ''}.${f.dob ? `\n\nDate of Birth (as per school record): **${fmt(f.dob)}**${f.age ? ' — Current age: ' + f.age : ''}` : ''}

During his/her stay at this institution, his/her character and conduct were found **${conduct}**. He/She bears a good moral character, remained regular and disciplined, and was never involved in any activity against the rules and discipline of the school.

This certificate is issued on his/her request${f.purpose ? ` for the purpose of **${f.purpose}**` : ''}. The institution wishes him/her success in all future endeavors.` +
signBlockHM(f);
  },

  'Bonafide Certificate': (f) =>
    headerBlock(f, 'BONAFIDE CERTIFICATE') +
`\nThis is to certify that **${blank(f.studentName, 25)}**, ${sd(f.fatherName)}, bearing G.R No. **${blank(f.grNumber, 8)}**, is a **BONAFIDE student of ${blank(f.className, 10)}** at this institution for the academic session **${blank(f.sessionYear, 10)}**.

This certificate is issued on the request of the student/guardian${f.purpose ? ` for the purpose of **${f.purpose}**` : ''}.` +
    signBlockHM(f),

  'Transfer Certificate': (f) =>
    headerBlock(f, 'TRANSFER CERTIFICATE') +
`
| Field | Detail |
|---|---|
| Student Name | ${blank(f.studentName, 25)} |
| Father's Name | ${blank(f.fatherName, 25)} |
| G.R Number | ${blank(f.grNumber, 8)} |
| Date of Birth | ${fmt(f.dob) || '____________'} |${f.age ? `\n| Current Age | ${f.age} |` : ''}
| Class of Admission | ${blank(f.admissionClass, 10)} |
| Class at the Time of Leaving | ${blank(f.leavingClass, 10)} |
| Date of Leaving | ${fmt(f.leavingDate) || today()} |
| Reason for Leaving | ${blank(f.reason, 20)} |
| Conduct | ${f.conduct || 'Good'} |
| Progress | Satisfactory |
| Dues | Nil |

Certified that the above information is in accordance with the school General Register.` +
    signBlockHM(f),

  'School Leaving Certificate': (f) =>
    headerBlock(f, 'SCHOOL LEAVING CERTIFICATE') +
`\nThis is to certify that **${blank(f.studentName, 25)}**, ${sd(f.fatherName)}, bearing G.R No. **${blank(f.grNumber, 8)}**, was a student of this institution and left the school from **${blank(f.leavingClass, 10)}** on **${fmt(f.leavingDate) || today()}**.

| Field | Detail |
|---|---|
| Date of Birth (in words & figures) | ${fmt(f.dob) || '____________'} |${f.age ? `\n| Age at Leaving | ${f.age} |` : ''}
| Conduct | ${f.conduct || 'Good'} |
| Dues | Nil |

He/She is granted this School Leaving Certificate on the request of his/her parent/guardian.` +
    signBlockHM(f),

  'NOC Letter': (f) =>
    headerBlock(f, 'NO OBJECTION CERTIFICATE (NOC)') +
`\n**To Whom It May Concern**

This is to certify that **${blank(f.personName, 25)}**${f.fatherName ? ', ' + sd(f.fatherName) : ''}${f.designation ? ', serving as **' + f.designation + '**' : ''} at this institution${f.cnic ? ', CNIC / Personal ID No. **' + f.cnic + '**' : ''}, is a regular employee/member of this institution.

This institution has **NO OBJECTION** ${f.purpose ? 'to the above-named person **' + f.purpose + '**' : 'to the above-named person applying for the stated purpose'}.

This certificate is issued on his/her request and does not confer any legal right or claim.` +
    signBlockHM(f),

  'Experience Certificate': (f) =>
    headerBlock(f, 'EXPERIENCE CERTIFICATE') +
`\nThis is to certify that **${blank(f.personName, 25)}**${f.fatherName ? ', ' + sd(f.fatherName) : ''}${f.cnic ? ', CNIC / Personal ID No. **' + f.cnic + '**' : ''}, has served at this institution as **${blank(f.designation, 18)}**${f.fromDate || f.toDate ? ` from **${fmt(f.fromDate) || '________'}** to **${fmt(f.toDate) || 'to date'}**` : ''}.

During the period of his/her service, his/her performance, conduct, and dedication towards duty were found **highly satisfactory**. He/She performed all assigned duties with responsibility and professionalism.

We wish him/her success in future professional endeavors.` +
    signBlockHM(f),

  'Salary Certificate': (f) =>
    headerBlock(f, 'SALARY CERTIFICATE') +
`\nThis is to certify that **${blank(f.personName, 25)}**${f.cnic ? ', CNIC / Personal ID No. **' + f.cnic + '**' : ''}, is serving at this institution on the post of **${blank(f.designation, 18)}**${f.bps ? ' (**' + f.bps + '**)' : ''}.

| Field | Detail |
|---|---|
| Designation | ${blank(f.designation, 18)} |${f.bps ? `\n| BPS / Grade | ${f.bps} |` : ''}${f.basicPay ? `\n| Monthly Salary | Rs. ${f.basicPay}/- |` : '\n| Monthly Salary | As per Government pay scale |'}${f.costCentre ? `\n| Cost Centre / DDO Code | ${f.costCentre} |` : ''}

This certificate is issued on his/her request for official use.` +
    signBlockHM(f),

  'Prize Certificate': (f) =>
    `${BISMILLAH}\n\n# ${blank(f.schoolName, 40)}\n## 🏆 CERTIFICATE OF ACHIEVEMENT 🏆\n\nThis certificate is proudly presented to\n\n# ★ ${blank(f.childName || f.studentName, 25)} ★\n\n${f.fatherName ? sd(f.fatherName).replace('son/daughter', 'Son/Daughter') + '\n' : ''}${f.className ? 'Class: **' + f.className + '**' : ''}${f.grNumber ? ' | G.R No: **' + f.grNumber + '**' : ''}${f.rollNumber ? ' | Roll No: **' + f.rollNumber + '**' : ''}

In recognition of securing **${blank(f.prizeTitle, 18)}**${f.eventName ? ' in **' + f.eventName + '**' : ''}${f.eventDate ? ' held on **' + fmt(f.eventDate) + '**' : ''}.

His/Her hard work, dedication, and outstanding performance make the whole school proud. Keep up the excellent work!

Awarded on: ${today()}` +
    signBlockHM(f),

  'Enrollment Form': (f) =>
    headerBlock(f, 'STUDENT ENROLLMENT / ADMISSION FORM') +
`
| Field | Detail |
|---|---|
| G.R Number | ${blank(f.grNumber, 8)} |
| Student Name | ${blank(f.studentName, 30)} |
| Father's Name | ${blank(f.fatherName, 30)} |
| Father's CNIC | ${blank(f.fatherCnic, 18)} |
| Date of Birth | ${fmt(f.dob) || '____________'} |
| Current Age | ${f.age || '____________'} |
| Class of Admission | ${blank(f.className, 12)} |
| Address | ${blank(f.address, 40)} |

### FATHER'S / GUARDIAN'S AFFIDAVIT

I, **${blank(f.fatherName, 25)}**, hereby solemnly declare that **${blank(f.studentName, 25)}** is my child, and that all the information provided above is true and correct to the best of my knowledge. The date of birth stated above is accurate as per record.

Father/Guardian Signature & Thumb Impression: ____________________  Date: ____________` +
    signBlock3(),

  'Student Profile': (f) =>
    headerBlock(f, 'STUDENT PROFILE') +
`
| Field | Detail |
|---|---|
| Student Name | ${blank(f.studentName, 30)} |
| Father's Name | ${blank(f.fatherName, 30)} |
| G.R Number | ${blank(f.grNumber, 8)} |
| Roll / Seat No | ${blank(f.rollNumber, 8)} |
| Class | ${blank(f.className, 12)} |
| Date of Birth | ${fmt(f.dob) || '____________'} |
| Current Age | ${f.age || '____________'} |
| Address | ${blank(f.address, 40)} |
| Guardian Contact | ${blank(f.guardianContact, 15)} |

### Academic & General Record

| Area | Remarks |
|---|---|
| Attendance | \u00A0 |
| Academic Performance | \u00A0 |
| Behavior & Discipline | \u00A0 |
| Co-curricular Activities | \u00A0 |
| Health Notes | \u00A0 |` +
    signBlockHM(f),

  'Result Card': (f, marks) => {
    let rows = '', totMax = 0, totObt = 0, allFilled = marks.length > 0;
    marks.forEach(m => {
      const t = parseFloat(m.total) || 0;
      const o = m.obtained === '' || m.obtained === undefined ? null : parseFloat(m.obtained);
      totMax += t;
      if (o === null) allFilled = false; else totObt += o;
      const pct = (o !== null && t) ? Math.round((o / t) * 100) : null;
      rows += `| ${m.subject} | ${m.total} | ${o === null ? '\u00A0' : m.obtained} | ${pct === null ? '\u00A0' : gradeOf(pct)} |\n`;
    });
    const overallPct = (allFilled && totMax) ? Math.round((totObt / totMax) * 100) : null;
    return headerBlock(f, 'STUDENT RESULT CARD') +
`
| Field | Detail | Field | Detail |
|---|---|---|---|
| Student Name | ${blank(f.studentName, 22)} | G.R Number | ${blank(f.grNumber, 8)} |
| Father's Name | ${blank(f.fatherName, 22)} | Seat / Roll No | ${blank(f.rollNumber, 8)} |
| Class | ${blank(f.className, 10)} | Session | ${blank(f.sessionYear, 10)} |
| Date of Birth | ${fmt(f.dob) || '__________'} | Current Age | ${f.age || '__________'} |
| Examination | ${f.term || 'Annual'} | Result Date | ${today()} |

### Subject-wise Marks

| Subject | Total Marks | Marks Obtained | Grade |
|---|---|---|---|
${rows}| **TOTAL** | **${totMax}** | **${allFilled ? totObt : '\u00A0'}** | **${overallPct === null ? '\u00A0' : overallPct + '% — ' + gradeOf(overallPct)}** |

**Result:** ${overallPct === null ? '________________' : (overallPct >= 33 ? 'PASS — Promoted to next class' : 'FAIL')}
**Position in Class:** ________________
**Remarks:** ________________________________________` +
    signBlock3();
  },

  'Attendance Sheet': (f, marks, students) => {
    const label = f._attMode === 'custom'
      ? `Duration: **${f.attDuration || '____________'}**`
      : `Month: **${f.attDuration || '____________'}**`;
    let rows = '';
    const list = (students && students.length) ? students : [];
    const n = Math.max(list.length, 15);
    for (let i = 0; i < n; i++) {
      const s = list[i] || {};
      rows += `| ${i + 1} | ${s.grNumber || '\u00A0'} | ${s.rollNumber || '\u00A0'} | ${s.name || '\u00A0'} | \u00A0 | \u00A0 | \u00A0 | \u00A0 |\n`;
    }
    return headerBlock(f, 'STUDENT ATTENDANCE SHEET') +
`
**Class:** ${blank(f.className, 12)}${f.section ? ' — Section: **' + f.section + '**' : ''}
${label}${f.workingDays ? '\n**Total Working Days:** ' + f.workingDays : ''}
${list.length ? '\n*(Student list auto-filled from Student Database — ' + list.length + ' students)*' : ''}

| S.No | G.R No | Roll No | Student Name | Days Present | Days Absent | Leave | % |
|---|---|---|---|---|---|---|---|
${rows}
**Summary:** Total Students: ${list.length || '______'} | Average Attendance: ______%` +
    signBlockHM(f);
  },

  'Affidavit': (f) =>
    `${BISMILLAH}\n\n# AFFIDAVIT / UNDERTAKING\n\nDate: ${today()}\n
I, **${blank(f.personName, 25)}**${f.fatherName ? ', ' + sd(f.fatherName) : ''}${f.cnic ? ', CNIC No. **' + f.cnic + '**' : ''}, do hereby solemnly affirm and declare on oath that:

1. The information and documents provided by me${f.purpose ? ' regarding **' + f.purpose + '**' : ''} are true and correct to the best of my knowledge and belief.
2. Nothing has been concealed or misstated therein.
3. I fully understand that in case any information is found false or forged at any stage, I shall be liable to legal action under the relevant laws.

**Deponent**

Signature / Thumb Impression: ____________________
Name: ${blank(f.personName, 25)}${f.cnic ? '\nCNIC: ' + f.cnic : ''}
Date: ${today()}

**Attestation**

_______________________
Attesting Officer — Signature & Stamp`,

  'Scholarship Form': (f) =>
    headerBlock(f, 'SCHOLARSHIP / WAZIFA APPLICATION FORM') +
`
| Field | Detail |
|---|---|
| Student Name | ${blank(f.studentName, 30)} |
| Father's Name | ${blank(f.fatherName, 30)} |
| G.R Number | ${blank(f.grNumber, 8)} |
| Roll / Seat No | ${blank(f.rollNumber, 8)} |
| Class | ${blank(f.className, 12)} |
| Date of Birth | ${fmt(f.dob) || '____________'} |
| Current Age | ${f.age || '____________'} |

I hereby apply for the scholarship/wazifa for the current academic session. I declare that the above information is correct as per school record.

Student / Father Signature: ____________________  Date: ____________` +
    signBlockHM(f)
};

function buildOfflineDocument(documentType, fields, marks, studentsList) {
  const builder = OFFLINE_BUILDERS[documentType];
  if (!builder) {
    return `# ${documentType}\n\nDate: ${today()}\n\n${Object.entries(fields).filter(([k,v])=>v&&!k.startsWith('_')).map(([k,v])=>`${LABELS[k]||k}: ${v}`).join('\n')}\n\nGenerated by Teacher Toolkit`;
  }
  return builder(fields, marks || [], studentsList || []);
}

/* ─── DOWNLOAD DOCX (with real table support) ────────────────────────────── */
function isTableLine(l) { return /^\s*\|.*\|\s*$/.test(l); }
function isSeparatorLine(l) { return /^\s*\|[\s\-:|]+\|\s*$/.test(l); }
function splitCells(l) {
  return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}
function runFromText(text, opts) {
  const parts = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(new TextRun({ text: text.slice(last, m.index), ...opts }));
    parts.push(new TextRun({ text: m[1], ...opts, bold: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(new TextRun({ text: text.slice(last), ...opts }));
  if (!parts.length) parts.push(new TextRun({ text: '', ...opts }));
  return parts;
}

app.post('/download-docx', async (req, res) => {
  const { content, fileName } = req.body;
  try {
    const lines = content.split('\n');
    const children = [];
    const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'c8d3e8' };
    const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      /* Markdown pipe table → real DOCX table */
      if (isTableLine(line)) {
        const tblLines = [];
        while (i < lines.length && isTableLine(lines[i])) { tblLines.push(lines[i]); i++; }
        const dataLines = tblLines.filter(l => !isSeparatorLine(l));
        if (dataLines.length) {
          const rows = dataLines.map((l, ri) => {
            const cells = splitCells(l);
            const isHead = ri === 0 && tblLines.length > 1 && isSeparatorLine(tblLines[1]);
            return new TableRow({
              children: cells.map(c => new TableCell({
                borders,
                shading: isHead ? { type: ShadingType.CLEAR, fill: '1a2744' } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({
                  children: runFromText(c, { size: 19, font: 'Arial', bold: isHead, color: isHead ? 'FFFFFF' : '1e2d4a' })
                })]
              }))
            });
          });
          children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
          children.push(new Paragraph({ spacing: { after: 100 } }));
        }
        continue;
      }

      if (!line.trim()) { children.push(new Paragraph({ spacing: { after: 60 } })); i++; continue; }
      const isH1 = line.startsWith('# ');
      const isH2 = line.startsWith('## ');
      const isH3 = line.startsWith('### ');
      const isBullet = line.startsWith('- ') || line.startsWith('• ');
      const isBis = line.includes('بِسْمِ');
      const text = line.replace(/^#{1,3} /, '').replace(/^[-•] /, '');

      if (isBis) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: text.replace(/\*\*/g, ''), size: 28, bold: true, color: 'C8960C', font: 'Amiri' })] }));
      } else if (isH1) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 }, children: runFromText(text, { size: 32, bold: true, color: '1a2744', font: 'Arial' }) }));
      } else if (isH2) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 180, after: 80 }, children: runFromText(text, { size: 26, bold: true, color: '243257', font: 'Arial' }) }));
      } else if (isH3) {
        children.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: runFromText(text, { size: 22, bold: true, color: 'C8960C', font: 'Arial' }) }));
      } else if (isBullet) {
        children.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: runFromText('• ' + text, { size: 20, font: 'Arial' }) }));
      } else {
        children.push(new Paragraph({ spacing: { after: 60 }, children: runFromText(text, { size: 20, font: 'Arial' }) }));
      }
      i++;
    }

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
        children
      }]
    });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'document'}.docx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ─── DOWNLOAD PDF (HTML-based, with table support) ──────────────────────── */
app.post('/download-pdf', async (req, res) => {
  const { content, fileName } = req.body;
  try {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    const lines = content.split('\n');
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (isTableLine(line)) {
        const tblLines = [];
        while (i < lines.length && isTableLine(lines[i])) { tblLines.push(lines[i]); i++; }
        const dataLines = tblLines.filter(l => !isSeparatorLine(l));
        const hasHead = tblLines.length > 1 && isSeparatorLine(tblLines[1]);
        html += '<table>';
        dataLines.forEach((l, ri) => {
          const tag = (hasHead && ri === 0) ? 'th' : 'td';
          html += '<tr>' + splitCells(l).map(c => `<${tag}>${inline(c) || '&nbsp;'}</${tag}>`).join('') + '</tr>';
        });
        html += '</table>';
        continue;
      }
      if (!line.trim()) { html += '<div class="sp"></div>'; i++; continue; }
      if (line.includes('بِسْمِ')) html += `<div class="bismillah">${esc(line.replace(/\*\*/g, ''))}</div>`;
      else if (line.startsWith('# ')) html += `<h1>${inline(line.slice(2))}</h1>`;
      else if (line.startsWith('## ')) html += `<h2>${inline(line.slice(3))}</h2>`;
      else if (line.startsWith('### ')) html += `<h3>${inline(line.slice(4))}</h3>`;
      else if (line.startsWith('- ') || line.startsWith('• ')) html += `<li>${inline(line.slice(2))}</li>`;
      else html += `<p>${inline(line)}</p>`;
      i++;
    }

    const page = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&display=swap');
  body { font-family: Arial, sans-serif; font-size: 11.5pt; margin: 2cm; line-height: 1.7; color: #1e2d4a; }
  h1 { color: #1a2744; font-size: 17pt; text-align: center; border-bottom: 2px solid #c8960c; padding-bottom: 6px; margin: 10px 0; }
  h2 { color: #243257; font-size: 13.5pt; text-align: center; margin: 8px 0; }
  h3 { color: #c8960c; font-size: 12pt; margin: 10px 0 4px; }
  p { margin: 4px 0; }
  .sp { height: 8px; }
  .bismillah { text-align: center; font-size: 16pt; color: #c8960c; font-family: 'Noto Nastaliq Urdu', serif; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  td, th { border: 1px solid #c8d3e8; padding: 6px 10px; font-size: 10.5pt; }
  th { background: #1a2744; color: white; }
  li { margin: 4px 0 4px 18px; }
  @media print { body { margin: 1.5cm; } }
</style>
</head>
<body>
${html}
<script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'document'}.html"`);
    res.send(page);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ─── DOWNLOAD EXCEL (Student Database export) ───────────────────────────── */
app.post('/download-excel', async (req, res) => {
  const { students, className, fileName } = req.body;
  try {
    const headers = ['G.R Number','Roll/Seat No','Student Name','Father Name','Class','Date of Birth','Age','Address','Phone'];
    const rows = [headers];
    if (students && students.length > 0) {
      for (const s of students) {
        rows.push([
          s.grNumber || '', s.rollNumber || '', s.name || '', s.fatherName || '',
          s.className || className || '', s.dob || '', s.age || '', s.address || '', s.phone || ''
        ]);
      }
    }
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const BOM = '\uFEFF';
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'students'}.csv"`);
    res.send(BOM + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ─── START SERVER ───────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Teacher Toolkit running on port ${PORT} — Sindh Education Edition`));

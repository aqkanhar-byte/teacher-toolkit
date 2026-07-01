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

// ─── NO-AI document types ──────────────────────────────────────────────────
const NO_AI_TYPES = [
  'Result Card','Attendance Sheet','Student Profile','Enrollment Form',
  'Character Certificate','Bonafide Certificate','Transfer Certificate',
  'School Leaving Certificate','NOC Letter','Experience Certificate',
  'Salary Certificate','Prize Certificate','Affidavit','Scholarship Form'
];

// ─── GENERATE (AI) ─────────────────────────────────────────────────────────
app.post('/generate', async (req, res) => {
  const { schoolName, teacherName, className, subject, unitNumber, unitName, documentType, extraData, language } = req.body;
  
  if (NO_AI_TYPES.includes(documentType)) {
    const content = buildOfflineDocument(req.body);
    return res.json({ success: true, content, offline: true });
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

  const prompt = `You are a professional educator creating a ${documentType} for a Pakistani government school.

SCHOOL: ${schoolName || 'GBPS Pir Bhirkio'}
TEACHER: ${teacherName || 'Abdul Qadeer Khan'} — Head Master
CLASS: ${className || 'Class 1'} | SUBJECT: ${subject || 'English'}
UNIT: ${unitNumber ? 'Unit ' + unitNumber : ''} — ${unitName}
EXTRA DETAILS: ${extraData || 'None'}

LANGUAGE INSTRUCTION: ${langInstructions[language] || langInstructions.bilingual_en_ur}

Create a complete, professional, classroom-ready ${documentType}.
Follow Sindh Textbook Board (STB) curriculum standards.
Use PPP teaching model and Bloom's Taxonomy for lesson plans.
Generate COMPLETE content — no placeholders.`;

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

// ─── GENERATE CRQ (AI) ────────────────────────────────────────────────────
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

  const prompt = `You are a professional exam paper creator for Pakistani government schools.
Create a complete CRQ paper for:
School: ${schoolName} | Teacher: ${teacherName}
Class: ${className} | Subject: ${subject}
Topic/Unit: ${unitName}
Difficulty: ${difficulty} | Bloom's Levels: ${bl.join(', ')}
MCQs: ${mcqCount} | Short Questions: ${shortCount} | Long Questions: ${longCount}
Include Answer Key: ${includeAnswerKey}
${fileContent ? 'Based on this textbook content:\n' + fileContent : ''}
Language: ${language === 'bilingual_en_ur' ? 'Bilingual English + Urdu' : language}
Generate a complete, professional exam paper with all sections.`;

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

// ─── UPLOAD & GENERATE ────────────────────────────────────────────────────
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
        { type: 'text', text: `Create a ${documentType} for ${schoolName}, Class ${className}, Subject: ${subject}, Teacher: ${teacherName}. Language: ${language}. Based on this textbook content, generate a complete professional document.` }
      ]}]
    });
    fs.unlinkSync(req.file.path);
    res.json({ success: true, content: response.content[0].text });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ─── DOWNLOAD DOCX ────────────────────────────────────────────────────────
app.post('/download-docx', async (req, res) => {
  const { content, fileName } = req.body;
  try {
    const lines = content.split('\n');
    const children = [];

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ', size: 28, bold: true, color: 'C8960C', font: 'Amiri' })]
    }));

    for (const line of lines) {
      if (!line.trim()) { children.push(new Paragraph({ spacing: { after: 60 } })); continue; }
      const isH1 = line.startsWith('# ');
      const isH2 = line.startsWith('## ');
      const isH3 = line.startsWith('### ');
      const isBullet = line.startsWith('- ') || line.startsWith('• ');
      const text = line.replace(/^#{1,3} /, '').replace(/^[-•] /, '').replace(/\*\*(.*?)\*\*/g, '$1');

      if (isH1) {
        children.push(new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text, size: 32, bold: true, color: '1a2744', font: 'Arial' })] }));
      } else if (isH2) {
        children.push(new Paragraph({ spacing: { before: 180, after: 80 }, children: [new TextRun({ text, size: 26, bold: true, color: '243257', font: 'Arial' })] }));
      } else if (isH3) {
        children.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text, size: 22, bold: true, color: 'C8960C', font: 'Arial' })] }));
      } else if (isBullet) {
        children.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: [new TextRun({ text: '• ' + text, size: 20, font: 'Arial' })] }));
      } else {
        children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text, size: 20, font: 'Arial' })] }));
      }
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

// ─── DOWNLOAD PDF (HTML-based, no puppeteer needed) ──────────────────────
app.post('/download-pdf', async (req, res) => {
  const { content, fileName } = req.body;
  try {
    const htmlContent = content
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&display=swap');
  body { font-family: Arial, sans-serif; font-size: 12pt; margin: 2cm; line-height: 1.8; color: #1e2d4a; }
  h1 { color: #1a2744; font-size: 18pt; border-bottom: 2px solid #c8960c; padding-bottom: 6px; }
  h2 { color: #243257; font-size: 14pt; }
  h3 { color: #c8960c; font-size: 12pt; }
  .bismillah { text-align: center; font-size: 16pt; color: #c8960c; font-family: 'Noto Nastaliq Urdu', serif; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  td, th { border: 1px solid #c8d3e8; padding: 6px 10px; }
  th { background: #1a2744; color: white; }
  li { margin: 4px 0; }
  @media print { body { margin: 1.5cm; } }
</style>
</head>
<body>
<div class="bismillah">بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</div>
<p>${htmlContent}</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'document'}.html"`);
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DOWNLOAD EXCEL ───────────────────────────────────────────────────────
app.post('/download-excel', async (req, res) => {
  const { students, className, schoolName, fileName } = req.body;
  try {
    // Build CSV (Excel-compatible)
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
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel to read Urdu correctly
    
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'students'}.csv"`);
    res.send(BOM + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── OFFLINE DOCUMENT BUILDER ─────────────────────────────────────────────
function buildOfflineDocument(data) {
  const { documentType, studentName, grNumber, rollNumber, className, schoolName, teacherName, subject, dob, fatherName, extraData } = data;
  const today = new Date().toLocaleDateString('en-PK');
  const school = schoolName || 'GBPS Pir Bhirkio';
  const teacher = teacherName || 'Abdul Qadeer Khan';

  const templates = {
    'Character Certificate': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nCHARACTER CERTIFICATE\n\nDate: ${today}\n\nThis is to certify that ${studentName || '___________'} (G.R No. ${grNumber || '___'}, Roll No. ${rollNumber || '___'}), son/daughter of ${fatherName || '___________'}, is a student of Class ${className} at ${school}.\n\nHis/her character and conduct have been SATISFACTORY during his/her stay at this institution.\n\nWe wish him/her all the best in his/her future endeavors.\n\nHead Master\n${teacher}\n${school}\nSEMIS: 415040089\nTaluka Kingri, District Khairpur, Sindh`,

    'Bonafide Certificate': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nBONAFIDE CERTIFICATE\n\nDate: ${today}\n\nThis is to certify that ${studentName || '___________'} (G.R No. ${grNumber || '___'}, Roll No. ${rollNumber || '___'}), son/daughter of ${fatherName || '___________'}, is a BONAFIDE student of Class ${className} at ${school} for the academic session 2025-26.\n\nHead Master\n${teacher}\n${school}\nSEMIS: 415040089`,

    'Transfer Certificate': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nTRANSFER CERTIFICATE\n\nDate: ${today}\n\nG.R No: ${grNumber || '___'} | Roll No: ${rollNumber || '___'}\n\nThis is to certify that ${studentName || '___________'}, son/daughter of ${fatherName || '___________'}, was a student of Class ${className} at ${school}. He/She is hereby granted this Transfer Certificate.\n\nDate of Birth: ${dob || '___________'}\nDate of Leaving: ${today}\nReason: Transfer\n\nConduct: Satisfactory\nProgress: Satisfactory\n\nHead Master\n${teacher}\n${school}`,

    'NOC Letter': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nNO OBJECTION CERTIFICATE\n\nDate: ${today}\n\nTo Whom It May Concern,\n\nThis is to certify that ${teacherName || studentName || '___________'} is employed/enrolled at ${school}, SEMIS Code 415040089, Taluka Kingri, District Khairpur, Sindh, under the Government of Sindh Education Department.\n\nThis institution has NO OBJECTION to the above-named person ${extraData || 'applying for the stated purpose'}.\n\nHead Master\n${teacher}\n${school}\nDate: ${today}`,

    'Experience Certificate': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nEXPERIENCE CERTIFICATE\n\nDate: ${today}\n\nThis is to certify that ${teacherName || '___________'} has served at ${school}, SEMIS Code 415040089, Taluka Kingri, District Khairpur as ${extraData || 'PST (BPS-14)'}.\n\nDuring his/her service, his/her conduct and performance have been SATISFACTORY.\n\nHead Master\n${teacher}\n${school}\nDate: ${today}`,

    'Salary Certificate': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nSALARY CERTIFICATE\n\nDate: ${today}\n\nThis is to certify that ${teacherName || '___________'} is serving at ${school} on the post of ${extraData || 'PST BPS-14'}.\n\nHis/Her monthly salary is as per government pay scale.\n\nHead Master\n${teacher}\n${school}\nDate: ${today}`,

    'Prize Certificate': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\n🏆 CERTIFICATE OF ACHIEVEMENT 🏆\n\nDate: ${today}\n\nThis certificate is proudly presented to\n\n★ ${studentName || '___________'} ★\n\nClass: ${className} | G.R No: ${grNumber || '___'} | Roll No: ${rollNumber || '___'}\n\nFor outstanding achievement in ${extraData || subject || '___________'}.\n\nKeep up the excellent work!\n\nHead Master\n${teacher}\n${school}\nDate: ${today}`,

    'Enrollment Form': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nENROLLMENT FORM — ${school}\nSEMIS: 415040089 | Session 2025-26\n\nG.R Number: ${grNumber || '___'} | Roll/Seat No: ${rollNumber || '___'}\n\nStudent Name: ${studentName || '___________________________'}\nFather Name: ${fatherName || '___________________________'}\nDate of Birth: ${dob || '___________________________'}\nClass: ${className}\nAddress: ${extraData || '___________________________'}\n\nAFFIDAVIT:\nI, ${fatherName || '___________'}, father of the above-named student, hereby declare that all information provided is correct to the best of my knowledge.\n\nFather Signature: _______________ Date: ___________\n\nClass Teacher: _______________ \nHead Master: _______________\nBeat Officer: _______________\nDate: ${today}`,

    'Affidavit': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nAFFIDAVIT\n\nDate: ${today}\n\nI, ${extraData || '___________'}, hereby solemnly affirm and declare that:\n\n1. The information provided by me is true and correct.\n2. I am fully responsible for the accuracy of this information.\n3. In case of any false information, I shall be liable for legal action.\n\nDeponent: _________________\nDate: ${today}\n\nAttestation:\nHead Master\n${teacher}\n${school}`,

    'Scholarship Form': `بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ\n\nSCHOLARSHIP / WAZIFA FORM\n\nDate: ${today}\n\nStudent Name: ${studentName || '___________'}\nFather Name: ${fatherName || '___________'}\nG.R No: ${grNumber || '___'} | Roll No: ${rollNumber || '___'}\nClass: ${className}\nDate of Birth: ${dob || '___'}\nSchool: ${school}\nSEMIS: 415040089\n\nI hereby apply for scholarship/wazifa for the academic session 2025-26.\n\nStudent/Father Signature: _________________\nHead Master Signature: _________________\nDate: ${today}`
  };

  return templates[documentType] || `${documentType}\n\nDate: ${today}\nSchool: ${school}\nStudent: ${studentName || '___'}\nClass: ${className}\nG.R No: ${grNumber || '___'}\n\nGenerated by Teacher Toolkit\nHead Master: ${teacher}`;
}

// ─── START SERVER ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Teacher Toolkit running on port ${PORT}`));

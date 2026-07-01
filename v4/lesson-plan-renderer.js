const H = require('./docx-helpers.js');
const { Paragraph, TextRun, AlignmentType, BorderStyle, WidthType, Table, TableRow, TableCell, ShadingType } = require('docx');

// data = { schoolName, teacherName, className, subject, scopeLabel,
//   slos:[{level,en,ur}], lessons:[{title,phases:[{phase,time,activity}]}],
//   homework:[...], rubric:[{skill,beginning,developing,achieved}], worksheetActivities:[...] }
function renderLessonPlan(data) {
  const { schoolName, teacherName, className, subject, scopeLabel, slos, lessons, homework, rubric, worksheetActivities } = data;
  const children = [];

  children.push(H.bismillahBlock());
  children.push(...H.documentTitleBlock('Lesson Plan', `${scopeLabel || ''}`));
  children.push(H.fieldsTable([
    { label: 'School', value: schoolName }, { label: 'Teacher', value: teacherName },
    { label: 'Class', value: className }, { label: 'Subject', value: subject },
  ]));
  children.push(H.para('', { spacing: { before: 100, after: 60 } }));

  // SLOs
  if (slos && slos.length) {
    children.push(H.para('Student Learning Outcomes', { bold: true, size: 24, color: H.NAVY, spacing: { before: 160, after: 80 } }));
    children.push(H.genericTable(['Level', 'Outcome'], slos.map(s => [s.level, s.en + (s.ur ? ' / ' + s.ur : '')]), [1800, 7560]));
    children.push(H.para('', { spacing: { before: 100, after: 60 } }));
  }

  // Lessons
  (lessons || []).forEach((lesson, i) => {
    children.push(H.para(`Lesson ${i + 1}: ${lesson.title || ''}`, { bold: true, size: 23, color: H.NAVY, spacing: { before: 200, after: 80 } }));
    (lesson.phases || []).forEach(ph => {
      children.push(H.para(`${ph.phase} (${ph.time || ''})`, { bold: true, size: 19, color: '2E5090', spacing: { before: 80, after: 30 } }));
      children.push(H.para(ph.activity || '', { size: 19, spacing: { before: 0, after: 60 } }));
    });
  });

  // Homework
  if (homework && homework.length) {
    children.push(H.para('Homework', { bold: true, size: 23, color: H.NAVY, spacing: { before: 200, after: 80 } }));
    homework.forEach((h, i) => children.push(H.para(`${i + 1}. ${h}`, { size: 19, spacing: { before: 30, after: 30 } })));
  }

  // Rubric
  if (rubric && rubric.length) {
    children.push(H.para('Assessment Rubric', { bold: true, size: 23, color: H.NAVY, spacing: { before: 200, after: 80 } }));
    children.push(H.genericTable(['Skill', 'Beginning', 'Developing', 'Achieved'],
      rubric.map(r => [r.skill, r.beginning, r.developing, r.achieved]), [2000, 2453, 2453, 2454]));
  }

  // Worksheet
  if (worksheetActivities && worksheetActivities.length) {
    children.push(H.pageBreak());
    children.push(H.para('Worksheet', { bold: true, size: 26, color: H.GOLD, align: AlignmentType.CENTER, spacing: { before: 0, after: 100 } }));
    children.push(H.para('Student Name: _______________   Class: _______   Date: _______', { size: 19, spacing: { before: 0, after: 160 } }));
    worksheetActivities.forEach((a, i) => {
      children.push(H.para(`Activity ${i + 1}: ${a.title || ''}`, { bold: true, size: 20, color: H.NAVY, spacing: { before: 140, after: 60 } }));
      children.push(H.para(a.instructions || '', { size: 19, spacing: { before: 0, after: 100 } }));
    });
  }

  children.push(...H.footerBlock(teacherName, schoolName));
  return children;
}

module.exports = { renderLessonPlan };

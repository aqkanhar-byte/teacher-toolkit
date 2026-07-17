/* Teacher Toolkit — SHARED class/subject data
   index.html (teacher) aur admin.html (Book Bank / SLO Bank) dono isi ek file se
   classes/subjects lete hain — spelling/case mismatch ab kabhi nahi hoga. */

const CLASS_LIST=['ECCE (Katchi)','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12'];

const CLASS_SUBJECTS={
 'ECCE (Katchi)':['Pre-Sindhi','Pre-English','Pre-Math','Urdu','General Awareness','Rhymes & Activities'],
 'Class 1':['Sindhi','Urdu','English','Mathematics','General Knowledge','Deeniyat / Nazra'],
 'Class 2':['Sindhi','English','Mathematics','General Knowledge','Deeniyat / Nazra'],
 'Class 3':['Sindhi','English','Mathematics','General Knowledge','Islamiat'],
 'Class 4':['Sindhi','Urdu','English','Mathematics','General Science','Social Studies','Islamiat'],
 'Class 5':['Sindhi','Urdu','English','Mathematics','General Science','Social Studies','Islamiat'],
 'Class 6':['Sindhi','Urdu','English','Mathematics','General Science','Social Studies','Islamiat','Computer Education','Arabic'],
 'Class 7':['Sindhi','Urdu','English','Mathematics','General Science','Social Studies','Islamiat','Computer Education','Arabic'],
 'Class 8':['Sindhi','Urdu','English','Mathematics','General Science','Social Studies','Islamiat','Computer Education','Arabic']
};

const SEC_MAP={
 'Class 9':{comp:['English','Sindhi','Urdu','Islamiat'],groups:{
   'Science':['Mathematics','Physics','Chemistry','Biology','Computer Science'],
   'Arts / General':['General Mathematics','General Science','Civics','Education','Economics','Islamic Studies (Elective)','Home Economics']}},
 'Class 10':{comp:['English','Sindhi','Urdu','Pakistan Studies'],groups:{
   'Science':['Mathematics','Physics','Chemistry','Biology','Computer Science'],
   'Arts / General':['General Mathematics','General Science','Civics','Education','Economics','Islamic Studies (Elective)','Home Economics']}},
 'Class 11':{comp:['English','Urdu','Islamic Education'],groups:{
   'Pre-Medical':['Biology','Chemistry','Physics'],
   'Pre-Engineering':['Mathematics','Chemistry','Physics'],
   'Computer Science (ICS)':['Computer Science','Mathematics','Physics'],
   'Commerce':['Principles of Accounting','Principles of Commerce','Business Mathematics','Economics'],
   'Humanities / Arts':['Civics','Education','Economics','Sociology','Islamic Studies','Psychology']}},
 'Class 12':{comp:['English','Urdu','Pakistan Studies'],groups:{
   'Pre-Medical':['Biology','Chemistry','Physics'],
   'Pre-Engineering':['Mathematics','Chemistry','Physics'],
   'Computer Science (ICS)':['Computer Science','Mathematics','Statistics'],
   'Commerce':['Principles of Accounting','Commercial Geography','Statistics','Principles of Banking'],
   'Humanities / Arts':['Civics','Education','Economics','Sociology','Islamic Studies','Psychology']}}
};

function groupNames(cls){return SEC_MAP[cls]?Object.keys(SEC_MAP[cls].groups):[];}

/* Teacher view: compulsory + selected group ke subjects */
function subjectsFor(cls,group){
  if(SEC_MAP[cls]){const gs=SEC_MAP[cls].groups;const g=gs[group]?group:Object.keys(gs)[0];return SEC_MAP[cls].comp.concat(gs[g]);}
  return CLASS_SUBJECTS[cls]||[];
}

/* Admin view: class ke SAB subjects (har group ke), duplicates ke baghair */
function allSubjectsFor(cls){
  if(SEC_MAP[cls]){
    const set=[];SEC_MAP[cls].comp.forEach(s=>set.push(s));
    Object.values(SEC_MAP[cls].groups).forEach(g=>g.forEach(s=>{if(!set.includes(s))set.push(s);}));
    return set;
  }
  return CLASS_SUBJECTS[cls]||[];
}

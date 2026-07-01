const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Teacher Toolkit</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#eef2f7;--surface:#ffffff;--surface-1:#f6f8fb;
  --border:#dde3ec;--border-strong:#c7d0dd;--accent:#2563eb;--accent-bg:#e8f0fe;
  --text-primary:#16213a;--text-secondary:#5b6679;--text-muted:#9aa3b5;
  --navy:#0f2147;--radius:9px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:var(--bg);color:var(--text-primary);font-size:14px;line-height:1.5}
button,input,select,textarea{font-family:inherit;font-size:13px}
input,select,textarea{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text-primary);outline:none;transition:border-color .15s}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:60px}
label{font-size:12px;color:var(--text-secondary);display:block;margin-bottom:5px;font-weight:500}
button{cursor:pointer;border:none;background:none}

.topbar{height:56px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;background:var(--navy)}
.brand{display:flex;align-items:center;gap:10px}
.brand-ic{width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center}
.brand-ic svg{width:17px;height:17px;stroke:#fff}
.brand span{font-size:15px;font-weight:600;color:#fff}
.dev-tag{font-size:11px;color:rgba(255,255,255,.55)}
.dev-tag b{color:rgba(255,255,255,.9);font-weight:500}
.bismillah-strip{background:var(--navy);text-align:center;padding:10px 16px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
.bismillah-text{font-family:'Amiri',serif;font-size:26px;color:#f5d98a;line-height:1.4;letter-spacing:.5px;direction:rtl}
@media(max-width:600px){.bismillah-text{font-size:20px}}

.app{display:flex;max-width:1180px;margin:0 auto;min-height:calc(100vh - 56px);gap:16px;padding:16px}

.sidebar{width:222px;flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 12px;align-self:flex-start}
.sb-label{font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin:0 0 8px 8px}
.sb-label.mt{margin-top:20px}
.sb-item{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:var(--radius);font-size:13px;color:var(--text-secondary);cursor:pointer;margin-bottom:2px;transition:all .12s;font-weight:500}
.sb-ic{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--surface-1)}
.sb-ic svg{width:14px;height:14px;stroke:var(--text-secondary)}
.sb-item:hover{background:var(--surface-1)}
.sb-item.on{color:var(--accent)}
.sb-item.on .sb-ic{background:var(--accent-bg)}
.sb-item.on .sb-ic svg{stroke:var(--accent)}

.main{flex:1;min-width:0}
.page-head{margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px}
.crumb{font-size:12px;color:var(--text-muted);margin-bottom:2px}
.page-title{font-size:20px;font-weight:700}
.db-btn{display:flex;align-items:center;gap:7px;padding:8px 16px;border-radius:99px;border:1px solid var(--border);background:var(--surface);font-size:12.5px;font-weight:600;color:var(--text-secondary);transition:all .15s}
.db-btn:hover{border-color:var(--accent);color:var(--accent)}
.db-btn svg{width:15px;height:15px}

.doc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.dtile{border:1px solid var(--border);border-radius:11px;padding:14px 10px;text-align:center;cursor:pointer;transition:all .12s;background:var(--surface)}
.dtile:hover{border-color:var(--border-strong);transform:translateY(-1px)}
.dtile.on{border-color:var(--accent);background:var(--accent-bg)}
.dtile-ic{width:34px;height:34px;border-radius:9px;background:var(--surface-1);display:flex;align-items:center;justify-content:center;margin:0 auto 8px}
.dtile-ic svg{width:17px;height:17px;stroke:var(--text-secondary)}
.dtile.on .dtile-ic{background:#fff}
.dtile.on .dtile-ic svg{stroke:var(--accent)}
.dtile .dn{font-size:11.5px;color:var(--text-primary);display:block;font-weight:500}
.dtile.on .dn{color:var(--accent)}

.crq-box{border:1px solid #c9dbfb;border-radius:12px;background:linear-gradient(180deg,#f0f6ff,#fafcff);padding:20px;margin-bottom:20px}
.crq-top{display:flex;align-items:center;gap:9px;margin-bottom:4px}
.crq-top-ic{width:30px;height:30px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center}
.crq-top-ic svg{width:15px;height:15px;stroke:#fff}
.crq-top span{font-size:15px;font-weight:700;color:var(--navy)}
.crq-sub{font-size:12.5px;color:var(--text-secondary);margin-bottom:16px}
.crq-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px}
.crq-row.three{grid-template-columns:1fr 1fr 1fr}
.crq-section-lbl{font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:7px}
.pill-row{display:flex;gap:7px;flex-wrap:wrap}
.pill{padding:7px 16px;border-radius:99px;font-size:12.5px;border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);cursor:pointer;transition:all .12s;font-weight:500}
.pill.on{border-color:var(--accent);background:var(--accent);color:#fff}
.chk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.chk-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);cursor:pointer;font-size:12.5px;font-weight:500}
.chk-item input{width:auto;margin:0;accent-color:var(--accent)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0 4px}
.toggle-row label{margin:0;font-size:13px;color:var(--text-primary);font-weight:600}
.sw{width:36px;height:20px;border-radius:99px;background:var(--border-strong);position:relative;cursor:pointer;flex-shrink:0;transition:background .15s}
.sw.on{background:var(--accent)}
.sw-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.sw.on .sw-knob{transform:translateX(16px)}
.upload-mini{border:1.5px dashed var(--border-strong);border-radius:var(--radius);padding:16px;text-align:center;cursor:pointer;transition:all .15s;font-size:12.5px;color:var(--text-secondary);background:var(--surface);font-weight:500}
.upload-mini:hover{border-color:var(--accent);background:var(--accent-bg)}
.upload-mini svg{width:20px;height:20px;color:var(--text-muted);display:block;margin:0 auto 6px}
.file-tag{display:none;margin-top:8px;font-size:12px;color:var(--accent);font-weight:500}

.lesson-mode-row{display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap}

.form-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px}
.form-card-title{font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.form-card-title svg{width:16px;height:16px;stroke:var(--accent)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.form-row.three{grid-template-columns:1fr 1fr 1fr}
.form-row.one{grid-template-columns:1fr}
.form-row:last-child{margin-bottom:0}
.field{display:flex;flex-direction:column}
.field-hint{font-size:11px;color:var(--text-muted);margin-top:4px}

.upload-zone{border:1.5px dashed var(--border-strong);border-radius:12px;padding:22px;text-align:center;cursor:pointer;margin-bottom:16px;background:var(--surface);transition:all .15s}
.upload-zone:hover{border-color:var(--accent);background:var(--accent-bg)}
.upload-zone-ic{width:42px;height:42px;border-radius:10px;background:var(--surface-1);display:flex;align-items:center;justify-content:center;margin:0 auto 8px}
.upload-zone-ic svg{width:21px;height:21px;stroke:var(--text-secondary)}
.upload-zone .ut{font-size:13.5px;font-weight:600}
.upload-zone .us{font-size:11.5px;color:var(--text-muted);margin-top:3px}

.btn-main{width:100%;padding:13px;background:var(--navy);color:#fff;border-radius:var(--radius);font-size:14px;font-weight:600;transition:opacity .15s}
.btn-main:hover{opacity:.88}
.btn-main:disabled{opacity:.4;cursor:not-allowed}
.btn-crq{width:100%;padding:13px;background:var(--accent);color:#fff;border-radius:var(--radius);font-size:14px;font-weight:600;margin-top:16px;transition:opacity .15s}
.btn-crq:hover{opacity:.88}
.btn-crq:disabled{opacity:.4;cursor:not-allowed}

.age-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px}

.loader{display:none;text-align:center;padding:44px 0}
.spin{width:30px;height:30px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;margin:0 auto 14px;animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.loader p{font-size:13px;color:var(--text-secondary);font-weight:500}

.result{display:none;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.res-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px;background:var(--surface-1)}
.res-head .rt{font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:7px}
.res-head .rt svg{width:17px;height:17px;stroke:#16a34a}
.res-btns{display:flex;gap:7px}
.bdl{padding:7px 14px;border-radius:var(--radius);font-size:12.5px;border:1px solid var(--border);background:var(--surface);color:var(--text-primary);display:flex;align-items:center;gap:6px;font-weight:500}
.bdl:hover{background:var(--surface-1)}
.bdl.acc{background:var(--navy);color:#fff;border-color:var(--navy)}
.bdl svg{width:14px;height:14px}
.res-body{padding:18px;font-size:12.5px;line-height:1.85;white-space:pre-wrap;max-height:520px;overflow-y:auto;font-family:'JetBrains Mono',monospace;color:var(--text-secondary)}
.res-foot{padding:9px 18px;border-top:1px solid var(--border);text-align:right;font-size:10.5px;color:var(--text-muted);background:var(--surface-1)}

.modal-overlay{display:none;position:fixed;inset:0;background:rgba(15,33,71,.5);z-index:999;align-items:center;justify-content:center;padding:20px}
.modal-overlay.show{display:flex}
.modal-box{background:var(--surface);border-radius:14px;max-width:680px;width:100%;max-height:85vh;overflow-y:auto;padding:0}
.modal-head{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface)}
.modal-title{font-size:16px;font-weight:700}
.modal-close{width:30px;height:30px;border-radius:8px;background:var(--surface-1);display:flex;align-items:center;justify-content:center}
.modal-close svg{width:16px;height:16px}
.modal-body{padding:20px 22px}
.db-table{width:100%;border-collapse:collapse;font-size:12.5px}
.db-table th{text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--text-secondary);font-weight:600;font-size:11px;text-transform:uppercase}
.db-table td{padding:8px 10px;border-bottom:1px solid var(--border-light, var(--border))}
.db-table tr:hover{background:var(--surface-1);cursor:pointer}
.db-empty{text-align:center;padding:30px;color:var(--text-muted);font-size:13px}
.db-actions{display:flex;gap:6px}
.db-mini-btn{padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:11px}
.db-mini-btn.danger{color:#c0392b;border-color:#f5b7b1}

@media(max-width:860px){
  .app{flex-direction:column}
  .sidebar{width:100%}
  .doc-grid{grid-template-columns:repeat(2,1fr)}
  .form-row{grid-template-columns:1fr}
  .form-row.three{grid-template-columns:1fr 1fr}
  .crq-row{grid-template-columns:1fr}
}
</style>
</head>
<body>

<div class="topbar">
  <div class="brand"><div class="brand-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M6 10.5V17c0 1.5 2.5 3 6 3s6-1.5 6-3v-6.5"/><line x1="22" y1="8" x2="22" y2="14"/></svg></div><span>Teacher Toolkit</span></div>
  <div class="dev-tag">by <b>aqkanhar</b></div>
</div>

<div class="bismillah-strip"><div class="bismillah-text">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</div></div>

<div class="app">

  <div class="sidebar">
    <div class="sb-label">Document type</div>
    <div class="sb-item on" onclick="showCat(this,'academic')"><div class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>Academic</div>
    <div class="sb-item" onclick="showCat(this,'school')"><div class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/></svg></div>School docs</div>
    <div class="sb-item" onclick="showCat(this,'student')"><div class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>Student</div>
    <div class="sb-item" onclick="showCat(this,'admin')"><div class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg></div>Admin</div>
    <div class="sb-item" onclick="showCat(this,'tools')"><div class="sb-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 7l3 3 3-3-3-3-3 3z"/><path d="M5 22l5.5-5.5"/></svg></div>Tools</div>

    <div class="sb-label mt">Output language</div>
    <select id="langSel" onchange="onLangChange()">
      <option value="bilingual_en_ur" selected>English + Urdu</option>
      <option value="english">English</option>
      <option value="urdu">Urdu</option>
      <option value="sindhi">Sindhi</option>
      <option value="roman_urdu">Roman Urdu</option>
      <option value="bilingual_en_sd">English + Sindhi</option>
      <option value="trilingual">English + Urdu + Sindhi</option>
      <option value="en_ur_roman">English + Urdu + Roman</option>
    </select>
  </div>

  <div class="main">

    <div class="page-head">
      <div>
        <div class="crumb" id="crumbCat">Academic</div>
        <div class="page-title" id="pageTitle">Lesson plan</div>
      </div>
      <button class="db-btn" onclick="openDB()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>
        Student database
      </button>
    </div>

    <div class="doc-grid" id="panel-academic">
      <div class="dtile on" data-doc="Lesson Plan" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div><span class="dn">Lesson plan</span></div>
      <div class="dtile" data-doc="Worksheet" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg></div><span class="dn">Worksheet</span></div>
      <div class="dtile" data-doc="Assessment Rubric" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="14"/></svg></div><span class="dn">Rubric</span></div>
      <div class="dtile" data-doc="Exam Paper" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></div><span class="dn">Exam paper</span></div>
      <div class="dtile" data-doc="Annual Teaching Plan" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><span class="dn">Annual plan</span></div>
      <div class="dtile" data-doc="Monthly Teaching Plan" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="17.5" cy="17.5" r="4.5"/></svg></div><span class="dn">Monthly plan</span></div>
      <div class="dtile" data-doc="Progress Report" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div><span class="dn">Progress report</span></div>
      <div class="dtile" data-doc="CRQ Paper" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><span class="dn">CRQ paper</span></div>
    </div>

    <div class="doc-grid" id="panel-school" style="display:none">
      <div class="dtile" data-doc="Character Certificate" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M9 13.5 7.5 22l4.5-2.5 4.5 2.5-1.5-8.5"/></svg></div><span class="dn">Character cert.</span></div>
      <div class="dtile" data-doc="Transfer Certificate" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></div><span class="dn">Transfer cert.</span></div>
      <div class="dtile" data-doc="School Leaving Certificate" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg></div><span class="dn">Leaving cert.</span></div>\n      <div class="dtile" data-doc="Bonafide Certificate" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><circle cx="12" cy="15" r="2.5"/></svg></div><span class="dn">Bonafide cert.</span></div>
      <div class="dtile" data-doc="NOC Letter" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><span class="dn">NOC letter</span></div>
      <div class="dtile" data-doc="School Improvement Plan" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h20"/><path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg></div><span class="dn">Improvement plan</span></div>
      <div class="dtile" data-doc="Prize Certificate" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg></div><span class="dn">Prize cert.</span></div>
      <div class="dtile" data-doc="Experience Certificate" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div><span class="dn">Experience cert.</span></div>
      <div class="dtile" data-doc="Salary Certificate" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg></div><span class="dn">Salary cert.</span></div>
    </div>

    <div class="doc-grid" id="panel-student" style="display:none">
      <div class="dtile" data-doc="Result Card" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><polyline points="8 15 10 13 12 15 16 11"/></svg></div><span class="dn">Result card</span></div>
      <div class="dtile" data-doc="Attendance Sheet" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><path d="M3.5 7.5 5 9l2.5-2.5"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M3.5 18.5 5 20l2.5-2.5"/><line x1="14" y1="6" x2="21" y2="6"/><line x1="14" y1="17" x2="21" y2="17"/></svg></div><span class="dn">Attendance</span></div>
      <div class="dtile" data-doc="Scholarship Form" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6v12M9 9.5a3 1.6 0 0 1 3-1 3 1.6 0 0 1 3 1c0 1.5-2 1.5-3 2-1.5.5-3 .8-3 2.4a3 1.6 0 0 0 3 1.1 3 1.6 0 0 0 3-1.1"/></svg></div><span class="dn">Scholarship</span></div>
      <div class="dtile" data-doc="Enrollment Form" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg></div><span class="dn">Enrollment</span></div>
      <div class="dtile" data-doc="Student Profile" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><line x1="14" y1="9" x2="19" y2="9"/><line x1="14" y1="13" x2="19" y2="13"/></svg></div><span class="dn">Student profile</span></div>
    </div>

    <div class="doc-grid" id="panel-admin" style="display:none">
      <div class="dtile" data-doc="Leave Application" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></svg></div><span class="dn">Leave application</span></div>
      <div class="dtile" data-doc="Parent Complaint Letter" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></div><span class="dn">Parent notice</span></div>
      <div class="dtile" data-doc="Meeting Minutes" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/><line x1="8" y1="13" x2="15" y2="13"/></svg></div><span class="dn">Meeting minutes</span></div>
      <div class="dtile" data-doc="Budget Statement" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h16v20l-3-2-2 2-2-2-2 2-2-2-2 2-3-2z"/><line x1="8" y1="7" x2="16" y2="7"/></svg></div><span class="dn">Budget</span></div>
      <div class="dtile" data-doc="Inspection Report" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><span class="dn">Inspection report</span></div>
      <div class="dtile" data-doc="Official Letter" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.5 12 14l10-5.5"/><rect x="2" y="6" width="20" height="14" rx="2"/></svg></div><span class="dn">Official letter</span></div>
      <div class="dtile" data-doc="Stock Register" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8"/><path d="M3.27 6.96 12 12l8.73-5.04"/><path d="M12 22V12"/></svg></div><span class="dn">Stock register</span></div>
      <div class="dtile" data-doc="Library Register" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h4v18H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M11 3h4v18h-4z"/></svg></div><span class="dn">Library register</span></div>
    </div>

    <div class="doc-grid" id="panel-tools" style="display:none">
      <div class="dtile" data-doc="Age Calculator Sheet" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/></svg></div><span class="dn">Age calculator</span></div>
      <div class="dtile" data-doc="Event Banner Content" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22 12 12"/><circle cx="5" cy="5" r="1.5"/><circle cx="13" cy="3" r="1.5"/><circle cx="20" cy="9" r="1.5"/></svg></div><span class="dn">Event content</span></div>
      <div class="dtile" data-doc="Affidavit" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 7l-3 7a3 3 0 0 0 6 0z"/><path d="M19 7l-3 7a3 3 0 0 0 6 0z"/></svg></div><span class="dn">Affidavit</span></div>
      <div class="dtile" data-doc="Complaint Letter" onclick="setDoc(this)"><div class="dtile-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V2"/><path d="M4 4h12l-2 4 2 4H4"/></svg></div><span class="dn">Complaint letter</span></div>
    </div>

    <div id="dynamicArea"></div>

  </div>
</div>

<div class="modal-overlay" id="dbModal">
  <div class="modal-box">
    <div class="modal-head">
      <div class="modal-title">Student database</div>
      <button class="modal-close" onclick="closeDB()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-card-title">Add a student</div>
      <div class="form-row three">
        <div class="field"><label>Student name</label><input type="text" id="db_name"></div>
        <div class="field"><label>Father name</label><input type="text" id="db_father"></div>
        <div class="field"><label>Class</label><select id="db_class"><option>ECCE</option><option>Class 1</option><option>Class 2</option><option>Class 3</option><option>Class 4</option><option>Class 5</option><option>Class 6</option><option>Class 7</option><option>Class 8</option><option>Class 9</option><option>Class 10 (SSC)</option><option>Class 11 (HSC-I)</option><option>Class 12 (HSC-II)</option></select></div>
      </div>
      <div class="form-row three">
        <div class="field"><label>G.R number</label><input type="text" id="db_gr"></div>
        <div class="field"><label>Seat/Roll number</label><input type="text" id="db_seat"></div>
        <div class="field"><label>Date of birth</label><input type="date" id="db_dob"></div>
      </div>
      <button class="btn-main" onclick="addStudent()">Add to database</button>

      <div class="form-card-title" style="margin-top:24px;justify-content:space-between;">
        <span>All students (<span id="dbCount">0</span>)</span>
        <button class="db-btn" style="margin:0;" onclick="exportDB()">Export list</button>
      </div>
      <table class="db-table" id="dbTable">
        <thead><tr><th>Name</th><th>Father</th><th>Class</th><th>G.R</th><th>Seat</th><th></th></tr></thead>
        <tbody id="dbTableBody"></tbody>
      </table>
      <div class="db-empty" id="dbEmpty" style="display:none">No students added yet. Add one above to start building your school record.</div>
    </div>
  </div>
</div>

<script>
const FIELD_DEFS = {
  schoolName:{label:'School name',type:'text',default:'GBPS Pir Bhirkio'},
  teacherName:{label:'Teacher name',type:'text',default:'Abdul Qadeer Khan'},
  className:{label:'Class',type:'select',options:['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (SSC)','Class 11 (HSC-I)','Class 12 (HSC-II)']},
  subject:{label:'Subject',type:'select',options:['English','Urdu','Sindhi','Mathematics','General Science','General Knowledge','Islamiyat','Social Studies','Pakistan Studies','Physics','Chemistry','Biology','Computer Science']},
  unitNumber:{label:'Unit number',type:'select',options:['1','2','3','4','5','6','7','8','9','10','11','12']},
  unitName:{label:'Unit / topic name',type:'text',placeholder:'Family and Friends, Quadratic Equations...'},
  extraData:{label:'Extra details (optional)',type:'textarea',placeholder:'Specific requirements, additional instructions...'},
  studentName:{label:"Student's name",type:'text',placeholder:'Ali Hassan'},
  fatherName:{label:"Father's name",type:'text',placeholder:'Muhammad Hassan'},
  grNumber:{label:'G.R number',type:'text',placeholder:'2024-115'},
  seatNumber:{label:'Seat / roll number',type:'text',placeholder:'14'},
  dob:{label:'Date of birth',type:'date'},
  purpose:{label:'Purpose',type:'text',placeholder:'Scholarship application, bank account, visa...'},
  reason:{label:'Reason',type:'text',placeholder:'Family relocation, transfer request...'},
  personName:{label:"Person's name",type:'text',placeholder:'Full name'},
  cnic:{label:'CNIC / personal ID',type:'text',placeholder:'45302-1234567-1'},
  designation:{label:'Designation',type:'text',placeholder:'PST, Head Master, Clerk...'},
  duration:{label:'Duration of service',type:'text',placeholder:'2 years 3 months'},
  eventName:{label:'Event name',type:'text',placeholder:'Annual sports day, science fair...'},
  position:{label:'Position secured',type:'text',placeholder:'1st position, gold medal...'},
  month:{label:'Month',type:'text',placeholder:'July 2026'},
  leaveFrom:{label:'Leave from date',type:'date'},
  leaveTo:{label:'Leave to date',type:'date'},
  issue:{label:'Describe the issue',type:'textarea',placeholder:'What needs to be addressed?'},
  meetingDate:{label:'Meeting date',type:'date'},
  agenda:{label:'Agenda',type:'textarea',placeholder:'Topics to be discussed'},
  recipientDesignation:{label:'Addressed to',type:'text',placeholder:'District Education Officer, Khairpur'},
  subjectLine:{label:'Letter subject',type:'text',placeholder:'Request for school supplies'},
  eventDate:{label:'Event date',type:'date'},
  inwardNumber:{label:'Inward number',type:'text',placeholder:'INW-2026-045'},
  outwardNumber:{label:'Outward number',type:'text',placeholder:'OUT-2026-022'}
};

const DOC_CONFIG = {
  'Lesson Plan': {fields:['schoolName','teacherName','className','subject'],upload:true,title:'Lesson plan',crumb:'Academic',lessonRange:true},
  'Worksheet': {fields:['schoolName','teacherName','className','subject'],upload:true,title:'Worksheet',crumb:'Academic',lessonRange:true},
  'Assessment Rubric': {fields:['schoolName','teacherName','className','subject'],upload:true,title:'Assessment rubric',crumb:'Academic',lessonRange:true},
  'Exam Paper': {fields:['schoolName','teacherName','className','subject'],upload:true,title:'Exam paper',crumb:'Academic',lessonRange:true},
  'Annual Teaching Plan': {fields:['schoolName','teacherName','className','subject','extraData'],upload:false,title:'Annual teaching plan',crumb:'Academic'},
  'Monthly Teaching Plan': {fields:['schoolName','teacherName','className','subject','unitName','extraData'],upload:false,title:'Monthly teaching plan',crumb:'Academic'},
  'Progress Report': {fields:['schoolName','teacherName','studentName','fatherName','className','extraData'],upload:false,title:'Progress report',crumb:'Academic'},
  'CRQ Paper': {fields:[],upload:false,title:'CRQ paper',crumb:'Academic',crq:true},

  'Character Certificate': {fields:['schoolName','teacherName','studentName','fatherName','className','grNumber','seatNumber','purpose'],upload:false,title:'Character certificate',crumb:'School docs'},
  'Transfer Certificate': {fields:['schoolName','teacherName','studentName','fatherName','className','grNumber','reason'],upload:false,title:'Transfer certificate',crumb:'School docs'},
  'Bonafide Certificate': {fields:['schoolName','teacherName','studentName','fatherName','className','grNumber','purpose'],upload:false,title:'Bonafide certificate',crumb:'School docs'},\n  'School Leaving Certificate': {fields:['schoolName','teacherName','studentName','fatherName','className','grNumber','dob','reason'],upload:false,title:'School leaving certificate',crumb:'School docs'},
  'NOC Letter': {fields:['schoolName','teacherName','personName','cnic','designation','purpose'],upload:false,title:'NOC letter',crumb:'School docs'},
  'School Improvement Plan': {fields:['schoolName','teacherName','extraData'],upload:false,title:'School improvement plan',crumb:'School docs'},
  'Prize Certificate': {fields:['schoolName','teacherName','studentName','className','eventName','position'],upload:false,title:'Prize certificate',crumb:'School docs'},
  'Experience Certificate': {fields:['schoolName','teacherName','personName','cnic','designation','duration'],upload:false,title:'Experience certificate',crumb:'School docs'},
  'Salary Certificate': {fields:['schoolName','teacherName','personName','cnic','designation','purpose'],upload:false,title:'Salary certificate',crumb:'School docs'},

  'Result Card': {fields:['schoolName','teacherName','studentName','fatherName','className','grNumber','seatNumber','dob','extraData'],upload:false,title:'Result card',crumb:'Student'},
  'Attendance Sheet': {fields:['schoolName','teacherName','className'],upload:false,title:'Attendance sheet',crumb:'Student',attendanceDuration:true},
  'Scholarship Form': {fields:['schoolName','teacherName','studentName','fatherName','className','grNumber','seatNumber','extraData'],upload:false,title:'Scholarship form',crumb:'Student'},
  'Enrollment Form': {fields:['schoolName','teacherName','studentName','fatherName','className','grNumber','dob','extraData'],upload:false,title:'Enrollment form',crumb:'Student'},
  'Student Profile': {fields:['schoolName','teacherName','studentName','fatherName','className','grNumber','seatNumber','dob','extraData'],upload:false,title:'Student profile',crumb:'Student'},

  'Leave Application': {fields:['schoolName','teacherName','designation','leaveFrom','leaveTo','reason','inwardNumber','outwardNumber'],upload:false,title:'Leave application',crumb:'Admin'},
  'Parent Complaint Letter': {fields:['schoolName','teacherName','studentName','fatherName','className','seatNumber','grNumber','issue'],upload:false,title:'Parent complaint letter',crumb:'Admin'},
  'Meeting Minutes': {fields:['schoolName','teacherName','meetingDate','agenda'],upload:false,title:'Meeting minutes',crumb:'Admin'},
  'Budget Statement': {fields:['schoolName','teacherName','extraData'],upload:false,title:'Budget statement',crumb:'Admin'},
  'Inspection Report': {fields:['schoolName','teacherName','extraData'],upload:false,title:'Inspection report',crumb:'Admin'},
  'Official Letter': {fields:['schoolName','teacherName','recipientDesignation','subjectLine','extraData'],upload:false,title:'Official letter',crumb:'Admin'},
  'Stock Register': {fields:['schoolName','teacherName','extraData'],upload:false,title:'Stock register',crumb:'Admin'},
  'Library Register': {fields:['schoolName','teacherName','extraData'],upload:false,title:'Library register',crumb:'Admin'},

  'Age Calculator Sheet': {fields:[],upload:false,title:'Age calculator',crumb:'Tools',ageCalc:true},
  'Event Banner Content': {fields:['schoolName','eventName','eventDate','extraData'],upload:false,title:'Event banner content',crumb:'Tools'},
  'Affidavit': {fields:['schoolName','personName','purpose'],upload:false,title:'Affidavit',crumb:'Tools'},
  'Complaint Letter': {fields:['schoolName','teacherName','issue'],upload:false,title:'Complaint letter',crumb:'Tools'}
};

const S={doc:'Lesson Plan',lang:'bilingual_en_ur',content:'',docxBase64:null,fileName:null,file:null,crqFile:null,diff:'easy',ak:false,unitMode:'single',crqUnitMode:'single',attDurMode:'month'};

function showCat(el,cat){
  document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('on'));
  el.classList.add('on');
  ['academic','school','student','admin','tools'].forEach(c=>{
    document.getElementById('panel-'+c).style.display = c===cat ? 'grid' : 'none';
  });
  const firstTile = document.querySelector('#panel-'+cat+' .dtile');
  if(firstTile){ setDoc(firstTile); }
}

function fieldHtml(key){
  const def=FIELD_DEFS[key];
  if(!def) return '';
  const id='f_'+key;
  if(def.type==='select'){
    return '<div class="field"><label>'+def.label+'</label><select id="'+id+'">'+def.options.map(o=>'<option>'+o+'</option>').join('')+'</select></div>';
  }
  if(def.type==='textarea'){
    return '<div class="field"><label>'+def.label+'</label><textarea id="'+id+'" placeholder="'+(def.placeholder||'')+'"></textarea></div>';
  }
  if(def.type==='date'){
    return '<div class="field"><label>'+def.label+'</label><input type="date" id="'+id+'"></div>';
  }
  return '<div class="field"><label>'+def.label+'</label><input type="text" id="'+id+'" value="'+(def.default||'')+'" placeholder="'+(def.placeholder||'')+'"></div>';
}

function lessonRangeHtml(prefix){
  return '<div class="form-card"><div class="form-card-title">Lesson / unit scope</div>' +
    '<div class="lesson-mode-row">' +
    '<button class="pill on" id="'+prefix+'modeSingle" onclick="setUnitMode(\\''+prefix+'\\',\\'single\\')">Single unit</button>' +
    '<button class="pill" id="'+prefix+'modeCustom" onclick="setUnitMode(\\''+prefix+'\\',\\'custom\\')">Custom lessons</button>' +
    '<button class="pill" id="'+prefix+'modeFullbook" onclick="setUnitMode(\\''+prefix+'\\',\\'fullbook\\')">Full book</button>' +
    '</div>' +
    '<div id="'+prefix+'singleArea" class="form-row">' + fieldHtml('unitNumber').replace('id="f_unitNumber"','id="'+prefix+'f_unitNumber"') + fieldHtml('unitName').replace('id="f_unitName"','id="'+prefix+'f_unitName"') + '</div>' +
    '<div id="'+prefix+'customArea" class="form-row one" style="display:none"><div class="field"><label>Specify lessons</label><input type="text" id="'+prefix+'f_customLessons" placeholder="e.g. Lessons 3 to 7, or Lessons 2, 4, 9"><div class="field-hint">Type any combination — a range, a list, or topics spanning multiple lessons.</div></div></div>' +
    '<div id="'+prefix+'fullbookArea" style="display:none"><div class="field-hint">The full book / entire syllabus for this class and subject will be covered.</div></div>' +
    '</div>';
}

function setUnitMode(prefix, mode){
  if(prefix==='') S.unitMode = mode; else S.crqUnitMode = mode;
  ['Single','Custom','Fullbook'].forEach(m=>{
    const btn = document.getElementById(prefix+'mode'+m);
    if(btn) btn.classList.toggle('on', m.toLowerCase()===mode);
  });
  document.getElementById(prefix+'singleArea').style.display = mode==='single' ? 'grid' : 'none';
  document.getElementById(prefix+'customArea').style.display = mode==='custom' ? 'grid' : 'none';
  document.getElementById(prefix+'fullbookArea').style.display = mode==='fullbook' ? 'block' : 'none';
}

function attendanceDurationHtml(){
  return '<div class="form-card"><div class="form-card-title">Duration</div>' +
    '<div class="lesson-mode-row">' +
    '<button class="pill on" id="attModeMonth" onclick="setAttMode(\\'month\\')">Single month</button>' +
    '<button class="pill" id="attModeCustom" onclick="setAttMode(\\'custom\\')">Custom range (e.g. 6 months)</button>' +
    '</div>' +
    '<div id="attMonthArea" class="form-row one">' + fieldHtml('month').replace('id="f_month"','id="att_f_month"') + '</div>' +
    '<div id="attCustomArea" class="form-row one" style="display:none"><div class="field"><label>Specify duration</label><input type="text" id="att_f_customDuration" placeholder="e.g. January to June 2026, or last 6 months"></div></div>' +
    '</div>';
}

function setAttMode(mode){
  S.attDurMode = mode;
  document.getElementById('attModeMonth').classList.toggle('on', mode==='month');
  document.getElementById('attModeCustom').classList.toggle('on', mode==='custom');
  document.getElementById('attMonthArea').style.display = mode==='month' ? 'grid' : 'none';
  document.getElementById('attCustomArea').style.display = mode==='custom' ? 'grid' : 'none';
}

function renderForm(docType){
  const cfg=DOC_CONFIG[docType];
  const area=document.getElementById('dynamicArea');
  S.unitMode='single'; S.crqUnitMode='single'; S.attDurMode='month';

  if(cfg.crq){
    area.innerHTML = crqHtml();
    return;
  }
  if(cfg.ageCalc){
    area.innerHTML = '<div class="age-card">' +
      '<div class="form-card-title">Admission eligibility check</div>' +
      '<div class="form-row"><div class="field"><label>Date of birth</label><input type="date" id="dob"></div>' +
      '<div class="field"><label>Cutoff date</label><input type="date" id="cutoff" value="2025-04-01"></div></div>' +
      '<button class="btn-main" onclick="calcAge()">Calculate</button>' +
      '<div id="ageResult" style="margin-top:12px"></div></div>';
    return;
  }

  let html = '';

  if(cfg.lessonRange){
    html += lessonRangeHtml('');
  }
  if(cfg.attendanceDuration){
    html += attendanceDurationHtml();
  }

  let rowsHtml = wrapFieldsInRows(cfg.fields);
  html += '<div class="form-card"><div class="form-card-title">'+cfg.title+' details</div>'+rowsHtml+'</div>';

  if(cfg.upload){
    html += '<div class="upload-zone" id="dropZone" onclick="document.getElementById(\\'fileIn\\').click()" ondrop="handleDrop(event)" ondragover="event.preventDefault()">' +
      '<div class="upload-zone-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.6 4.4 0 0 1 0-9c.4-2 2.2-4 5-4 3 0 5 2 5.3 4.5A4 4 0 0 1 19 18"/><polyline points="12 11 12 18"/><polyline points="9 14 12 11 15 14"/></svg></div>' +
      '<div class="ut">Drop a textbook page or PDF to generate from it</div>' +
      '<div class="us">JPG, PNG, PDF — up to 50MB (optional)</div></div>' +
      '<input type="file" id="fileIn" accept="image/*,.pdf" style="display:none" onchange="onFileSel(event)">' +
      '<div class="file-tag" id="fileTag"></div>';
  }

  html += '<button class="btn-main" id="genBtn" onclick="generateDoc()">Generate document</button>' +
    '<div class="loader" id="loader"><div class="spin"></div><p>Generating your document...</p></div>' +
    resultHtml();

  area.innerHTML = html;
}

function wrapFieldsInRows(fields){
  const rows=[];
  let i=0;
  while(i<fields.length){
    const f=fields[i];
    const isWide = FIELD_DEFS[f] && (FIELD_DEFS[f].type==='textarea');
    if(isWide){
      rows.push('<div class="form-row one">'+fieldHtml(f)+'</div>');
      i++;
    } else {
      const pair=[fields[i]];
      if(fields[i+1] && !(FIELD_DEFS[fields[i+1]] && FIELD_DEFS[fields[i+1]].type==='textarea')){
        pair.push(fields[i+1]);
        i+=2;
      } else { i++; }
      rows.push('<div class="form-row">'+pair.map(fieldHtml).join('')+'</div>');
    }
  }
  return rows.join('');
}

function resultHtml(){
  return '<div class="result" id="resultBox" style="margin-top:18px">' +
    '<div class="res-head"><div class="rt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="9 12 11.5 14.5 16 9"/></svg><span id="resTitle">Document ready</span></div>' +
    '<div class="res-btns"><button class="bdl acc" onclick="downloadDocx()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>Word</button>' +
    '<button class="bdl" onclick="downloadPdf()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>PDF</button>' +
    '<button class="bdl" onclick="copyText()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3"/></svg>Copy</button></div></div>' +
    '<div class="res-body" id="resBody"></div>' +
    '<div class="res-foot">generated by aqkanhar — teacher toolkit</div></div>';
}

function crqHtml(){
  return lessonRangeHtml('crq_') +
    '<div class="crq-box">' +
    '<div class="crq-top"><div class="crq-top-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><span>CRQ paper generator</span></div>' +
    '<div class="crq-sub">Upload a textbook page or PDF — AI builds a complete CRQ paper with answer key.</div>' +
    '<div class="form-row"><div class="field"><label>School name</label><input type="text" id="crqSchool" value="GBPS Pir Bhirkio"></div>' +
    '<div class="field"><label>Teacher name</label><input type="text" id="crqTeacher" value="Abdul Qadeer Khan"></div></div>' +
    '<div class="form-row"><div class="field"><label>Class</label><select id="crqClass">'+FIELD_DEFS.className.options.map(o=>'<option>'+o+'</option>').join('')+'</select></div>' +
    '<div class="field"><label>Subject</label><select id="crqSubject">'+FIELD_DEFS.subject.options.map(o=>'<option>'+o+'</option>').join('')+'</select></div></div>' +
    '<div class="crq-section-lbl">Source (optional, up to 50MB)</div>' +
    '<div class="upload-mini" id="crqDrop" onclick="document.getElementById(\\'crqFile\\').click()" ondrop="crqDrop(event)" ondragover="event.preventDefault()">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18a4.6 4.4 0 0 1 0-9c.4-2 2.2-4 5-4 3 0 5 2 5.3 4.5A4 4 0 0 1 19 18"/><polyline points="12 11 12 18"/><polyline points="9 14 12 11 15 14"/></svg>Drop a textbook page, image or PDF</div>' +
    '<input type="file" id="crqFile" accept="image/*,.pdf" style="display:none" onchange="crqFileSel(event)">' +
    '<div class="file-tag" id="crqFileTag"></div>' +
    '<div class="crq-row three" style="margin-top:16px"><div><div class="crq-section-lbl">Difficulty</div>' +
    '<div class="pill-row"><button class="pill on" id="diffEasy" onclick="setDiff(\\'easy\\')">Easy</button>' +
    '<button class="pill" id="diffMed" onclick="setDiff(\\'medium\\')">Medium</button>' +
    '<button class="pill" id="diffHard" onclick="setDiff(\\'hard\\')">Hard</button></div></div></div>' +
    '<div class="crq-section-lbl" style="margin-top:16px">Bloom\\'s taxonomy levels</div>' +
    '<div class="chk-grid"><label class="chk-item"><input type="checkbox" value="Remember" checked> Remember</label>' +
    '<label class="chk-item"><input type="checkbox" value="Understand" checked> Understand</label>' +
    '<label class="chk-item"><input type="checkbox" value="Apply" checked> Apply</label>' +
    '<label class="chk-item"><input type="checkbox" value="Analyze"> Analyze</label>' +
    '<label class="chk-item"><input type="checkbox" value="Evaluate"> Evaluate</label>' +
    '<label class="chk-item"><input type="checkbox" value="Create"> Create</label></div>' +
    '<div class="crq-row three" style="margin-top:16px"><div><label>MCQs</label><input type="number" id="mcqCount" value="10" min="5" max="30"></div>' +
    '<div><label>Short questions</label><input type="number" id="shortCount" value="5" min="2" max="15"></div>' +
    '<div><label>Long questions</label><input type="number" id="longCount" value="2" min="1" max="8"></div></div>' +
    '<div class="toggle-row"><label>Include answer key</label><div class="sw" id="akSwitch" onclick="toggleAK()"><div class="sw-knob"></div></div></div>' +
    '<button class="btn-crq" id="crqGenBtn" onclick="generateCRQ()">Generate CRQ paper</button></div>' +
    '<div class="loader" id="loader"><div class="spin"></div><p>Generating your document...</p></div>' +
    resultHtml();
}

function setDoc(el){
  document.querySelectorAll('.dtile').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  const doc = el.dataset.doc;
  S.doc=doc;
  const cfg=DOC_CONFIG[doc];
  document.getElementById('pageTitle').textContent=cfg.title;
  document.getElementById('crumbCat').textContent=cfg.crumb;
  renderForm(doc);
}

function onLangChange(){ S.lang=document.getElementById('langSel').value; }

function calcAge(){
  const dv=document.getElementById('dob').value, cv=document.getElementById('cutoff').value;
  if(!dv){alert('Enter date of birth.');return;}
  const d=new Date(dv),c=new Date(cv);
  let y=c.getFullYear()-d.getFullYear(),m=c.getMonth()-d.getMonth(),dd=c.getDate()-d.getDate();
  if(dd<0){m--;dd+=30;} if(m<0){y--;m+=12;}
  const ok=(y*12+m)>=60 && (y*12+m)<=96;
  document.getElementById('ageResult').innerHTML =
    '<div style="font-size:13px;padding:11px;border-radius:8px;background:'+(ok?'#eafaf0':'#fdeeee')+';color:'+(ok?'#1a7a44':'#b3261e')+';font-weight:500">'+
    y+' years, '+m+' months, '+dd+' days — '+(ok?'eligible for Class 1':'not eligible (must be 5 to 8 years)')+'</div>';
}

function setDiff(d){
  S.diff=d;
  document.getElementById('diffEasy').classList.toggle('on',d==='easy');
  document.getElementById('diffMed').classList.toggle('on',d==='medium');
  document.getElementById('diffHard').classList.toggle('on',d==='hard');
}
function toggleAK(){ S.ak=!S.ak; document.getElementById('akSwitch').classList.toggle('on',S.ak); }
function crqFileSel(e){ if(e.target.files[0]) setCrqFile(e.target.files[0]); }
function crqDrop(e){ e.preventDefault(); if(e.dataTransfer.files[0]) setCrqFile(e.dataTransfer.files[0]); }
function setCrqFile(f){
  S.crqFile=f;
  document.getElementById('crqFileTag').textContent=f.name+' ('+(f.size/1024).toFixed(0)+' KB)';
  document.getElementById('crqFileTag').style.display='block';
}
function onFileSel(e){ if(e.target.files[0]) setFile(e.target.files[0]); }
function handleDrop(e){ e.preventDefault(); if(e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }
function setFile(f){
  S.file=f;
  document.getElementById('fileTag').textContent=f.name+' ('+(f.size/1024).toFixed(0)+' KB)';
  document.getElementById('fileTag').style.display='block';
}

function showLoader(){
  const btn=document.getElementById('genBtn')||document.getElementById('crqGenBtn');
  if(btn) btn.disabled=true;
  document.getElementById('loader').style.display='block';
  document.getElementById('resultBox').style.display='none';
}
function hideLoader(){
  const btn=document.getElementById('genBtn')||document.getElementById('crqGenBtn');
  if(btn) btn.disabled=false;
  document.getElementById('loader').style.display='none';
}
function showResult(content,title){
  S.content=content;
  hideLoader();
  document.getElementById('resultBox').style.display='block';
  document.getElementById('resBody').textContent=content;
  document.getElementById('resTitle').textContent=(title||S.doc)+' — ready';
  document.getElementById('resultBox').scrollIntoView({behavior:'smooth',block:'start'});
}

function showResultDownloadReady(title){
  hideLoader();
  const box=document.getElementById('resultBox');
  box.style.display='block';
  document.getElementById('resTitle').textContent=(title||S.doc)+' — ready to download';
  document.getElementById('resBody').innerHTML =
    '<div style="text-align:center;padding:30px 0;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" width="48" height="48" style="margin:0 auto 14px;display:block"><circle cx="12" cy="12" r="9"/><polyline points="9 12 11.5 14.5 16 9"/></svg>' +
    '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">Your document is ready</div>' +
    '<div style="font-size:12.5px;color:var(--text-muted);">Use the buttons above to download as Word or PDF.</div>' +
    '</div>';
  box.scrollIntoView({behavior:'smooth',block:'start'});
}

function gv(id){ const el=document.getElementById('f_'+id); return el ? el.value : ''; }

async function generateDoc(){
  const cfg=DOC_CONFIG[S.doc];
  const payload={ documentType:S.doc, language:S.lang };
  cfg.fields.forEach(f=>{ payload[f]=gv(f); });

  if(cfg.lessonRange){
    payload.unitMode = S.unitMode;
    if(S.unitMode==='single'){
      payload.unitNumber = document.getElementById('f_unitNumber') ? document.getElementById('f_unitNumber').value : '';
      payload.unitName = document.getElementById('f_unitName') ? document.getElementById('f_unitName').value : '';
    } else if(S.unitMode==='custom'){
      payload.customLessons = document.getElementById('f_customLessons') ? document.getElementById('f_customLessons').value : '';
    }
  }
  if(cfg.attendanceDuration){
    payload.durationMode = S.attDurMode;
    if(S.attDurMode==='month'){
      payload.month = document.getElementById('att_f_month') ? document.getElementById('att_f_month').value : '';
    } else {
      payload.customDuration = document.getElementById('att_f_customDuration') ? document.getElementById('att_f_customDuration').value : '';
    }
  }

  if(cfg.lessonRange && S.unitMode==='single' && !payload.unitName){
    alert('Enter unit or topic name.'); return;
  }
  if(cfg.lessonRange && S.unitMode==='custom' && !payload.customLessons){
    alert('Specify which lessons to cover.'); return;
  }

  showLoader();
  try{
    const r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(d.success){ S.docxBase64=d.docxBase64; S.fileName=d.fileName; showResultDownloadReady(S.doc); }
    else { hideLoader(); alert('Error: '+d.error); }
  }catch(e){ hideLoader(); alert('Server error.'); }
}

async function generateCRQ(){
  const fd=new FormData();
  fd.append('schoolName',document.getElementById('crqSchool').value);
  fd.append('teacherName',document.getElementById('crqTeacher').value);
  fd.append('className',document.getElementById('crqClass').value);
  fd.append('subject',document.getElementById('crqSubject').value);
  fd.append('unitMode', S.crqUnitMode);
  if(S.crqUnitMode==='single'){
    const un = document.getElementById('crq_f_unitName') ? document.getElementById('crq_f_unitName').value : '';
    if(!un){ alert('Enter topic or unit name.'); return; }
    fd.append('unitName', un);
    fd.append('unitNumber', document.getElementById('crq_f_unitNumber') ? document.getElementById('crq_f_unitNumber').value : '');
  } else if(S.crqUnitMode==='custom'){
    const cl = document.getElementById('crq_f_customLessons') ? document.getElementById('crq_f_customLessons').value : '';
    if(!cl){ alert('Specify which lessons to cover.'); return; }
    fd.append('customLessons', cl);
    fd.append('unitName', cl);
  } else {
    fd.append('unitName', 'Full book');
  }

  const bl=[...document.querySelectorAll('.chk-grid input:checked')].map(c=>c.value);
  if(!bl.length){ alert('Select at least one Bloom level.'); return; }
  showLoader();
  fd.append('difficulty',S.diff);
  fd.append('bloomLevels',JSON.stringify(bl));
  fd.append('mcqCount',document.getElementById('mcqCount').value);
  fd.append('shortCount',document.getElementById('shortCount').value);
  fd.append('longCount',document.getElementById('longCount').value);
  fd.append('includeAnswerKey',String(S.ak));
  fd.append('language',S.lang);
  if(S.crqFile) fd.append('file',S.crqFile);
  try{
    const r=await fetch('/generate-crq',{method:'POST',body:fd});
    const d=await r.json();
    if(d.success){ S.docxBase64=d.docxBase64; S.fileName=d.fileName; showResultDownloadReady('CRQ Paper'); }
    else { hideLoader(); alert('Error: '+d.error); }
  }catch(e){ hideLoader(); alert('Server error.'); }
}

function base64ToBlob(base64, mime){
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mime });
}
function downloadDocx(){
  if(!S.docxBase64){ alert('No document generated yet.'); return; }
  const blob = base64ToBlob(S.docxBase64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = u; a.download = (S.fileName||'document') + '.docx'; a.click();
  URL.revokeObjectURL(u);
}
async function downloadPdf(){
  if(!S.docxBase64){ alert('No document generated yet.'); return; }
  alert('PDF export from the new fixed-template engine is coming in the next update — for now please use Word download, which keeps the exact same professional layout.');
}
function copyText(){ alert('Copy as text is not available in the new fixed-layout mode — please use the Word download button.'); }

const DB_KEY = 'tt_student_db_v1';
function getDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)||'[]'); }catch(e){ return []; } }
function saveDB(arr){ localStorage.setItem(DB_KEY, JSON.stringify(arr)); }

function openDB(){
  document.getElementById('dbModal').classList.add('show');
  renderDBTable();
}
function closeDB(){ document.getElementById('dbModal').classList.remove('show'); }

function addStudent(){
  const name=document.getElementById('db_name').value.trim();
  const father=document.getElementById('db_father').value.trim();
  const cls=document.getElementById('db_class').value;
  const gr=document.getElementById('db_gr').value.trim();
  const seat=document.getElementById('db_seat').value.trim();
  const dob=document.getElementById('db_dob').value;
  if(!name || !gr){ alert('Student name and G.R number are required.'); return; }
  const db=getDB();
  db.push({id:Date.now(), name, father, cls, gr, seat, dob});
  saveDB(db);
  document.getElementById('db_name').value='';
  document.getElementById('db_father').value='';
  document.getElementById('db_gr').value='';
  document.getElementById('db_seat').value='';
  document.getElementById('db_dob').value='';
  renderDBTable();
}

function deleteStudent(id){
  let db=getDB();
  db=db.filter(s=>s.id!==id);
  saveDB(db);
  renderDBTable();
}

function renderDBTable(){
  const db=getDB();
  document.getElementById('dbCount').textContent=db.length;
  const body=document.getElementById('dbTableBody');
  const empty=document.getElementById('dbEmpty');
  if(!db.length){
    body.innerHTML='';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';
  body.innerHTML = db.map(s =>
    '<tr onclick="useStudent('+s.id+')">' +
    '<td>'+s.name+'</td><td>'+(s.father||'-')+'</td><td>'+s.cls+'</td><td>'+s.gr+'</td><td>'+(s.seat||'-')+'</td>' +
    '<td class="db-actions"><button class="db-mini-btn danger" onclick="event.stopPropagation();deleteStudent('+s.id+')">Remove</button></td>' +
    '</tr>'
  ).join('');
}

async function exportDB(){
  const db=getDB();
  if(!db.length){ alert('No students in the database yet. Add at least one student first.'); return; }
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Generating...';
  btn.disabled = true;
  try{
    const r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      documentType:'Student Database List',
      schoolName: document.getElementById('schoolName') ? document.getElementById('schoolName').value : 'GBPS Pir Bhirkio',
      teacherName: document.getElementById('teacherName') ? document.getElementById('teacherName').value : 'Abdul Qadeer Khan',
      language:'english',
      students: db
    })});
    const d=await r.json();
    if(d.success){
      const blob = base64ToBlob(d.docxBase64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = u; a.download = 'Student_Database.docx'; a.click();
      URL.revokeObjectURL(u);
    } else {
      alert('Error: ' + d.error);
    }
  }catch(e){ alert('Server error while exporting.'); }
  btn.textContent = originalText;
  btn.disabled = false;
}

function useStudent(id){
  const db=getDB();
  const s=db.find(x=>x.id===id);
  if(!s) return;
  const map={studentName:s.name, fatherName:s.father, className:s.cls, grNumber:s.gr, seatNumber:s.seat, dob:s.dob};
  Object.keys(map).forEach(k=>{
    const el=document.getElementById('f_'+k);
    if(el && map[k]) el.value=map[k];
  });
  closeDB();
}

renderForm('Lesson Plan');
</script>
</body>
</html>`;

fs.writeFileSync('public/index.html', html);
console.log('index.html written. Lines: ' + html.split('\n').length);

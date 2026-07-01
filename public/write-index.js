const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Teacher Toolkit</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --navy: #1a2744;
  --navy-dark: #0f1a2e;
  --navy-light: #243257;
  --gold: #c8960c;
  --gold-light: #f5c842;
  --gold-bg: #fef9e7;
  --white: #ffffff;
  --gray-50: #f8f9fc;
  --gray-100: #f1f4f9;
  --gray-200: #e2e8f4;
  --gray-300: #c8d3e8;
  --gray-400: #8898b8;
  --gray-600: #4a5878;
  --gray-800: #1e2d4a;
  --green: #0a7c5c;
  --green-bg: #eafaf4;
  --red: #b91c1c;
  --red-bg: #fef2f2;
  --blue: #1d4ed8;
  --blue-bg: #eff6ff;
  --shadow-sm: 0 1px 3px rgba(26,39,68,0.08);
  --shadow: 0 4px 12px rgba(26,39,68,0.1);
  --shadow-lg: 0 8px 28px rgba(26,39,68,0.14);
  --radius: 10px;
  --radius-lg: 14px;
}
[data-theme="dark"] {
  --white: #111827;
  --gray-50: #1a2236;
  --gray-100: #1e2a40;
  --gray-200: #253350;
  --gray-300: #2e3f62;
  --gray-400: #6b7fa8;
  --gray-600: #94a3c4;
  --gray-800: #e2e8f4;
  --gold-bg: #1a1400;
  --green-bg: #052e1c;
  --red-bg: #1c0808;
  --blue-bg: #0c1a3a;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;background:var(--gray-50);color:var(--gray-800);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
button,input,select,textarea{font-family:inherit}
button{cursor:pointer;border:none;background:none}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:var(--gray-300);border-radius:99px}

/* TOPBAR */
.topbar{
  position:sticky;top:0;z-index:100;
  background:var(--navy-dark);
  border-bottom:3px solid var(--gold);
  padding:0 28px;height:58px;
  display:flex;align-items:center;justify-content:space-between;
}
.brand{display:flex;align-items:center;gap:12px}
.brand-logo{
  width:36px;height:36px;border-radius:8px;
  background:linear-gradient(135deg,var(--gold),var(--gold-light));
  display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:800;color:var(--navy-dark);
  flex-shrink:0;letter-spacing:-1px;
}
.brand-name{font-size:16px;font-weight:800;color:var(--white);letter-spacing:-.3px}
.brand-name span{color:var(--gold-light)}
.topbar-right{display:flex;align-items:center;gap:10px}
.dev-badge{
  font-size:11px;font-weight:600;color:var(--gray-400);
  padding:4px 12px;border-radius:99px;
  border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.05);
  letter-spacing:.3px;
}
.dev-badge em{color:var(--gold-light);font-style:normal}
.theme-toggle{
  width:34px;height:34px;border-radius:8px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06);
  display:flex;align-items:center;justify-content:center;
  font-size:16px;color:var(--gray-400);
  transition:all .2s;
}
.theme-toggle:hover{background:rgba(255,255,255,.12);color:var(--gold-light)}

/* HERO */
.hero{
  background:linear-gradient(160deg,var(--navy-dark) 0%,var(--navy) 60%,var(--navy-light) 100%);
  padding:36px 28px 32px;border-bottom:2px solid var(--gold);
  position:relative;overflow:hidden;
}
.hero::after{
  content:'';position:absolute;
  bottom:-40px;right:-40px;width:220px;height:220px;
  border-radius:50%;border:40px solid rgba(200,150,12,.08);
}
.hero::before{
  content:'';position:absolute;
  top:-30px;left:40%;width:160px;height:160px;
  border-radius:50%;border:30px solid rgba(200,150,12,.05);
}
.hero-inner{max-width:960px;margin:0 auto;position:relative;z-index:1}
.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap}
.hero-left{}
.hero-label{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(200,150,12,.15);border:1px solid rgba(200,150,12,.3);
  border-radius:99px;padding:3px 12px;
  font-size:10px;font-weight:700;color:var(--gold-light);
  letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;
}
.hero h1{
  font-size:clamp(20px,3.5vw,32px);font-weight:800;
  color:#fff;letter-spacing:-.4px;line-height:1.2;margin-bottom:8px;
}
.hero h1 span{color:var(--gold-light)}
.hero-sub{font-size:12.5px;color:rgba(255,255,255,.5);max-width:460px;line-height:1.7}
.hero-stats{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}
.stat-chip{
  display:flex;align-items:center;gap:8px;
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.1);
  border-radius:var(--radius);padding:10px 14px;
  min-width:110px;
}
.stat-num{font-size:17px;font-weight:800;color:#fff;line-height:1}
.stat-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:rgba(255,255,255,.4);margin-top:2px}

/* MAIN */
.main{max-width:960px;margin:24px auto;padding:0 16px 80px}

/* CARD */
.card{
  background:var(--white);border-radius:var(--radius-lg);
  border:1px solid var(--gray-200);box-shadow:var(--shadow-sm);
  margin-bottom:16px;overflow:hidden;
}
.card-head{
  display:flex;align-items:center;gap:10px;
  padding:14px 20px;border-bottom:1px solid var(--gray-100);
  background:var(--gray-50);
}
.ch-indicator{
  width:3px;height:20px;border-radius:99px;background:var(--gold);flex-shrink:0;
}
.ch-title{font-size:11px;font-weight:700;color:var(--gray-600);text-transform:uppercase;letter-spacing:.7px}
.card-body{padding:18px 20px}

/* LANGUAGE */
.lang-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.lang-opt{
  display:flex;align-items:center;gap:10px;
  padding:10px 12px;border-radius:var(--radius);
  border:1.5px solid var(--gray-200);cursor:pointer;
  background:var(--gray-50);transition:all .18s;
}
.lang-opt:hover{border-color:var(--navy);background:var(--blue-bg)}
.lang-opt.active{
  border-color:var(--navy);background:var(--navy);
}
.lo-radio{
  width:15px;height:15px;border-radius:50%;border:2px solid var(--gray-300);
  flex-shrink:0;display:flex;align-items:center;justify-content:center;
  transition:all .18s;
}
.lang-opt.active .lo-radio{border-color:var(--gold-light);background:var(--gold)}
.lo-dot{width:5px;height:5px;border-radius:50%;background:#fff;display:none}
.lang-opt.active .lo-dot{display:block}
.lo-name{font-size:12px;font-weight:700;color:var(--gray-800);line-height:1}
.lo-sub{font-size:10px;color:var(--gray-400);margin-top:2px}
.lang-opt.active .lo-name{color:#fff}
.lang-opt.active .lo-sub{color:rgba(255,255,255,.5)}

/* CRQ SECTION */
.crq-wrap{
  background:linear-gradient(145deg,var(--navy-dark),var(--navy));
  border-radius:var(--radius-lg);border:1px solid rgba(200,150,12,.2);
  overflow:hidden;margin-bottom:16px;position:relative;
}
.crq-wrap::after{
  content:'CRQ';position:absolute;right:-10px;top:20px;
  font-size:80px;font-weight:900;color:rgba(255,255,255,.03);
  line-height:1;letter-spacing:-4px;pointer-events:none;
}
.crq-head{
  padding:22px 24px 18px;border-bottom:1px solid rgba(255,255,255,.08);
}
.crq-tag{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(200,150,12,.15);border:1px solid rgba(200,150,12,.25);
  border-radius:99px;padding:3px 12px;
  font-size:9px;font-weight:800;color:var(--gold-light);
  letter-spacing:1.2px;text-transform:uppercase;margin-bottom:12px;
}
.crq-title{font-size:19px;font-weight:800;color:#fff;letter-spacing:-.3px}
.crq-title em{color:var(--gold-light);font-style:normal}
.crq-desc{font-size:12px;color:rgba(255,255,255,.45);margin-top:6px;line-height:1.6;max-width:500px}
.crq-body{padding:22px 24px}
.crq-lbl{font-size:10px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}

/* Difficulty */
.diff-row{display:flex;gap:8px;flex-wrap:wrap}
.diff-btn{
  padding:7px 20px;border-radius:99px;
  font-size:11px;font-weight:700;cursor:pointer;
  border:1.5px solid rgba(255,255,255,.12);
  color:rgba(255,255,255,.4);background:transparent;
  transition:all .18s;font-family:'Inter';
}
.diff-btn:hover{border-color:rgba(255,255,255,.3);color:rgba(255,255,255,.7)}
.diff-btn.d-easy{border-color:#10b981;color:#10b981;background:rgba(16,185,129,.1)}
.diff-btn.d-medium{border-color:var(--gold-light);color:var(--gold-light);background:rgba(200,150,12,.1)}
.diff-btn.d-hard{border-color:#f87171;color:#f87171;background:rgba(248,113,113,.1)}

/* Bloom */
.bloom-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.bloom-item{
  display:flex;align-items:center;gap:8px;
  padding:8px 12px;border-radius:var(--radius);cursor:pointer;
  border:1.5px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.03);transition:all .18s;
}
.bloom-item:hover{border-color:rgba(255,255,255,.18)}
.bloom-item input{display:none}
.b-box{
  width:15px;height:15px;border-radius:4px;flex-shrink:0;
  border:1.5px solid rgba(255,255,255,.2);
  display:flex;align-items:center;justify-content:center;
  transition:all .18s;font-size:9px;color:#fff;font-weight:800;
}
.bloom-item input:checked ~ .b-box{background:var(--blue);border-color:var(--blue)}
.b-name{font-size:11px;font-weight:600;color:rgba(255,255,255,.6)}
.b-sub{font-size:9px;color:rgba(255,255,255,.25);display:block;margin-top:1px}

/* Q Count */
.count-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.count-box .count-lbl{font-size:9px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px}
.count-inp{
  width:100%;padding:10px;border-radius:var(--radius);
  border:1.5px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.05);color:#fff;
  font-size:15px;font-weight:700;text-align:center;
  outline:none;font-family:'Inter';transition:all .18s;
}
.count-inp:focus{border-color:var(--gold);background:rgba(200,150,12,.08)}

/* Upload in CRQ */
.crq-drop{
  border:1.5px dashed rgba(255,255,255,.15);border-radius:var(--radius);
  padding:20px;text-align:center;cursor:pointer;
  background:rgba(255,255,255,.02);transition:all .2s;
}
.crq-drop:hover,.crq-drop.over{border-color:rgba(16,185,129,.5);background:rgba(16,185,129,.05)}
.cd-icon{font-size:26px;margin-bottom:6px}
.cd-text{font-size:12px;font-weight:700;color:rgba(255,255,255,.5)}
.cd-sub{font-size:10px;color:rgba(255,255,255,.25);margin-top:3px}
.crq-chip{
  display:none;margin-top:10px;padding:7px 14px;
  background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);
  border-radius:var(--radius);font-size:11px;color:#10b981;font-weight:600;
}

/* Answer Key toggle */
.ak-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 14px;border-radius:var(--radius);
  border:1.5px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.03);cursor:pointer;
}
.ak-info .ak-title{font-size:12px;font-weight:700;color:rgba(255,255,255,.65)}
.ak-info .ak-sub{font-size:10px;color:rgba(255,255,255,.3);margin-top:2px}
.toggle{width:36px;height:20px;border-radius:10px;background:rgba(255,255,255,.1);position:relative;transition:background .2s;flex-shrink:0}
.toggle.on{background:var(--green)}
.toggle::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.toggle.on::after{transform:translateX(16px)}

/* Topic field */
.topic-inp{
  width:100%;padding:11px 14px;border-radius:var(--radius);
  border:1.5px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.05);color:#fff;
  font-size:13px;font-weight:500;outline:none;
  font-family:'Inter';transition:all .18s;
}
.topic-inp:focus{border-color:var(--gold);background:rgba(200,150,12,.06)}
.topic-inp::placeholder{color:rgba(255,255,255,.25)}

/* CRQ Button */
.crq-btn{
  width:100%;padding:13px;border-radius:var(--radius);
  background:linear-gradient(135deg,var(--gold),var(--gold-light));
  color:var(--navy-dark);font-size:13px;font-weight:800;
  border:none;font-family:'Inter';
  box-shadow:0 4px 16px rgba(200,150,12,.3);
  transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;
}
.crq-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(200,150,12,.4)}
.crq-btn:disabled{background:rgba(255,255,255,.1);color:rgba(255,255,255,.3);box-shadow:none;transform:none;cursor:not-allowed}

.crq-divider{height:1px;background:rgba(255,255,255,.07);margin:18px 0}

/* TABS */
.tab-bar{
  display:flex;gap:2px;padding:4px;
  background:var(--gray-100);border-radius:var(--radius);
  border:1px solid var(--gray-200);margin-bottom:14px;
  overflow-x:auto;
}
.tab-bar::-webkit-scrollbar{height:0}
.tab-btn{
  padding:7px 16px;border-radius:8px;
  font-size:11px;font-weight:700;color:var(--gray-400);
  white-space:nowrap;flex-shrink:0;transition:all .15s;
  display:flex;align-items:center;gap:5px;
}
.tab-btn:hover{color:var(--gray-800);background:var(--white)}
.tab-btn.active{color:var(--navy);background:var(--white);box-shadow:var(--shadow-sm)}

.doc-panel{display:none}
.doc-panel.active{display:block}
.doc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.doc-tile{
  padding:14px 10px;text-align:center;cursor:pointer;
  border:1.5px solid var(--gray-200);border-radius:var(--radius);
  background:var(--gray-50);transition:all .2s;position:relative;overflow:hidden;
}
.doc-tile::after{
  content:'';position:absolute;bottom:0;left:0;right:0;
  height:2px;background:linear-gradient(90deg,var(--navy),var(--gold));
  transform:scaleX(0);transition:transform .25s;transform-origin:left;
}
.doc-tile:hover{border-color:var(--navy);transform:translateY(-3px);box-shadow:var(--shadow)}
.doc-tile:hover::after{transform:scaleX(1)}
.doc-tile.active{
  border-color:var(--gold);background:var(--gold-bg);
  transform:translateY(-3px);box-shadow:var(--shadow);
}
.doc-tile.active::after{transform:scaleX(1)}
.dt-ico{font-size:22px;display:block;margin-bottom:7px;line-height:1}
.dt-name{font-size:11px;font-weight:700;color:var(--gray-800);display:block}
.dt-sub{font-size:9px;color:var(--gray-400);display:block;margin-top:3px}
.doc-tile.active .dt-name{color:var(--navy)}

/* UPLOAD */
.upload-zone{
  border:1.5px dashed var(--gray-300);border-radius:var(--radius);
  padding:22px;text-align:center;cursor:pointer;
  background:var(--gray-50);transition:all .2s;
}
.upload-zone:hover,.upload-zone.over{border-color:var(--green);background:var(--green-bg)}
.uz-ico{font-size:28px;margin-bottom:8px}
.uz-title{font-size:13px;font-weight:700;color:var(--gray-800)}
.uz-sub{font-size:11px;color:var(--gray-400);margin-top:4px}
.uz-action{
  display:inline-flex;align-items:center;gap:6px;
  margin-top:12px;padding:7px 18px;border-radius:99px;
  background:var(--navy);color:#fff;font-size:11px;font-weight:700;
  transition:all .18s;
}
.uz-action:hover{background:var(--navy-light);transform:translateY(-1px)}
.f-chip{
  display:none;margin-top:10px;padding:8px 14px;
  background:var(--green-bg);border:1px solid var(--green);
  border-radius:var(--radius);font-size:11px;color:var(--green);font-weight:600;
}
.btn-upload{
  width:100%;padding:11px;margin-top:12px;border-radius:var(--radius);
  background:var(--navy);color:#fff;font-size:13px;font-weight:700;
  box-shadow:var(--shadow-sm);transition:all .2s;font-family:'Inter';
}
.btn-upload:hover{background:var(--navy-light);transform:translateY(-1px);box-shadow:var(--shadow)}

/* FORM */
.sel-bar{
  display:flex;align-items:center;justify-content:space-between;
  background:var(--gold-bg);border:1px solid rgba(200,150,12,.2);
  border-radius:var(--radius);padding:10px 14px;margin-bottom:16px;
  border-left:3px solid var(--gold);
}
.sb-left{display:flex;align-items:center;gap:8px}
.sb-pulse{width:7px;height:7px;border-radius:50%;background:var(--gold);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
.sb-doc{font-size:12px;font-weight:700;color:var(--navy)}
.sb-lang{
  font-size:9px;font-weight:800;padding:3px 10px;
  border-radius:99px;background:var(--navy);color:#fff;letter-spacing:.3px;
}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-row.three{grid-template-columns:1fr 1fr 1fr}
.form-row.one{grid-template-columns:1fr}
.fg{display:flex;flex-direction:column;gap:5px}
.fg label{font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.7px}
.fg input,.fg select,.fg textarea{
  padding:10px 12px;border:1.5px solid var(--gray-200);
  border-radius:var(--radius);font-size:13px;font-weight:500;
  color:var(--gray-800);background:var(--gray-50);outline:none;transition:all .18s;
}
.fg input:focus,.fg select:focus,.fg textarea:focus{
  border-color:var(--navy);background:var(--white);
  box-shadow:0 0 0 3px rgba(26,39,68,.08);
}
.fg select{
  appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238898b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;padding-right:36px;
}
.fg textarea{resize:vertical;min-height:68px;line-height:1.5}
.btn-gen{
  width:100%;padding:14px;margin-top:16px;border-radius:var(--radius);
  background:linear-gradient(135deg,var(--navy-dark),var(--navy));
  color:#fff;font-size:14px;font-weight:800;letter-spacing:.2px;
  box-shadow:0 4px 14px rgba(26,39,68,.25);transition:all .2s;font-family:'Inter';
  border:none;border-bottom:3px solid var(--gold);
}
.btn-gen:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(26,39,68,.3)}
.btn-gen:disabled{background:var(--gray-200);box-shadow:none;border-bottom:3px solid var(--gray-300);cursor:not-allowed;transform:none;color:var(--gray-400)}

/* AGE TOOL */
.age-tool{display:none;margin-top:12px}
.age-inner{background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius);padding:16px}

/* LOADER */
.loader-wrap{
  display:none;text-align:center;padding:52px 20px;
  background:var(--white);border-radius:var(--radius-lg);
  border:1px solid var(--gray-200);box-shadow:var(--shadow-sm);
  margin-top:16px;
}
.loader-ring{
  width:48px;height:48px;margin:0 auto 18px;
  border-radius:50%;position:relative;
}
.loader-ring::before,.loader-ring::after{content:'';position:absolute;border-radius:50%}
.loader-ring::before{
  inset:0;border:4px solid var(--gray-100);
  border-top-color:var(--navy);animation:spin .85s linear infinite;
}
.loader-ring::after{
  inset:9px;border:4px solid transparent;
  border-top-color:var(--gold);animation:spin .55s linear infinite reverse;
}
@keyframes spin{to{transform:rotate(360deg)}}
.loader-title{font-size:15px;font-weight:700;color:var(--gray-800)}
.loader-sub{font-size:12px;color:var(--gray-400);margin-top:5px}
.dots{display:inline-flex;gap:5px;margin-top:14px}
.dots span{width:6px;height:6px;border-radius:50%;background:var(--navy);animation:dot 1.4s ease-in-out infinite}
.dots span:nth-child(2){animation-delay:.2s;background:var(--gold)}
.dots span:nth-child(3){animation-delay:.4s;background:var(--green)}
@keyframes dot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}

/* RESULT */
.result-wrap{
  display:none;margin-top:16px;
  background:var(--white);border-radius:var(--radius-lg);
  border:1px solid var(--gray-200);box-shadow:var(--shadow-lg);overflow:hidden;
}
.result-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px;border-bottom:1px solid var(--gray-100);
  background:var(--navy-dark);flex-wrap:wrap;gap:10px;
}
.rh-left{display:flex;align-items:center;gap:10px}
.rh-status{
  display:flex;align-items:center;gap:6px;
  background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.25);
  border-radius:99px;padding:4px 12px;
  font-size:11px;font-weight:700;color:#10b981;
}
.rh-title{font-size:13px;font-weight:700;color:#fff}
.rh-btns{display:flex;gap:8px;flex-wrap:wrap}
.btn-dl{
  padding:8px 14px;border-radius:var(--radius);
  font-size:11px;font-weight:700;font-family:'Inter';
  transition:all .18s;border:none;
}
.btn-docx{background:var(--gold);color:var(--navy-dark);box-shadow:0 2px 8px rgba(200,150,12,.25)}
.btn-docx:hover{background:var(--gold-light);transform:translateY(-1px)}
.btn-pdf{background:#dc2626;color:#fff;box-shadow:0 2px 8px rgba(220,38,38,.2)}
.btn-pdf:hover{background:#b91c1c;transform:translateY(-1px)}
.btn-copy{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.12)}
.btn-copy:hover{background:rgba(255,255,255,.18);color:#fff}
.result-body{
  padding:20px;font-size:12.5px;line-height:2;
  white-space:pre-wrap;max-height:560px;overflow-y:auto;
  color:var(--gray-600);background:var(--white);
  font-family:'Courier New',monospace;
}
.result-foot{
  padding:10px 20px;border-top:1px solid var(--gray-100);
  background:var(--gray-50);text-align:right;
  font-size:10px;color:var(--gray-400);font-style:italic;
}
.result-foot b{color:var(--navy);font-style:normal}

@media(max-width:768px){
  .topbar{padding:0 16px}
  .hero{padding:24px 16px}
  .lang-grid{grid-template-columns:repeat(2,1fr)}
  .doc-grid{grid-template-columns:repeat(2,1fr)}
  .form-row,.form-row.three{grid-template-columns:1fr}
  .rh-btns{flex-wrap:wrap}
  .count-row{grid-template-columns:1fr 1fr 1fr}
  .hero-stats{gap:8px}
}
@media(max-width:480px){
  .lang-grid{grid-template-columns:1fr 1fr}
  .doc-grid{grid-template-columns:1fr 1fr}
}
.fade{animation:fadeUp .3s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>

<header class="topbar">
  <div class="brand">
    <div class="brand-logo">TT</div>
    <div class="brand-name">Teacher <span>Toolkit</span></div>
  </div>
  <div class="topbar-right">
    <div class="dev-badge">by <em>aqkanhar</em></div>
    <button class="theme-toggle" onclick="toggleTheme()" id="themeBtn">🌙</button>
  </div>
</header>

<div class="hero">
  <div class="hero-inner">
    <div class="hero-label">AI Powered &nbsp;·&nbsp; Sindh Curriculum &nbsp;·&nbsp; Professional</div>
    <div class="hero-top">
      <div class="hero-left">
        <h1>Professional School Documents<br><span>Generated in Seconds</span></h1>
        <p class="hero-sub">Lesson plans, CRQ papers, certificates, official letters & more — in English, Urdu, Sindhi & Roman Urdu.</p>
      </div>
    </div>
    <div class="hero-stats">
      <div class="stat-chip"><div><div class="stat-num">25+</div><div class="stat-lbl">Document Types</div></div></div>
      <div class="stat-chip"><div><div class="stat-num">5</div><div class="stat-lbl">Languages</div></div></div>
      <div class="stat-chip"><div><div class="stat-num">1–12</div><div class="stat-lbl">All Classes</div></div></div>
      <div class="stat-chip"><div><div class="stat-num">50MB</div><div class="stat-lbl">Upload Limit</div></div></div>
    </div>
  </div>
</div>

<main class="main">

<div class="card fade">
  <div class="card-head"><div class="ch-indicator"></div><div class="ch-title">Output Language</div></div>
  <div class="card-body">
    <div class="lang-grid">
      <div class="lang-opt" onclick="setLang(this,'english')">
        <div class="lo-radio"><div class="lo-dot"></div></div>
        <div><div class="lo-name">English</div><div class="lo-sub">English only</div></div>
      </div>
      <div class="lang-opt" onclick="setLang(this,'urdu')">
        <div class="lo-radio"><div class="lo-dot"></div></div>
        <div><div class="lo-name">اردو</div><div class="lo-sub">Urdu script only</div></div>
      </div>
      <div class="lang-opt" onclick="setLang(this,'sindhi')">
        <div class="lo-radio"><div class="lo-dot"></div></div>
        <div><div class="lo-name">سنڌي</div><div class="lo-sub">Sindhi script only</div></div>
      </div>
      <div class="lang-opt" onclick="setLang(this,'roman_urdu')">
        <div class="lo-radio"><div class="lo-dot"></div></div>
        <div><div class="lo-name">Roman Urdu</div><div class="lo-sub">Urdu in Latin script</div></div>
      </div>
      <div class="lang-opt active" onclick="setLang(this,'bilingual_en_ur')">
        <div class="lo-radio"><div class="lo-dot"></div></div>
        <div><div class="lo-name">English + Urdu</div><div class="lo-sub">Bilingual — default</div></div>
      </div>
      <div class="lang-opt" onclick="setLang(this,'bilingual_en_sd')">
        <div class="lo-radio"><div class="lo-dot"></div></div>
        <div><div class="lo-name">English + Sindhi</div><div class="lo-sub">Bilingual</div></div>
      </div>
      <div class="lang-opt" onclick="setLang(this,'trilingual')">
        <div class="lo-radio"><div class="lo-dot"></div></div>
        <div><div class="lo-name">Trilingual</div><div class="lo-sub">EN + Urdu + Sindhi</div></div>
      </div>
      <div class="lang-opt" onclick="setLang(this,'en_ur_roman')">
        <div class="lo-radio"><div class="lo-dot"></div></div>
        <div><div class="lo-name">EN + Urdu + Roman</div><div class="lo-sub">Three formats</div></div>
      </div>
    </div>
  </div>
</div>

<div class="crq-wrap fade">
  <div class="crq-head">
    <div class="crq-tag">Premium Feature</div>
    <div class="crq-title">CRQ <em>Paper Generator</em></div>
    <div class="crq-desc">Upload any textbook page or PDF — AI reads the content and generates a complete curriculum-aligned CRQ paper with answer key.</div>
  </div>
  <div class="crq-body">
    <div class="crq-lbl">Upload Source (Optional)</div>
    <div class="crq-drop" id="crqDrop" ondrop="crqDropFn(event)" ondragover="crqOver(event)" ondragleave="crqLeave(event)" onclick="document.getElementById('crqFile').click()">
      <div class="cd-icon">📄</div>
      <div class="cd-text">Drop textbook page, PDF or image here</div>
      <div class="cd-sub">JPG · PNG · PDF · up to 50MB</div>
    </div>
    <input type="file" id="crqFile" accept="image/*,.pdf" style="display:none" onchange="crqFileSel(event)">
    <div class="crq-chip" id="crqChip">✅ &nbsp;<span id="crqFName">-</span></div>
    <div class="crq-divider"></div>
    <div class="crq-lbl">Difficulty Level</div>
    <div class="diff-row">
      <button class="diff-btn d-easy" id="d-easy" onclick="setDiff('easy')">Easy</button>
      <button class="diff-btn" id="d-medium" onclick="setDiff('medium')">Medium</button>
      <button class="diff-btn" id="d-hard" onclick="setDiff('hard')">Hard</button>
    </div>
    <div class="crq-divider"></div>
    <div class="crq-lbl">Bloom's Taxonomy Levels</div>
    <div class="bloom-grid">
      <label class="bloom-item"><input type="checkbox" name="bloom" value="Remember" checked><div class="b-box"></div><div><span class="b-name">Remember</span><span class="b-sub">Recall & recognize</span></div></label>
      <label class="bloom-item"><input type="checkbox" name="bloom" value="Understand" checked><div class="b-box"></div><div><span class="b-name">Understand</span><span class="b-sub">Explain & interpret</span></div></label>
      <label class="bloom-item"><input type="checkbox" name="bloom" value="Apply" checked><div class="b-box"></div><div><span class="b-name">Apply</span><span class="b-sub">Use in new situations</span></div></label>
      <label class="bloom-item"><input type="checkbox" name="bloom" value="Analyze"><div class="b-box"></div><div><span class="b-name">Analyze</span><span class="b-sub">Break down & compare</span></div></label>
      <label class="bloom-item"><input type="checkbox" name="bloom" value="Evaluate"><div class="b-box"></div><div><span class="b-name">Evaluate</span><span class="b-sub">Judge & critique</span></div></label>
      <label class="bloom-item"><input type="checkbox" name="bloom" value="Create"><div class="b-box"></div><div><span class="b-name">Create</span><span class="b-sub">Design & produce</span></div></label>
    </div>
    <div class="crq-divider"></div>
    <div class="crq-lbl">Number of Questions</div>
    <div class="count-row">
      <div class="count-box"><div class="count-lbl">MCQs</div><input type="number" class="count-inp" id="mcqCount" value="10" min="5" max="30"></div>
      <div class="count-box"><div class="count-lbl">Short Qs</div><input type="number" class="count-inp" id="shortCount" value="5" min="2" max="15"></div>
      <div class="count-box"><div class="count-lbl">Long Qs</div><input type="number" class="count-inp" id="longCount" value="2" min="1" max="8"></div>
    </div>
    <div class="crq-divider"></div>
    <div class="ak-row" onclick="toggleAK()">
      <div class="ak-info"><div class="ak-title">Include Answer Key</div><div class="ak-sub">Complete model answers + marking scheme</div></div>
      <div class="toggle" id="akToggle"></div>
    </div>
    <div class="crq-divider"></div>
    <div class="crq-lbl">Topic / Unit Name</div>
    <input type="text" class="topic-inp" id="crqTopic" placeholder="e.g. Family and Friends, Photosynthesis, Fractions...">
    <div style="margin-top:14px">
      <button class="crq-btn" id="crqBtn" onclick="genCRQ()">⚡ Generate CRQ Paper</button>
    </div>
  </div>
</div>

<div class="card fade">
  <div class="card-head"><div class="ch-indicator"></div><div class="ch-title">Document Type</div></div>
  <div class="card-body">
    <div class="tab-bar">
      <button class="tab-btn active" onclick="showPanel('academic',this)">📚 Academic</button>
      <button class="tab-btn" onclick="showPanel('school',this)">🏫 School</button>
      <button class="tab-btn" onclick="showPanel('student',this)">👨‍👩‍👧 Student</button>
      <button class="tab-btn" onclick="showPanel('admin',this)">📋 Admin</button>
      <button class="tab-btn" onclick="showPanel('tools',this)">🔧 Tools</button>
    </div>
    <div class="doc-panel active" id="panel-academic">
      <div class="doc-grid">
        <div class="doc-tile active" onclick="setDoc(this,'Lesson Plan')"><span class="dt-ico">📚</span><span class="dt-name">Lesson Plan</span><span class="dt-sub">PPP + Bloom's</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Worksheet')"><span class="dt-ico">✏️</span><span class="dt-name">Worksheet</span><span class="dt-sub">Printable</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Assessment Rubric')"><span class="dt-ico">📊</span><span class="dt-name">Rubric</span><span class="dt-sub">3-level</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Exam Paper')"><span class="dt-ico">📝</span><span class="dt-name">Exam Paper</span><span class="dt-sub">Mid/Final</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Annual Teaching Plan')"><span class="dt-ico">📅</span><span class="dt-name">Annual Plan</span><span class="dt-sub">ATP</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Monthly Teaching Plan')"><span class="dt-ico">🗓️</span><span class="dt-name">Monthly Plan</span><span class="dt-sub">Schedule</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Progress Report')"><span class="dt-ico">📈</span><span class="dt-name">Progress Report</span><span class="dt-sub">Student</span></div>
        <div class="doc-tile" onclick="setDoc(this,'CRQ Paper')"><span class="dt-ico">🔍</span><span class="dt-name">CRQ Paper</span><span class="dt-sub">Constructed</span></div>
      </div>
    </div>
    <div class="doc-panel" id="panel-school">
      <div class="doc-grid">
        <div class="doc-tile" onclick="setDoc(this,'Character Certificate')"><span class="dt-ico">🏅</span><span class="dt-name">Character Cert</span><span class="dt-sub">Conduct</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Transfer Certificate')"><span class="dt-ico">🔄</span><span class="dt-name">Transfer Cert</span><span class="dt-sub">TC</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Bonafide Certificate')"><span class="dt-ico">📜</span><span class="dt-name">Bonafide Cert</span><span class="dt-sub">Enrollment</span></div>
        <div class="doc-tile" onclick="setDoc(this,'NOC Letter')"><span class="dt-ico">✅</span><span class="dt-name">NOC Letter</span><span class="dt-sub">No Objection</span></div>
        <div class="doc-tile" onclick="setDoc(this,'School Improvement Plan')"><span class="dt-ico">📈</span><span class="dt-name">SIP</span><span class="dt-sub">Improvement Plan</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Prize Certificate')"><span class="dt-ico">🏆</span><span class="dt-name">Prize Cert</span><span class="dt-sub">Achievement</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Experience Certificate')"><span class="dt-ico">🎖️</span><span class="dt-name">Experience Cert</span><span class="dt-sub">Teacher</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Salary Certificate')"><span class="dt-ico">💼</span><span class="dt-name">Salary Cert</span><span class="dt-sub">Proof</span></div>
      </div>
    </div>
    <div class="doc-panel" id="panel-student">
      <div class="doc-grid">
        <div class="doc-tile" onclick="setDoc(this,'Result Card')"><span class="dt-ico">📋</span><span class="dt-name">Result Card</span><span class="dt-sub">Annual</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Attendance Sheet')"><span class="dt-ico">✔️</span><span class="dt-name">Attendance</span><span class="dt-sub">Monthly</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Scholarship Form')"><span class="dt-ico">💰</span><span class="dt-name">Scholarship</span><span class="dt-sub">Wazifa</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Enrollment Form')"><span class="dt-ico">📝</span><span class="dt-name">Enrollment</span><span class="dt-sub">Admission</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Age Calculator Sheet')"><span class="dt-ico">🎂</span><span class="dt-name">Age Calc Sheet</span><span class="dt-sub">Eligibility</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Student Profile')"><span class="dt-ico">👤</span><span class="dt-name">Student Profile</span><span class="dt-sub">Complete</span></div>
      </div>
    </div>
    <div class="doc-panel" id="panel-admin">
      <div class="doc-grid">
        <div class="doc-tile" onclick="setDoc(this,'Leave Application')"><span class="dt-ico">📨</span><span class="dt-name">Leave Application</span><span class="dt-sub">Official</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Parent Complaint Letter')"><span class="dt-ico">👨‍👩‍👧</span><span class="dt-name">Parent Notice</span><span class="dt-sub">Letter</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Meeting Minutes')"><span class="dt-ico">🗒️</span><span class="dt-name">Meeting Minutes</span><span class="dt-sub">SMC/Staff</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Budget Statement')"><span class="dt-ico">💵</span><span class="dt-name">Budget</span><span class="dt-sub">Statement</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Inspection Report')"><span class="dt-ico">🔎</span><span class="dt-name">Inspection Report</span><span class="dt-sub">DEO Visit</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Official Letter')"><span class="dt-ico">✉️</span><span class="dt-name">Official Letter</span><span class="dt-sub">General</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Stock Register')"><span class="dt-ico">📦</span><span class="dt-name">Stock Register</span><span class="dt-sub">Inventory</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Library Register')"><span class="dt-ico">📖</span><span class="dt-name">Library Register</span><span class="dt-sub">Books</span></div>
      </div>
    </div>
    <div class="doc-panel" id="panel-tools">
      <div class="doc-grid">
        <div class="doc-tile" onclick="toggleAgeTool()"><span class="dt-ico">🎂</span><span class="dt-name">Age Calculator</span><span class="dt-sub">Instant check</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Event Banner Content')"><span class="dt-ico">🎉</span><span class="dt-name">Event Content</span><span class="dt-sub">Program</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Affidavit')"><span class="dt-ico">⚖️</span><span class="dt-name">Affidavit</span><span class="dt-sub">Legal</span></div>
        <div class="doc-tile" onclick="setDoc(this,'Complaint Letter')"><span class="dt-ico">📢</span><span class="dt-name">Complaint Letter</span><span class="dt-sub">Official</span></div>
      </div>
      <div class="age-tool" id="age-tool">
        <div class="age-inner">
          <div style="font-size:11px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px">Age Calculator</div>
          <div class="form-row">
            <div class="fg"><label>Date of Birth</label><input type="date" id="dob"></div>
            <div class="fg"><label>Cutoff Date</label><input type="date" id="cutoff" value="2025-04-01"></div>
          </div>
          <button class="btn-gen" style="font-size:12px;padding:11px;margin-top:12px" onclick="calcAge()">Calculate Age</button>
          <div id="age-result" style="margin-top:12px"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="card fade">
  <div class="card-head"><div class="ch-indicator"></div><div class="ch-title">Upload Book Page / PDF</div></div>
  <div class="card-body">
    <div class="upload-zone" id="dropZone" ondrop="handleDrop(event)" ondragover="handleOver(event)" ondragleave="handleLeave(event)" onclick="document.getElementById('fileIn').click()">
      <div class="uz-ico">📸</div>
      <div class="uz-title">Drop textbook page or PDF here</div>
      <div class="uz-sub">Supported: JPG, PNG, PDF &nbsp;·&nbsp; Max: 50MB</div>
      <button class="uz-action" onclick="event.stopPropagation();document.getElementById('fileIn').click()">Browse File</button>
    </div>
    <input type="file" id="fileIn" accept="image/*,.pdf" style="display:none" onchange="onFileSel(event)">
    <div class="f-chip" id="fChip">✅ &nbsp;<span id="fName">-</span></div>
    <button class="btn-upload" onclick="uploadGen()">Upload & Generate Document</button>
  </div>
</div>

<div class="card fade">
  <div class="card-head"><div class="ch-indicator"></div><div class="ch-title">Document Details</div></div>
  <div class="card-body">
    <div class="sel-bar">
      <div class="sb-left"><div class="sb-pulse"></div><span class="sb-doc" id="sb-doc">Lesson Plan</span></div>
      <span class="sb-lang" id="sb-lang">English + Urdu</span>
    </div>
    <div class="form-row">
      <div class="fg"><label>School Name</label><input type="text" id="schoolName" value="GBPS Pir Bhirkio"></div>
      <div class="fg"><label>Teacher Name</label><input type="text" id="teacherName" value="Abdul Qadeer Khan"></div>
    </div>
    <div class="form-row three" style="margin-top:12px">
      <div class="fg">
        <label>Class</label>
        <select id="className">
          <optgroup label="Primary"><option>Class 1</option><option>Class 2</option><option>Class 3</option><option>Class 4</option><option>Class 5</option></optgroup>
          <optgroup label="Middle"><option>Class 6</option><option>Class 7</option><option>Class 8</option></optgroup>
          <optgroup label="Secondary"><option>Class 9</option><option>Class 10 (SSC)</option></optgroup>
          <optgroup label="Higher Secondary"><option>Class 11 (HSC-I)</option><option>Class 12 (HSC-II)</option></optgroup>
        </select>
      </div>
      <div class="fg">
        <label>Subject</label>
        <select id="subject">
          <optgroup label="Languages"><option>English</option><option>Urdu</option><option>Sindhi</option></optgroup>
          <optgroup label="Core"><option>Mathematics</option><option>General Science</option><option>General Knowledge</option></optgroup>
          <optgroup label="Islamic & Social"><option>Islamiyat</option><option>Social Studies</option><option>Pakistan Studies</option></optgroup>
          <optgroup label="Secondary"><option>Physics</option><option>Chemistry</option><option>Biology</option><option>Computer Science</option></optgroup>
        </select>
      </div>
      <div class="fg">
        <label>Unit No.</label>
        <select id="unitNumber"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option></select>
      </div>
    </div>
    <div class="form-row one" style="margin-top:12px">
      <div class="fg"><label>Unit / Topic Name</label><input type="text" id="unitName" placeholder="e.g. Family and Friends, Quadratic Equations..."></div>
    </div>
    <div class="form-row one" style="margin-top:12px">
      <div class="fg"><label>Extra Details (Optional)</label><textarea id="extraData" placeholder="Letter subject, student name, specific requirements..."></textarea></div>
    </div>
    <button class="btn-gen" id="genBtn" onclick="generateDoc()">Generate Document</button>
  </div>
</div>

<div class="loader-wrap" id="loader">
  <div class="loader-ring"></div>
  <div class="loader-title">Generating Document...</div>
  <div class="loader-sub">AI is crafting your professional document</div>
  <div class="dots"><span></span><span></span><span></span></div>
</div>

<div class="result-wrap" id="resultWrap">
  <div class="result-head">
    <div class="rh-left">
      <div class="rh-status">✓ Ready</div>
      <div class="rh-title" id="rhTitle">Document Generated</div>
    </div>
    <div class="rh-btns">
      <button class="btn-dl btn-docx" onclick="dlDocx()">Download .docx</button>
      <button class="btn-dl btn-pdf" onclick="dlPdf()">Download PDF</button>
      <button class="btn-dl btn-copy" onclick="copyTxt()">Copy Text</button>
    </div>
  </div>
  <div class="result-body" id="resultBody"></div>
  <div class="result-foot">generated by <b>aqkanhar</b> &nbsp;·&nbsp; teacher toolkit &nbsp;·&nbsp; powered by claude ai</div>
</div>

</main>

<script>
const S={doc:'Lesson Plan',lang:'bilingual_en_ur',content:'',file:null,crqFile:null,diff:'easy',ak:false};
const langLabels={english:'English',urdu:'اردو',sindhi:'سنڌي',roman_urdu:'Roman Urdu',bilingual_en_ur:'English + Urdu',bilingual_en_sd:'English + Sindhi',trilingual:'Trilingual',en_ur_roman:'EN + Urdu + Roman'};

function toggleTheme(){const h=document.documentElement,d=h.dataset.theme==='dark';h.dataset.theme=d?'light':'dark';document.getElementById('themeBtn').textContent=d?'🌙':'☀️';}
function setLang(el,l){document.querySelectorAll('.lang-opt').forEach(o=>o.classList.remove('active'));el.classList.add('active');S.lang=l;document.getElementById('sb-lang').textContent=langLabels[l];}
function showPanel(id,el){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.doc-panel').forEach(p=>p.classList.remove('active'));el.classList.add('active');document.getElementById('panel-'+id).classList.add('active');document.getElementById('age-tool').style.display='none';}
function setDoc(el,d){document.querySelectorAll('.doc-tile').forEach(t=>t.classList.remove('active'));el.classList.add('active');S.doc=d;document.getElementById('sb-doc').textContent=d;}
function toggleAgeTool(){const t=document.getElementById('age-tool');const v=t.style.display==='block';t.style.display=v?'none':'block';if(!v)setTimeout(()=>t.scrollIntoView({behavior:'smooth',block:'nearest'}),100);}
function calcAge(){const dv=document.getElementById('dob').value,cv=document.getElementById('cutoff').value;if(!dv){alert('Date of Birth enter karein!');return;}const d=new Date(dv),c=new Date(cv);let y=c.getFullYear()-d.getFullYear(),m=c.getMonth()-d.getMonth(),dd=c.getDate()-d.getDate();if(dd<0){m--;dd+=30;}if(m<0){y--;m+=12;}const ok=(y*12+m)>=60&&(y*12+m)<=96;document.getElementById('age-result').innerHTML=\`<div style="background:\${ok?'var(--green-bg)':'var(--red-bg)'};border:1px solid \${ok?'var(--green)':'var(--red)'};border-radius:var(--radius);padding:14px;text-align:center;margin-top:4px"><div style="font-size:20px;font-weight:800;color:\${ok?'var(--green)':'var(--red)'};">\${y} yrs \${m} mo \${dd} days</div><div style="font-size:12px;font-weight:700;margin-top:6px;color:\${ok?'var(--green)':'var(--red)'};">\${ok?'✅ ELIGIBLE for Class 1':'❌ NOT ELIGIBLE (5–8 years required)'}</div></div>\`;}
function setDiff(d){S.diff=d;['easy','medium','hard'].forEach(x=>{const b=document.getElementById('d-'+x);b.className='diff-btn'+(d===x?' d-'+x:'');});}
function toggleAK(){S.ak=!S.ak;document.getElementById('akToggle').classList.toggle('on',S.ak);}
function crqFileSel(e){if(e.target.files[0])setCrqFile(e.target.files[0]);}
function crqDropFn(e){e.preventDefault();document.getElementById('crqDrop').classList.remove('over');if(e.dataTransfer.files[0])setCrqFile(e.dataTransfer.files[0]);}
function crqOver(e){e.preventDefault();document.getElementById('crqDrop').classList.add('over');}
function crqLeave(){document.getElementById('crqDrop').classList.remove('over');}
function setCrqFile(f){S.crqFile=f;document.getElementById('crqFName').textContent=f.name+' ('+(f.size/1024).toFixed(1)+' KB)';document.getElementById('crqChip').style.display='block';}
async function genCRQ(){const t=document.getElementById('crqTopic').value;if(!t){alert('Topic/Unit name zaroor bharein!');return;}const bl=[...document.querySelectorAll('input[name="bloom"]:checked')].map(c=>c.value);if(!bl.length){alert('Kam az kam ek Bloom level select karein!');return;}document.getElementById('crqBtn').disabled=true;showLoader('Generating CRQ Paper...');const fd=new FormData();fd.append('schoolName',document.getElementById('schoolName').value);fd.append('teacherName',document.getElementById('teacherName').value);fd.append('className',document.getElementById('className').value);fd.append('subject',document.getElementById('subject').value);fd.append('unitName',t);fd.append('difficulty',S.diff);fd.append('bloomLevels',JSON.stringify(bl));fd.append('mcqCount',document.getElementById('mcqCount').value);fd.append('shortCount',document.getElementById('shortCount').value);fd.append('longCount',document.getElementById('longCount').value);fd.append('includeAnswerKey',String(S.ak));fd.append('language',S.lang);if(S.crqFile)fd.append('file',S.crqFile);try{const r=await fetch('/generate-crq',{method:'POST',body:fd});const d=await r.json();document.getElementById('crqBtn').disabled=false;if(d.success){S.doc='CRQ Paper';showResult(d.content,'CRQ Paper — '+t);}else{hideLoader();alert('Error: '+d.error);}}catch(e){document.getElementById('crqBtn').disabled=false;hideLoader();alert('Server error!');}}
function handleDrop(e){e.preventDefault();document.getElementById('dropZone').classList.remove('over');if(e.dataTransfer.files[0])setFile(e.dataTransfer.files[0]);}
function handleOver(e){e.preventDefault();document.getElementById('dropZone').classList.add('over');}
function handleLeave(){document.getElementById('dropZone').classList.remove('over');}
function onFileSel(e){if(e.target.files[0])setFile(e.target.files[0]);}
function setFile(f){S.file=f;document.getElementById('fName').textContent=f.name+' ('+(f.size/1024).toFixed(1)+' KB)';document.getElementById('fChip').style.display='block';}
async function uploadGen(){if(!S.file){alert('Pehle file select karein!');return;}if(!document.getElementById('unitName').value){alert('Unit/Topic name zaroor bharein!');return;}showLoader();const fd=new FormData();fd.append('file',S.file);fd.append('documentType',S.doc);fd.append('schoolName',document.getElementById('schoolName').value);fd.append('teacherName',document.getElementById('teacherName').value);fd.append('className',document.getElementById('className').value);fd.append('subject',document.getElementById('subject').value);fd.append('language',S.lang);try{const r=await fetch('/upload-generate',{method:'POST',body:fd});const d=await r.json();d.success?showResult(d.content,S.doc):(hideLoader(),alert('Error: '+d.error));}catch(e){hideLoader();alert('Upload failed!');}}
async function generateDoc(){if(!document.getElementById('unitName').value){alert('Unit/Topic Name zaroor bharein!');return;}showLoader();try{const r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schoolName:document.getElementById('schoolName').value,teacherName:document.getElementById('teacherName').value,className:document.getElementById('className').value,subject:document.getElementById('subject').value,unitNumber:document.getElementById('unitNumber').value,unitName:document.getElementById('unitName').value,documentType:S.doc,extraData:document.getElementById('extraData').value,language:S.lang})});const d=await r.json();d.success?showResult(d.content,S.doc):(hideLoader(),alert('Error: '+d.error));}catch(e){hideLoader();alert('Server error!');}}
function showLoader(msg){document.getElementById('genBtn').disabled=true;document.getElementById('loader').style.display='block';document.getElementById('resultWrap').style.display='none';if(msg)document.querySelector('.loader-title').textContent=msg;document.getElementById('loader').scrollIntoView({behavior:'smooth',block:'center'});}
function hideLoader(){document.getElementById('genBtn').disabled=false;document.getElementById('loader').style.display='none';}
function showResult(c,t){S.content=c;hideLoader();const w=document.getElementById('resultWrap');w.style.display='block';document.getElementById('resultBody').textContent=c;document.getElementById('rhTitle').textContent=(t||S.doc)+' — Ready';w.scrollIntoView({behavior:'smooth',block:'start'});}
async function dlDocx(){const fn=S.doc.replace(/ /g,'_')+'_'+document.getElementById('className').value.replace(/ /g,'')+'_U'+document.getElementById('unitNumber').value;try{const r=await fetch('/download-docx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:S.content,fileName:fn,language:S.lang})});const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fn+'.docx';a.click();URL.revokeObjectURL(url);}catch(e){alert('Download error!');}}
async function dlPdf(){const fn=S.doc.replace(/ /g,'_')+'_'+document.getElementById('className').value.replace(/ /g,'')+'_U'+document.getElementById('unitNumber').value;try{const r=await fetch('/download-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:S.content,fileName:fn})});const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fn+'.pdf';a.click();URL.revokeObjectURL(url);}catch(e){alert('PDF error!');}}
function copyTxt(){navigator.clipboard.writeText(S.content).then(()=>alert('Copied!'));}
</script>
</body>
</html>`;

fs.writeFileSync('public/index.html', html);
console.log('✅ index.html written successfully! Size: ' + html.length + ' chars');

import fs from 'fs';
import { NC_SECTIONS } from '../../js/newcomer-content.js';

/* the exact escaper the app uses (js/ui.js:932) */
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const SAFE = /^(https:\/\/|tel:\+|mailto:)/;
const inline = s => esc(s)
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) =>
    SAFE.test(url)
      ? `<a class="nc-a" href="${url}"${url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''} dir="ltr">${txt}</a>`
      : txt)
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/`([^`]+)`/g, '<span class="ltr">$1</span>')
  .replace(/\n/g, '<br>');

let LANG = 'ar';
const T = {
  ar: { lab:'📍 اعرف الآن — بلا أن تخرج من البرنامج', ph:'اكتب عنوان البيت…', go:'افحص',
        note:'العنوان يذهب إلى خريطة FEMA الرسميّة لجلب الجواب — ولا يُخزَّن.' },
  en: { lab:'📍 Find out now — without leaving the app', ph:'Type the address of the house…', go:'Check',
        note:'The address goes to the official FEMA map to fetch the answer — and it is not stored.' },
};
const TOOLS = { flood: () => { const t = T[LANG]; return `<div class="nc-tool"><b>${esc(t.lab)}</b>
  <div class="nc-field"><input type="text" placeholder="${esc(t.ph)}" dir="ltr"><button>${esc(t.go)}</button></div>
  <p class="nc-do">${esc(t.note)}</p></div>`; } };

const blockHtml = b => {
  switch (b[0]) {
    case 'p': return `<p>${inline(b[1])}</p>`;
    case 'h': return `<h4 class="nc-h">${inline(b[1])}</h4>`;
    case 'warn': return `<div class="nc-warn">${inline(b[1])}</div>`;
    case 'alert': return `<div class="nc-alert">${inline(b[1])}</div>`;
    case 'do': return `<p class="nc-do">${inline(b[1])}</p>`;
    case 'tool': return TOOLS[b[1]] ? TOOLS[b[1]]() : `<p>${inline(b[2]||'')}</p>`;
    case 'ul': return `<ul class="nc-ul">${b.slice(1).map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`;
    case 'rows': return `<div class="nc-rows">${b.slice(1)
      .map(r=>`<div><span>${inline(r[0])}</span><span>${inline(r[1])}</span></div>`).join('')}</div>`;
    default: return '';
  }
};

const AD = cat => `<div class="slot"><p class="slot-lab">إعلان — نشاط مشترك في القسم</p>
  <a class="biz" href="#"><span class="av">◆</span><span class="in">
  <span class="nm">نشاط من فئة ${esc(cat)}<span class="pill">مشترك</span></span>
  <span class="meta">يُختار لحظة العرض — لا يُكتب في النصّ</span></span></a>
  <a class="allcat" href="#">كلّ ${esc(cat)} في الدليل &#8592;</a></div>`;

const page = lang => (LANG = lang, NC_SECTIONS).map((s,i) => `
<section class="nc-sec" dir="${lang==='ar'?'rtl':'ltr'}">
  <h3><span class="num">${i+1}</span>${esc(s[lang].t)}</h3>
  ${s[lang].b.map(blockHtml).join('\n  ')}
  ${AD(s.cat)}
  <button class="rep">${lang==='ar'?'إبلاغ عن هذا القسم':'Report this section'}</button>
</section>`).join('\n');

const html = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>دليل الواصل — فحص الراسم</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
<style>
:root{--page:#0E1829;--bar:#131F39;--surface:#1C2A50;--text:#F3F1EC;--muted:#8B93AC;
--gold:#C6A15B;--gold-bright:#E4C77E;--line:rgba(198,161,91,.16);
--green-bg:rgba(78,139,107,.16);--green-line:rgba(78,139,107,.45);--green:#8FD0AE;
--danger:#E79A9C;--danger-bg:rgba(196,89,92,.12);--danger-line:rgba(196,89,92,.45);}
*{box-sizing:border-box}
html{font-size:106.25%}
body{margin:0;background:var(--page);color:var(--text);direction:rtl;line-height:1.8;font-size:.94rem;
font-family:'IBM Plex Sans Arabic',system-ui,sans-serif}
.wrap{max-width:33rem;margin:0 auto;padding:1rem}
.bar{position:sticky;top:0;background:var(--bar);border-bottom:1px solid var(--line);
padding:.7rem 1rem;display:flex;gap:.6rem;align-items:center;z-index:5}
.bar b{color:var(--gold-bright)}
button{font:inherit;cursor:pointer;background:var(--surface);color:var(--text);
border:1px solid var(--line);border-radius:9px;padding:.35rem .7rem}
.nc-sec{background:var(--surface);border:1px solid var(--line);border-radius:14px;
padding:1rem;margin-bottom:1rem}
.nc-sec h3{margin:.1rem 0 .8rem;color:var(--gold-bright);font-size:1.05rem;display:flex;gap:.5rem;align-items:center}
.num{background:var(--gold);color:#1a1206;border-radius:50%;width:1.6rem;height:1.6rem;
display:grid;place-items:center;font-size:.8rem;font-weight:700;flex:none}
.nc-h{margin:1rem 0 .4rem;color:var(--gold);font-size:.92rem}
.nc-ul{margin:.3rem 0;padding-inline-start:1.1rem}
.nc-ul li{margin:.25rem 0}
.nc-rows>div{display:flex;gap:.6rem;justify-content:space-between;padding:.4rem 0;
border-bottom:1px solid var(--line)}
.nc-rows span:first-child{color:var(--muted);flex:none;max-width:45%}
.nc-warn{background:var(--green-bg);border:1px solid var(--green-line);border-radius:10px;
padding:.6rem .8rem;margin:.6rem 0}
.nc-alert{background:var(--danger-bg);border:1px solid var(--danger-line);border-radius:10px;
padding:.6rem .8rem;margin:.6rem 0}
.nc-a{color:var(--gold-bright)}
.nc-do{margin:-.15rem 0 .6rem;color:var(--muted);font-size:.82rem;
padding-inline-start:.7rem;border-inline-start:2px solid var(--line)}
.nc-tool{background:rgba(198,161,91,.07);border:1px solid var(--line);border-radius:12px;
padding:.8rem;margin:.7rem 0}
.nc-tool b{display:block;color:var(--gold);font-size:.86rem;margin-bottom:.5rem}
.nc-tool .nc-do{margin:.55rem 0 0;border:0;padding:0;font-size:.76rem}
.nc-field{display:flex;gap:.5rem}
.nc-field input{flex:1;min-width:0;font:inherit;font-size:.88rem;background:var(--page);
color:var(--text);border:1px solid var(--line);border-radius:9px;padding:.45rem .6rem}
.ltr{unicode-bidi:isolate;direction:ltr;display:inline-block}
.slot{margin-top:1rem;border-top:1px dashed var(--line);padding-top:.7rem}
.slot-lab{color:var(--muted);font-size:.7rem;margin:0 0 .4rem}
.biz{display:flex;gap:.6rem;align-items:center;background:rgba(198,161,91,.08);
border:1px solid var(--line);border-radius:11px;padding:.5rem;text-decoration:none;color:inherit}
.av{width:2.2rem;height:2.2rem;border-radius:9px;background:var(--gold);color:#1a1206;
display:grid;place-items:center;flex:none}
.nm{font-weight:600;display:block}
.pill{background:var(--gold);color:#1a1206;border-radius:99px;padding:.05rem .45rem;
font-size:.62rem;margin-inline-start:.4rem}
.meta{color:var(--muted);font-size:.72rem}
.allcat{display:block;margin-top:.4rem;color:var(--gold);font-size:.78rem;text-decoration:none}
.rep{margin-top:.7rem;font-size:.72rem;color:var(--muted)}
[dir=ltr] .nc-rows span:first-child{text-align:left}
</style>
<div class="bar"><b>دليل الواصل</b> — فحص الراسم
<span style="flex:1"></span>
<button id="lang">Read in English</button></div>
<div class="wrap" id="ar">${page('ar')}</div>
<div class="wrap" id="en" style="display:none" dir="ltr">${page('en')}</div>
<script>
const b=document.getElementById('lang');
b.onclick=()=>{const ar=document.getElementById('ar'),en=document.getElementById('en');
const toEn=ar.style.display!=='none';
ar.style.display=toEn?'none':'';en.style.display=toEn?'':'none';
b.textContent=toEn?'اقرأ بالعربيّة':'Read in English';};
</script>`;

fs.writeFileSync(new URL('./nc-render.html', import.meta.url), html);
console.log('preview ' + Math.round(html.length/1024) + 'KB');

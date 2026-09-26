// QA audit injected into draft pages; not part of the site.
(() => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}; };
  const lum = ({r,g,b}) => [r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const blend = (fg,bg) => ({r:fg.r*fg.a+bg.r*(1-fg.a), g:fg.g*fg.a+bg.g*(1-fg.a), b:fg.b*fg.a+bg.b*(1-fg.a), a:1});
  function bgOf(el){
    let layers=[], onImage=false;
    for (let n=el; n; n=n.parentElement){
      const cs=getComputedStyle(n), c=parse(cs.backgroundColor);
      if (cs.backgroundImage!=='none' && !cs.backgroundImage.includes('gradient') && n!==document.body) onImage=true;
      if (c && c.a>0){ layers.push(c); if (c.a>=1) break; }
    }
    let bg={r:255,g:255,b:255,a:1};
    for (let i=layers.length-1;i>=0;i--) bg=blend(layers[i],bg);
    return {bg,onImage};
  }
  const vis = el => { const cd=el.closest('details:not([open])'); if (cd && !el.closest('summary')) return false; const r=el.getBoundingClientRect(), cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&parseFloat(cs.opacity)>0; };
  const out={contrast:[],targets:[],overlaps:[],overflow:null};
  // contrast on elements that directly contain text
  const textEls=[...document.querySelectorAll('body *')].filter(el=>vis(el)&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1)&&!el.closest('svg,.draft-flag,[aria-hidden=true]'));
  for (const el of textEls){
    const cs=getComputedStyle(el); let fg=parse(cs.color); if(!fg) continue;
    const {bg,onImage}=bgOf(el); fg=blend(fg,bg);
    const L1=lum(fg),L2=lum(bg), ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
    const size=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight)>=700, large=size>=24||(bold&&size>=18.66);
    const need=large?3:4.5;
    if (ratio<need) out.contrast.push({text:el.textContent.trim().slice(0,40),ratio:+ratio.toFixed(2),need,size,onImage});
  }
  // tap targets
  for (const el of document.querySelectorAll('a,button,summary,input,textarea')){
    if(!vis(el)||el.closest('.draft-flag')) continue; const r=el.getBoundingClientRect();
    if (r.height<24||r.width<24) out.targets.push({el:(el.innerText||el.getAttribute('aria-label')||el.tagName).trim().slice(0,30),w:Math.round(r.width),h:Math.round(r.height)});
  }
  // overlapping text blocks (leaf text elements in the same section)
  const leaves=textEls.filter(el=>!el.closest('.track,.ribbon,.word')&&getComputedStyle(el).position!=='fixed');
  const rects=leaves.map(el=>({el,r:el.getBoundingClientRect()}));
  for (let i=0;i<rects.length;i++) for (let j=i+1;j<rects.length;j++){
    const a=rects[i],b=rects[j]; if (a.el.contains(b.el)||b.el.contains(a.el)) continue;
    const ix=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left), iy=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);
    if (ix>4&&iy>4) out.overlaps.push([a.el.textContent.trim().slice(0,25),b.el.textContent.trim().slice(0,25),Math.round(ix)+'x'+Math.round(iy)]);
  }
  out.overflow=document.documentElement.scrollWidth-innerWidth;
  out.brokenImgs=[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src'));
  out.fontOk=document.fonts.check('40px Monthoers');
  out.headings=[...document.querySelectorAll('h1,h2,h3')].map(h=>h.tagName);
  out.h1count=document.querySelectorAll('h1').length;
  out.outlineNone=[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch(e){return[]}}).filter(r=>r.style&&r.style.outline==='none').length;
  return out;
})();

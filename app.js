// HAD-039 Fleet Monitor — client logic
const PW_HASH = "acd2a1c41447466b4afb5f780ca7ba9203eaa6ef65eddffe50a325d51633c98a";
let DATA = null;

async function sha256(s){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function checkPw(){
  const v = document.getElementById("pw").value;
  const h = await sha256(v);
  if(h === PW_HASH){ sessionStorage.setItem("fleet_ok","1"); unlock(); }
  else { document.getElementById("err").textContent = "Wrong passphrase"; }
}
function unlock(){
  document.getElementById("gate").style.display="none";
  document.getElementById("app").style.display="block";
  load();
}

function fmtHb(m){ if(m===null||m===undefined) return "&mdash;"; if(m<1) return "<1m"; if(m<60) return Math.round(m)+"m"; return (m/60).toFixed(1)+"h"; }
function fmtAge(h){ if(h===null||h===undefined) return "&mdash;"; if(h<1) return Math.round(h*60)+"m"; if(h<48) return h.toFixed(1)+"h"; return Math.round(h/24)+"d"; }
function crons(a){ if(a.crons_enabled===null||a.crons_enabled===undefined) return "&mdash;"; return a.crons_enabled + (a.crons_total>a.crons_enabled ? " / "+a.crons_total : ""); }
function ageClass(h, warn, bad){ if(h===null||h===undefined) return ""; if(bad!==undefined && h>bad) return "bad"; if(h>warn) return "warn"; return ""; }

async function load(){
  try{
    const r = await fetch("fleet_data.json?t="+Date.now());
    DATA = await r.json();
    document.getElementById("host").textContent = DATA.host || "";
    document.getElementById("updated").textContent = DATA.generated_ist || "—";
    const frozen = DATA.agents.filter(a=>a.frozen);
    const active = DATA.agents.filter(a=>!a.frozen);
    const up = active.filter(a=>a.up).length;
    const frozenCount = frozen.length;
    document.getElementById("sysbar").innerHTML =
      sysItem("Active", up+" up &middot; "+(active.length-up)+" down") +
      (frozenCount ? sysItem("Frozen", frozenCount+" agent"+(frozenCount>1?"s":"")) : "") +
      sysItem("RAM", (DATA.system.ram_total_gb||"?")+" GB") +
      sysItem("Load", DATA.system.load||"—");
    let gridHtml = active.map(card).join("");
    if(frozen.length){
      gridHtml += "<div class='frozen-divider' style='grid-column:1/-1;display:flex;align-items:center;gap:10px;margin:10px 0 4px;'>"
        +"<span style='color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;'>&#10052; Frozen</span>"
        +"<div style='flex:1;height:1px;background:var(--border);'></div></div>";
      gridHtml += frozen.map(frozenCard).join("");
    }
    document.getElementById("grid").innerHTML = gridHtml;
  }catch(e){
    document.getElementById("grid").innerHTML = "<p style='color:var(--muted)'>Could not load fleet_data.json &mdash; "+e+"</p>";
  }
}
function sysItem(l,v){ return "<div class='sysitem'><span class='l'>"+l+"</span><span class='v'>"+v+"</span></div>"; }

function chanChips(chs){
  if(!chs||!chs.length) return "";
  const map={telegram:["tg","Telegram"],whatsapp:["wa","WhatsApp"],discord:["dc","Discord"]};
  return "<div class='chans'>"+chs.map(c=>{const m=map[c]||["","" +c];return "<span class='chan "+m[0]+"'>"+m[1]+"</span>";}).join("")+"</div>";
}

function frozenCard(a){
  const since = a.paused_date ? " &middot; since "+a.paused_date : "";
  const reason = a.frozen_reason ? "<div class='r' style='font-size:11px;color:var(--muted);margin-top:3px;'>" + escapeHtml(a.frozen_reason) + "</div>" : "";
  return "<div class='card' style='opacity:.5;border-color:#30363d;cursor:default;' onclick=\"openDetail('"+a.key+"')\">" +
    "<div class='top'>" +
      "<img class='av' src='avatars/"+a.avatar+".jpg' onerror=\"this.style.visibility='hidden'\">" +
      "<div class='nm'><div class='n'>"+a.name+"</div><div class='r'>Port "+a.port+"</div>"+reason+"</div>" +
      "<span class='badge frozen'>&#10052; Frozen</span>" +
    "</div>" +
  "</div>";
}

function card(a){
  const rssWarn = a.rss_gb && a.rss_gb>1.5 ? "warn" : "";
  return "<div class='card "+(a.up?"":"down")+"' onclick=\"openDetail('"+a.key+"')\">"+
    "<div class='top'>"+
      "<img class='av' src='avatars/"+a.avatar+".jpg' onerror=\"this.style.visibility='hidden'\">"+
      "<div class='nm'><div class='n'>"+a.name+"</div><div class='r'>"+a.role+"</div><div class='p'>Port "+a.port+"</div></div>"+
      "<span class='badge "+(a.up?"up":"down")+"'>"+(a.up?"&#9679; UP":"&#9675; DOWN")+"</span>"+
    "</div>"+
    "<div class='stats'>"+
      stat("RSS", a.rss_gb!==null&&a.rss_gb!==undefined ? a.rss_gb.toFixed(2)+" GB" : "&mdash;", rssWarn)+
      stat("Crons", crons(a), "")+
      stat("Skills", a.skills_count!==null ? a.skills_count : "&mdash;", "")+
      stat("Transcript", fmtAge(a.memory?a.memory.transcript:null), ageClass(a.memory?a.memory.transcript:null,12,24))+
    "</div>"+
    chanChips(a.channels)+
  "</div>";
}
function stat(l,v,cls){ return "<div class='stat'><span class='sl'>"+l+"</span><span class='sv "+cls+"'>"+v+"</span></div>"; }

function fmtCronTime(ts){
  if(!ts) return "never";
  // ts may be seconds or milliseconds
  let ms = ts < 1e12 ? ts*1000 : ts;
  const diff = (Date.now()-ms)/1000;
  if(diff<0) return "scheduled";
  if(diff<60) return Math.round(diff)+"s ago";
  if(diff<3600) return Math.round(diff/60)+"m ago";
  if(diff<86400) return (diff/3600).toFixed(1)+"h ago";
  return Math.round(diff/86400)+"d ago";
}

function tabBtn(id,label,active){ return "<button class='tabbtn"+(active?" active":"")+"' onclick=\"showTab('"+id+"')\">"+label+"</button>"; }

function buildCronsTab(a){
  const cr = a.crons||[];
  const enabledCount = cr.filter(c=>c.enabled).length;
  let rows = cr.map(c=>{
    const st = (c.last_status==="ok"||c.last_status==="success") ? "cok" : (c.last_status?"cerr":"cs");
    const stxt = c.last_status ? (c.last_status+" &middot; "+fmtCronTime(c.last_ts)) : "no runs";
    const mdl = c.model||"&mdash;";
    const mcls = mdl==="(no LLM)"?"mdl-none":(mdl==="(agent default)"?"mdl-def":"mdl-set");
    return "<tr class='"+(c.enabled?"":"coff")+"'>"+
      "<td class='cn'>"+escapeHtml(c.name)+"</td>"+
      "<td class='cmodel "+mcls+"'>"+mdl+"</td>"+
      "<td class='cs'>"+c.sched+"</td>"+
      "<td class='"+st+"'>"+stxt+"</td></tr>";
  }).join("");
  const head = "<tr class='crhead'><td>Cron</td><td>Model</td><td>Frequency</td><td>Last run</td></tr>";
  return cr.length?"<table class='crons'>"+head+rows+"</table>":"<span class='muted'>none</span>";
}

function buildTxTab(lines){
  if(!lines||!lines.length) return "<span class='muted'>no content</span>";
  return "<div class='txbox'>"+lines.map(escapeHtml).join(String.fromCharCode(10))+"</div>";
}

function buildSkillsTab(a){
  const sd = a.skills_detail||[];
  if(!sd.length){
    const sk=a.skills||[];
    return sk.length?"<div class='skilltags'>"+sk.map(s=>"<span class='skilltag'>"+s+"</span>").join("")+"</div>":"<span class='muted'>none</span>";
  }
  const order = (DATA.skill_cat_order&&DATA.skill_cat_order.length)?DATA.skill_cat_order:[];
  const groups = {};
  sd.forEach(s=>{ (groups[s.category]=groups[s.category]||[]).push(s); });
  const cats = order.filter(c=>groups[c]).concat(Object.keys(groups).filter(c=>order.indexOf(c)<0));
  SKILL_INDEX = {};
  let html="";
  cats.forEach(cat=>{
    const items=groups[cat];
    html+="<div class='skcat'><div class='skcat-h'>"+escapeHtml(cat)+" <span class='skcat-n'>("+items.length+")</span></div>";
    items.forEach(s=>{
      const id = "sk_"+(SKILL_SEQ++);
      SKILL_INDEX[id] = s;
      const badge = s.inhouse?"<span class='skbadge'>IN-HOUSE</span>":"<span class='skbadge-sp'></span>";
      const desc = s.desc?escapeHtml(s.desc):"—";
      html+="<div class='skrow' onclick=\"toggleSkill('"+id+"',this)\">"
        + "<span class='skname'>"+escapeHtml(s.name)+"</span>"
        + badge
        + "<span class='skdesc"+(s.desc?"":" muted")+"'>"+desc+"</span>"
        + "<span class='skchev'>\u203a</span>"
        + "</div>";
    });
    html+="</div>";
  });
  return html;
}

function toggleSkill(id, rowEl){
  const s = SKILL_INDEX[id];
  if(!s) return;
  // close any open panel
  const existing = document.querySelector(".skinfo");
  const wasMine = existing && existing.getAttribute("data-for")===id;
  if(existing){ existing.remove(); document.querySelectorAll(".skrow.open").forEach(r=>r.classList.remove("open")); }
  if(wasMine) return; // toggle off
  rowEl.classList.add("open");
  const panel = document.createElement("div");
  panel.className = "skinfo";
  panel.setAttribute("data-for", id);
  let h = "<div class='skinfo-h'>"+escapeHtml(s.name)+(s.inhouse?" <span class='skbadge'>IN-HOUSE</span>":"")+"</div>";
  h += "<div class='skinfo-meta'>Category: "+escapeHtml(s.category)+" &middot; dir: <code>"+escapeHtml(s.dir)+"</code></div>";
  h += "<div class='skinfo-sec'><b>What it does</b><div>"+escapeHtml(s.full_desc||s.desc||"No description available.")+"</div></div>";
  if(s.usage){
    h += "<div class='skinfo-sec'><b>How to use</b><pre class='skinfo-pre'>"+escapeHtml(s.usage)+"</pre></div>";
  } else {
    h += "<div class='skinfo-sec'><b>How to use</b><div class='muted'>No quick-start found in SKILL.md \u2014 see the skill file for details.</div></div>";
  }
  panel.innerHTML = h;
  rowEl.parentNode.insertBefore(panel, rowEl.nextSibling);
}

function openDetail(key){
  const a = DATA.agents.find(x=>x.key===key);
  if(!a) return;
  const m = a.memory||{};
  const t = a.transcripts||{};
  const sk = a.skills||[];
  const cr = a.crons||[];
  const enabledCount = cr.filter(c=>c.enabled).length;

  // header
  let head = "<div class='dhead'>"+
    "<img src='avatars/"+a.avatar+".jpg' onerror=\"this.style.visibility='hidden'\">"+
    "<div class='dn'><div class='dname'>"+a.name+" "+(a.up?"<span class='upi'>&#9679; UP</span>":"<span class='downi'>&#9675; DOWN</span>")+"</div>"+
    "<div class='dsub'>"+a.role+" &middot; Port "+a.port+
       (a.pid?" &middot; PID "+a.pid:"")+
       (a.rss_gb!=null?" &middot; RSS "+a.rss_gb.toFixed(2)+" GB":"")+
       (a.cpu!=null?" &middot; CPU "+a.cpu.toFixed(1)+"%":"")+"</div></div>"+
    "<button class='dclose' onclick='closeDetail()'>&#10005; Close</button></div>";

  // PINNED block: channels + memory health (always visible)
  let pinned = "<div class='pinned'>"+
    "<div class='dsh'>Channels Live</div>"+
    (chanChips(a.channels)||"<span class='muted'>none</span>")+
    "<div class='dsh' style='margin-top:14px'>Memory Health (time since last update)</div><div class='mgrid'>"+
    mcell("Transcript", fmtAge(m.transcript), ageClass(m.transcript,12,24))+
    mcell("Rolling 7-day", fmtAge(m.rolling_7day), ageClass(m.rolling_7day,30,48))+
    mcell("Rolling 28-day", fmtAge(m.rolling_28day), ageClass(m.rolling_28day,180,336))+
    mcell("Rolling 180-day", fmtAge(m.rolling_180day), ageClass(m.rolling_180day,720,1440))+
    "</div></div>";

  const skills = buildSkillsTab(a);

  // tab definitions: id, content
  const panelDefs = [
    ["skills", skills],
    ["crons", buildCronsTab(a)],
    ["recent", buildTxTab(t.recent)],
    ["yesterday", buildTxTab(t.yesterday)],
    ["r7", buildTxTab(t.rolling_7day)],
    ["r28", buildTxTab(t.rolling_28day)],
  ];

  // rail: Skills, Crons, then outlined Transcripts group
  let rail = "<div class='tabrail'>"+
    tabBtn("skills","Skills ("+sk.length+")",true)+
    tabBtn("crons","Crons ("+enabledCount+"/"+cr.length+")",false)+
    "<div class='txgroup'><div class='txglabel'>Transcripts</div>"+
      tabBtn("recent","Recent",false)+
      tabBtn("yesterday","Yesterday",false)+
      tabBtn("r7","Rolling 7-day",false)+
      tabBtn("r28","Rolling 28-day",false)+
    "</div>"+
  "</div>";

  let panels = "<div class='tabpanels'>"+panelDefs.map((p,i)=>"<div class='tabpanel"+(i===0?" active":"")+"' id='tab-"+p[0]+"'>"+p[1]+"</div>").join("")+"</div>";

  document.getElementById("dpanel").innerHTML = head + pinned + "<div class='tabwrap'>"+rail+panels+"</div>";
  document.getElementById("detail").style.display = "block";
  window.scrollTo(0,0);
}
function showTab(id){
  document.querySelectorAll(".tabpanel").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".tabbtn").forEach(b=>b.classList.remove("active"));
  const p=document.getElementById("tab-"+id); if(p) p.classList.add("active");
  event.target.classList.add("active");
}
function mcell(l,v,cls){ return "<div class='mcell'><div class='ml'>"+l+"</div><div class='mv "+(cls||"")+"'>"+v+"</div></div>"; }
let SKILL_INDEX={}; let SKILL_SEQ=0;
function escapeHtml(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function closeDetail(){ document.getElementById("detail").style.display="none"; }


document.getElementById("pw").addEventListener("keydown",e=>{if(e.key==="Enter")checkPw();});
document.getElementById("detail").addEventListener("click",e=>{ if(e.target.id==="detail") closeDetail(); });
if(sessionStorage.getItem("fleet_ok")==="1"){ unlock(); }
setInterval(()=>{ if(document.getElementById("app").style.display==="block" && document.getElementById("detail").style.display!=="block") load(); }, 300000);

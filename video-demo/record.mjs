import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "video-demo", "out");
const EVIDENCE = path.join(ROOT, "docs", "evidence", "mainnet-20261108");
const SITE = process.env.SISIH_SITE || "https://sisih-azure.vercel.app";
const API_KEY = process.env.ELEVENLABS_API_KEY || "";
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const SCENES = JSON.parse(fs.readFileSync(path.join(ROOT, "video-demo", "scenes.json"), "utf8")).voice;

fs.mkdirSync(OUT, { recursive: true });
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(EVIDENCE, name), "utf8")); }
function readJsonl(name) { return fs.readFileSync(path.join(EVIDENCE, name), "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line)); }
function getToolResult(name, tool) {
  const found = readJsonl(name).map(e => e.item).filter(Boolean)
    .filter(i => i.type === "mcp_tool_call" && i.tool === tool && i.status === "completed").pop();
  if (!found || !found.result?.content?.[0]?.text) throw new Error("Missing completed evidence: " + name + " / " + tool);
  return JSON.parse(found.result.content[0].text);
}
function assert(ok, message) { if (!ok) throw new Error("Evidence validation failed: " + message); }
function run(cmd, args) { execFileSync(cmd, args, { stdio: "inherit" }); }
function timeSrt(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return String(Math.floor(ms / 3600000)).padStart(2,"0") + ":" +
    String(Math.floor((ms % 3600000) / 60000)).padStart(2,"0") + ":" +
    String(Math.floor((ms % 60000) / 1000)).padStart(2,"0") + "," + String(ms % 1000).padStart(3,"0");
}
function wrap(text, max=48) {
  const lines=[]; let line="";
  for (const word of text.split(/\s+/)) {
    const next=line ? line+" "+word : word;
    if (next.length>max && line) { lines.push(line); line=word; } else line=next;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
function splitSentences(text) { return text.match(/[^.!?]+[.!?]?/g)?.map(x=>x.trim()).filter(Boolean) || [text]; }

async function elevenLabs(text, index) {
  const endpoint = "https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(VOICE_ID) + "?output_format=mp3_44100_128";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.48, similarity_boost: 0.82, style: 0.18, use_speaker_boost: true }
    })
  });
  if (!response.ok) throw new Error("ElevenLabs returned HTTP " + response.status + ". Check the GitHub Actions key and voice ID; no fallback voice will be used.");
  const file = path.join(OUT, "voice-" + String(index+1).padStart(2,"0") + ".mp3");
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  const duration = Number(execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",file], {encoding:"utf8"}).trim());
  return {file,duration};
}

const first = getToolResult("codex-1.jsonl","request_purchase");
const second = getToolResult("codex-2.jsonl","request_purchase");
const third = getToolResult("codex-3.jsonl","request_purchase");
const approve = readJson("owner-approve.json");
const nextSession = readJson("owner-next-session.json");
const simulation = readJson("reserve-simulation.json");
const revoke = readJson("owner-revoke.json");
const finalVault = readJson("final-vault.json");
const memories = readJson("memories.json");

assert(first.outcome==="awaiting_owner_approval" && first.paid===false,"first request held and unpaid");
assert(second.outcome==="settled" && second.paid===true && second.decision_code==="allow_rule","second request settled by remembered rule");
assert(third.outcome==="blocked" && third.paid===false && third.decision_code==="would_cut_reserve","third request blocked");
assert(approve.ok && approve.data.status==="executed","owner approval evidence");
assert(nextSession.data.submitted.status==="executed","fresh application session evidence");
assert(simulation.signed===false && simulation.broadcast===false && simulation.actual_abort==="EExceedsFree","unsigned, unbroadcast reserve simulation");
assert(revoke.ok && revoke.data.status==="executed","owner revoke evidence");
assert(finalVault.verified && finalVault.state.policy===null,"final Mainnet vault and revoked policy");
assert(finalVault.state.total==="1400000" && finalVault.state.reserved==="800000" && finalVault.state.free==="600000","final vault balances");
assert(memories.length===4 && memories.every(m=>m.status==="stored" && !m.error),"four stored Walrus records");

if (!API_KEY || !VOICE_ID) {
  throw new Error("Missing GitHub Actions secret ELEVENLABS_API_KEY or secret/repository variable ELEVENLABS_VOICE_ID. Add them in GitHub Settings > Secrets and variables > Actions. No synthetic fallback voice is used.");
}

const audio=[];
for (let i=0;i<SCENES.length;i++) {
  console.log("ElevenLabs voice generation " + (i+1) + "/" + SCENES.length + ": " + SCENES[i].id);
  audio.push(await elevenLabs(SCENES[i].text,i));
}
const concatFile=path.join(OUT,"audio-concat.txt");
fs.writeFileSync(concatFile,audio.map(x=>"file '"+x.file.replace(/'/g,"'\\''")+"'").join("\n")+"\n");
const voiceover=path.join(OUT,"voiceover-elevenlabs.mp3");
run("ffmpeg",["-y","-f","concat","-safe","0","-i",concatFile,"-c","copy",voiceover]);

let cursor=0, cue=1;
const srt=[];
for (let i=0;i<SCENES.length;i++) {
  const parts=splitSentences(SCENES[i].text);
  const words=parts.reduce((n,p)=>n+p.split(/\s+/).length,0);
  let local=0;
  for (const sentence of parts) {
    const d=audio[i].duration*sentence.split(/\s+/).length/words;
    srt.push(String(cue++)+"\n"+timeSrt(cursor+local)+" --> "+timeSrt(cursor+local+d)+"\n"+wrap(sentence)+"\n");
    local+=d;
  }
  cursor+=audio[i].duration;
}
const subtitleFile=path.join(OUT,"subtitles-en.srt");
fs.writeFileSync(subtitleFile,srt.join("\n"),"utf8");

const terminalScenes={
 "terminal-first":{title:"CODEX CLI · SESSION 1",label:"ARCHIVED MAINNET RUN · 08 NOV 2026",lines:[
  ["$ codex  ·  sisih MCP","cmd"],["> list_services()","muted"],["ChainScope · live Sui vault report · 0.80 USDC","ok"],
  ["> get_budget()","muted"],["Vault total  3.00 USDC    Reserved  0.80    Free  2.20","ok"],
  ["> request_purchase(chainscope, 0.80 USDC)","muted"],["request_id   "+first.request_id,"white"],
  ["outcome      awaiting_owner_approval","warn"],["paid         false","warn"],["No payment made. Owner review required.","warn"]]},
 "terminal-owner":{title:"OWNER CLI · LOCAL SIGNING",label:"ARCHIVED MAINNET RUN · 08 NOV 2026",lines:[
  ["$ pnpm sisih approve "+first.request_id+" --remember","cmd"],["Owner intent  "+approve.data.intent_id,"white"],
  ["Status        "+approve.data.status,"ok"],["Network       Sui Mainnet","ok"],
  ["Remembered    ChainScope data up to 0.80 USDC","ok"],["Owner key     stayed on the owner's machine","muted"],
  ["Release 1     6C3oTgnJYb2TH1jJiRxLR1DE87GVvY1mmfcsX2goJcms","white"],
  ["x402 settle   8JyrP75EGse2BSTE4ty7afEPskptMYt6h3bv8hAjAyXB","white"],["Receipt       verified via Tatum · Sui Mainnet","ok"]]},
 "terminal-memory":{title:"WALRUS MEMORY · FRESH CODEX SESSION",label:"ARCHIVED MAINNET RUN · 08 NOV 2026",lines:[
  ["$ pnpm sisih session next","cmd"],["Session       2 · rules rebuilt from Walrus","ok"],
  ["Rule ID       rule-dfbf7042","white"],["Walrus blob   dAU_UeyCw3_fRAuIEQCFQJuXKE6wnlnIJkkkkmYoJds","white"],
  ["$ codex  ·  new conversation","cmd"],["> request_purchase(chainscope, 0.80 USDC)","muted"],
  ["request_id   "+second.request_id,"white"],["decision     "+second.decision_code,"ok"],
  ["outcome      "+second.outcome+" · paid "+second.paid,"ok"],["Release 2     "+second.settlement.release_digest,"white"],
  ["x402 settle   "+second.settlement.settle_digest,"white"]]},
 "terminal-reserve":{title:"RESERVE PROTECTION · THIRD REQUEST",label:"ARCHIVED MAINNET RUN · 08 NOV 2026",lines:[
  ["$ codex  ·  request another 0.80 USDC report","cmd"],["request_id   "+third.request_id,"white"],
  ["decision     "+third.decision_code,"warn"],["requested    0.80 USDC","white"],["free         0.60 USDC","white"],
  ["reserved     0.80 USDC","white"],["outcome      blocked · paid false","warn"],
  ["$ contract simulation  ·  archived evidence","cmd"],["Move abort   "+simulation.actual_abort,"warn"],
  ["signed       false       broadcast  false","ok"]]}
};

const terminalPath=path.join(OUT,"terminal-replay.html");
const data=JSON.stringify(terminalScenes).replace(/</g,"\\u003c");
const html=[
"<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>",
"<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#07110e;color:#dce9df;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}body{display:flex;align-items:center;justify-content:center;padding:72px}.shell{width:100%;height:100%;border:1px solid #29483a;border-radius:18px;overflow:hidden;background:#091712;box-shadow:0 30px 100px #0008}.top{height:66px;background:#10251b;border-bottom:1px solid #29483a;display:flex;align-items:center;padding:0 28px;gap:12px}.dot{width:12px;height:12px;border-radius:50%;background:#d66b63}.dot:nth-child(2){background:#d7b65e}.dot:nth-child(3){background:#6dc58b}.top span{margin-left:14px;color:#9bb7a3;font-size:17px;letter-spacing:.08em}.content{padding:40px 48px}.title{font-size:26px;color:#e6f1e8;font-weight:700;margin-bottom:10px}.label{font-size:15px;letter-spacing:.15em;color:#d7b65e;margin-bottom:38px}.line{font-size:25px;line-height:1.65;white-space:pre-wrap;opacity:0;transform:translateY(5px);animation:in .25s forwards}.line.cmd{color:#c2e9ce}.line.ok{color:#85d99d}.line.warn{color:#e5bd73}.line.muted{color:#8ba795}.line.white{color:#e5eee7}@keyframes in{to{opacity:1;transform:translateY(0)}}.bottom{position:absolute;bottom:96px;left:120px;color:#648674;font-size:15px;letter-spacing:.12em}</style></head>",
"<body><div class='shell'><div class='top'><i class='dot'></i><i class='dot'></i><i class='dot'></i><span>sisih-mainnet-proof / evidence replay</span></div><div class='content'><div class='title' id='title'></div><div class='label' id='label'></div><div id='lines'></div></div></div><div class='bottom'>SUI MAINNET · HISTORICAL EVIDENCE · NO LIVE TRANSACTION</div>",
"<script>const scenes="+data+";const key=new URLSearchParams(location.search).get('scene')||'terminal-first';const scene=scenes[key]||scenes['terminal-first'];document.getElementById('title').textContent=scene.title;document.getElementById('label').textContent=scene.label;const root=document.getElementById('lines');scene.lines.forEach((entry,index)=>{const row=document.createElement('div');row.className='line '+entry[1];row.textContent=entry[0];row.style.animationDelay=(index*0.42)+'s';root.appendChild(row);});</script></body></html>"
].join("\n");
fs.writeFileSync(terminalPath,html,"utf8");

const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,colorScheme:"light",recordVideo:{dir:OUT,size:{width:1920,height:1080}}});
const page=await context.newPage();
const video=page.video();
async function siteReady(){await page.waitForLoadState("domcontentloaded").catch(()=>{});await page.waitForTimeout(1000);}
async function sceneRun(scene,index){
 const budget=audio[index].duration*1000;const started=Date.now();
 if(scene.page==="home"){
  await page.goto(SITE+"/",{waitUntil:"domcontentloaded",timeout:60000});await siteReady();
  for(const y of [0,520,1080,1650]){await page.evaluate(v=>window.scrollTo({top:v,behavior:"smooth"}),y);await page.waitForTimeout(800);}
  await page.evaluate(()=>window.scrollTo({top:0,behavior:"smooth"}));
 }else if(scene.page==="connect"){
  await page.goto(SITE+"/connect",{waitUntil:"domcontentloaded",timeout:60000});await siteReady();
  for(const y of [0,520,1080,1650,2250]){await page.evaluate(v=>window.scrollTo({top:v,behavior:"smooth"}),y);await page.waitForTimeout(750);}
  await page.evaluate(()=>window.scrollTo({top:0,behavior:"smooth"}));
 }else if(scene.page==="proof"){
  await page.goto(SITE+"/proof",{waitUntil:"domcontentloaded",timeout:60000});await siteReady();
  for(const y of [0,520,1080,1650,2250]){await page.evaluate(v=>window.scrollTo({top:v,behavior:"smooth"}),y);await page.waitForTimeout(750);}
 }else if(scene.page==="closing"){
  await page.goto(SITE+"/proof",{waitUntil:"domcontentloaded",timeout:60000});await siteReady();
  await page.evaluate(()=>window.scrollTo({top:0,behavior:"smooth"}));await page.waitForTimeout(1000);await page.mouse.move(1500,120,{steps:10});
 }else{
  await page.goto(pathToFileURL(terminalPath).href+"?scene="+scene.page,{waitUntil:"load"});
  await page.waitForTimeout(500);
 }
 const elapsed=Date.now()-started;await page.waitForTimeout(Math.max(500,budget-elapsed));
}
try{
 for(let i=0;i<SCENES.length;i++){console.log("Recording scene: "+SCENES[i].id);await sceneRun(SCENES[i],i);}
 await context.close();const webm=await video.path();await browser.close();
 const mp4=path.join(OUT,"SISIH_Mainnet_Product_Walkthrough_Preview.mp4");
 run("ffmpeg",["-y","-i",webm,"-i",voiceover,"-vf","subtitles="+subtitleFile+":force_style='FontName=Liberation Sans,FontSize=24,Outline=2,Shadow=1,MarginV=48'","-map","0:v:0","-map","1:a:0","-c:v","libx264","-preset","veryfast","-crf","19","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart",mp4]);
 const contact=path.join(OUT,"SISIH_Walkthrough_Contact_Sheet.jpg");
 run("ffmpeg",["-y","-i",mp4,"-vf","fps=1/25,scale=640:-1,tile=3x3","-frames:v","1",contact]);
 const pack=path.join(OUT,"SISIH_Walkthrough_Preview_Package.zip");
 run("zip",["-j","-q",pack,mp4,subtitleFile,voiceover,contact]);
 console.log(JSON.stringify({status:"success",video:mp4,subtitles:subtitleFile,voiceover:voiceover,contactSheet:contact,package:pack,voice:"ElevenLabs",networkTransactionsExecuted:0,evidenceValidated:true,bytes:fs.statSync(mp4).size},null,2));
}catch(e){await context.close().catch(()=>{});await browser.close().catch(()=>{});throw e;}

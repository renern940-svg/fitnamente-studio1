import {FFmpegLocal} from "./vendor/ffmpeg-local.js";

const $=id=>document.getElementById(id);
const templateInput=$("templateInput"), videoInput=$("videoInput"), templateImage=$("templateImage");
const stage=$("stage"), videoBox=$("videoBox"), videoList=$("videoList");
const loadBtn=$("loadBtn"), generateBtn=$("generateBtn"), status=$("status"), progressBar=$("progressBar"), results=$("results");
let videos=[], templateFile=null, ffmpeg=null, loaded=false, dragging=false, resizing=false, dragStart=null, boxStart=null;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function setStatus(t,cls=""){status.className="status "+cls;status.textContent=t}
function fmt(n){return (n/1024/1024).toFixed(1)+" MB"}

templateInput.addEventListener("change",()=>{
  templateFile=templateInput.files?.[0]||null;
  if(!templateFile)return;
  templateImage.src=URL.createObjectURL(templateFile);
  templateImage.onload=()=>{templateImage.style.display="block";videoBox.style.display="block";setStatus("Template carregado. Ajuste a área do vídeo.");};
});
videoInput.addEventListener("change",()=>{
  for(const f of videoInput.files||[]) videos.push(f);
  videoInput.value="";
  renderVideos();
  updateGenerate();
});
function renderVideos(){
  videoList.innerHTML="";
  videos.forEach((f,i)=>{
    const row=document.createElement("div");row.className="video-item";
    row.innerHTML=`<span class="name" title="${f.name}">${f.name}</span><span class="size">${fmt(f.size)}</span><button class="remove" title="Remover">×</button>`;
    row.querySelector("button").onclick=()=>{videos.splice(i,1);renderVideos();updateGenerate()};
    videoList.appendChild(row);
  });
}
function updateGenerate(){generateBtn.disabled=!(loaded&&templateFile&&videos.length);generateBtn.classList.toggle("disabled",generateBtn.disabled)}
function boxNorm(){
  const sw=stage.clientWidth,sh=stage.clientHeight;
  return {x:videoBox.offsetLeft/sw,y:videoBox.offsetTop/sh,w:videoBox.offsetWidth/sw,h:videoBox.offsetHeight/sh};
}
function setBox(n){
  const sw=stage.clientWidth,sh=stage.clientHeight;
  const w=clamp(n.w,.05,.98),h=clamp(n.h,.05,.9);
  const x=clamp(n.x,0,1-w),y=clamp(n.y,0,1-h);
  videoBox.style.left=(x*100)+"%";videoBox.style.top=(y*100)+"%";videoBox.style.width=(w*100)+"%";videoBox.style.height=(h*100)+"%";
}
$("centerBtn").onclick=()=>{const n=boxNorm();n.x=(1-n.w)/2;n.y=(1-n.h)/2;setBox(n)};
$("widthBtn").onclick=()=>{const n=boxNorm();n.w=.8;n.x=.1;setBox(n)};

videoBox.addEventListener("pointerdown",e=>{
  e.preventDefault();videoBox.setPointerCapture(e.pointerId);
  const r=stage.getBoundingClientRect(), b=videoBox.getBoundingClientRect();
  const handle=e.clientX>b.right-18&&e.clientY>b.bottom-18;
  dragging=!handle;resizing=handle;
  dragStart={x:e.clientX,y:e.clientY};boxStart=boxNorm();
});
videoBox.addEventListener("pointermove",e=>{
  if(!dragging&&!resizing)return;
  const r=stage.getBoundingClientRect(),dx=(e.clientX-dragStart.x)/r.width,dy=(e.clientY-dragStart.y)/r.height;
  const n={...boxStart};
  if(dragging){n.x+=dx;n.y+=dy}
  if(resizing){n.w+=dx;n.h+=dy}
  setBox(n);
});
videoBox.addEventListener("pointerup",()=>{dragging=false;resizing=false});

async function blobURL(url,type){
  const r=await fetch(url,{mode:"cors"});
  if(!r.ok)throw new Error("HTTP "+r.status+" ao baixar "+url);
  const b=await r.blob();
  return URL.createObjectURL(new Blob([b],{type}));
}
async function firstBlob(urls,type){
  let last;
  for(const u of urls){try{return await blobURL(u,type)}catch(e){last=e}}
  throw last||new Error("Não foi possível baixar o arquivo.");
}

loadBtn.onclick=async()=>{
  if(loaded)return;
  loadBtn.disabled=true;loadBtn.textContent="CARREGANDO...";
  setStatus("Baixando o motor MP4 (~31 MB)...");
  try{
    const coreJS=await firstBlob([
      "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js"
    ],"text/javascript");
    const wasm=await firstBlob([
      "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm",
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm"
    ],"application/wasm");
    ffmpeg=new FFmpegLocal("./vendor/worker.js");
    ffmpeg.on("log",m=>{if(typeof m==="string"&&m) setStatus(m)});
    ffmpeg.on("progress",p=>{if(p?.progress>=0)progressBar.style.width=Math.min(100,p.progress*100)+"%"});
    await ffmpeg.load({coreURL:coreJS,wasmURL:wasm});
    loaded=true;loadBtn.textContent="MOTOR MP4 CARREGADO";setStatus("Motor MP4 carregado com sucesso.","ok");updateGenerate();
  }catch(e){
    console.error(e);loadBtn.disabled=false;loadBtn.textContent="CARREGAR MOTOR MP4";
    setStatus("Falha ao carregar o motor: "+(e?.message||e),"err");
  }
};

function makeTransparentTemplate(){
  return new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>{
      const c=document.createElement("canvas");c.width=1080;c.height=1920;
      const ctx=c.getContext("2d");ctx.drawImage(img,0,0,1080,1920);
      const n=boxNorm(),x=Math.round(n.x*1080),y=Math.round(n.y*1920),w=Math.round(n.w*1080),h=Math.round(n.h*1920);
      ctx.clearRect(x,y,w,h);
      c.toBlob(b=>b?resolve({blob:b,x,y,w,h}):reject(new Error("Falha ao criar template transparente")),"image/png");
    };img.onerror=()=>reject(new Error("Não foi possível ler o template"));img.src=URL.createObjectURL(templateFile);
  });
}
const fetchBytes=async f=>new Uint8Array(await f.arrayBuffer());

generateBtn.onclick=async()=>{
  if(!loaded||!templateFile||!videos.length)return;
  generateBtn.disabled=true;results.innerHTML="";progressBar.style.width="0%";
  try{
    const t=await makeTransparentTemplate();
    await ffmpeg.writeFile("template.png",await fetchBytes(t.blob));
    const n=boxNorm(),W=1080,H=1920;
    const q=$("quality").value;
    for(let i=0;i<videos.length;i++){
      const f=videos[i], input=`input_${i}.mp4`, output=`fitnamente_${String(i+1).padStart(2,"0")}.mp4`;
      setStatus(`Processando ${i+1}/${videos.length}: ${f.name}`);
      await ffmpeg.writeFile(input,await fetchBytes(f));
      const x=Math.round(n.x*W),y=Math.round(n.y*H),w=Math.round(n.w*W),h=Math.round(n.h*H);
      const vf=$("fitMode").value==="cover"
        ? `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},pad=${W}:${H}:${x}:${y}:color=black[bg]`
        : `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,pad=${W}:${H}:${x}:${y}:color=black[bg]`;
      const crf=q==="high"?"18":"23";
      const args=["-i",input,"-i","template.png","-filter_complex",vf+"[bg][1:v]overlay=0:0:format=auto[v]","-map","[v]","-map","0:a?","-c:v","libx264","-preset","veryfast","-crf",crf,"-pix_fmt","yuv420p","-c:a","aac","-b:a","128k","-movflags","+faststart","-r","30","-shortest",output];
      await ffmpeg.exec(args);
      const data=await ffmpeg.readFile(output);
      const blob=new Blob([data.buffer],{type:"video/mp4"});
      const url=URL.createObjectURL(blob);
      const div=document.createElement("div");div.className="result";
      div.innerHTML=`<strong>${f.name}</strong><br><span class="ok">MP4 pronto</span>`;
      const a=document.createElement("a");a.href=url;a.download=output;
      const b=document.createElement("button");b.textContent="BAIXAR MP4";b.onclick=()=>a.click();
      div.appendChild(b);results.appendChild(div);
      progressBar.style.width=((i+1)/videos.length*100)+"%";
      await ffmpeg.deleteFile(input);await ffmpeg.deleteFile(output);
    }
    setStatus("Todos os MP4 foram gerados.","ok");
  }catch(e){
    console.error(e);setStatus("Erro durante a geração: "+(e?.message||e),"err");
  }finally{updateGenerate()}
};

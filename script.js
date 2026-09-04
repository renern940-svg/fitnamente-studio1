const $ = (s) => document.querySelector(s);
const filesInput = $("#files");
const dropzone = $("#dropzone");
const fileList = $("#fileList");
const count = $("#count");
const preview = $("#preview");
const previewName = $("#previewName");
const handle = $("#handle");
const title = $("#title");
const previewHandle = $("#previewHandle");
const previewTitle = $("#previewTitle");
const generate = $("#generate");
const status = $("#status");
const outputs = $("#outputs");
const outputList = $("#outputList");
let files = [];
let activeIndex = 0;
let template = "clean";

function fmt(bytes){
  const u=["B","KB","MB","GB"]; let i=0,n=bytes;
  while(n>=1024&&i<u.length-1){n/=1024;i++}
  return `${n.toFixed(i?1:0)} ${u[i]}`;
}
function renderFiles(){
  count.textContent = `${files.length} ${files.length===1?"vídeo":"vídeos"}`;
  fileList.innerHTML="";
  files.forEach((f,i)=>{
    const row=document.createElement("div"); row.className="file";
    const img=document.createElement("video"); img.className="thumb"; img.muted=true;
    img.src=URL.createObjectURL(f);
    const info=document.createElement("div"); info.className="file-info";
    info.innerHTML=`<div class="file-name">${escapeHtml(f.name)}</div><div class="file-size">${fmt(f.size)}</div>`;
    const btn=document.createElement("button"); btn.className="remove"; btn.textContent="×"; btn.title="Remover";
    btn.onclick=()=>{files.splice(i,1); if(activeIndex>=files.length)activeIndex=Math.max(0,files.length-1); renderFiles(); updatePreview();};
    row.append(img,info,btn); fileList.append(row);
  });
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function addFiles(list){
  const incoming=[...list].filter(f=>f.type.startsWith("video/"));
  files=[...files,...incoming].slice(0,30); renderFiles();
  if(files.length===incoming.length) activeIndex=0;
  updatePreview();
}
function updatePreview(){
  previewHandle.textContent=handle.value||"@fitnamente";
  previewTitle.textContent=title.value||"";
  if(!files.length){preview.removeAttribute("src"); preview.load(); previewName.textContent="Nenhum vídeo"; return;}
  previewName.textContent=files[activeIndex]?.name||"";
  preview.src=URL.createObjectURL(files[activeIndex]); preview.load();
}
filesInput.onchange=e=>addFiles(e.target.files);
["dragenter","dragover"].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",e=>addFiles(e.dataTransfer.files));
handle.oninput=updatePreview; title.oninput=updatePreview;

document.querySelectorAll(".template").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".template").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active"); template=btn.dataset.template;
  };
});

// Export: records the preview video stream plus a canvas overlay.
// This creates a WebM file in Chromium-based browsers without a server.
async function renderVideo(file,index){
  const video=document.createElement("video");
  video.src=URL.createObjectURL(file); video.muted=true; video.playsInline=true;
  await new Promise((res,rej)=>{video.onloadedmetadata=res;video.onerror=rej;});
  const W=1080,H=1920, canvas=document.createElement("canvas");
  canvas.width=W; canvas.height=H; const ctx=canvas.getContext("2d");
  const fit=$("#fit").value;
  const stream=canvas.captureStream(30);
  const audio = video.captureStream ? video.captureStream().getAudioTracks() : [];
  audio.forEach(t=>stream.addTrack(t));
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" :
               MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
  const chunks=[]; rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const ended=new Promise(resolve=>rec.onstop=resolve);
  const draw=()=>{
    if(video.paused||video.ended)return;
    ctx.fillStyle="#111";ctx.fillRect(0,0,W,H);
    const vw=video.videoWidth,vh=video.videoHeight;
    let dw,dh,dx,dy;
    if(fit==="contain"){dh=H*0.78;dw=dh*vw/vh;if(dw>W){dw=W;dh=dw*vh/vw}dx=(W-dw)/2;dy=(H-dh)/2;}
    else{const scale=Math.max(W/vw,H/vh*.78);dw=vw*scale;dh=vh*scale;dx=(W-dw)/2;dy=(H-dh)/2+120;}
    ctx.drawImage(video,dx,dy,dw,dh);
    ctx.fillStyle="rgba(0,0,0,.22)";ctx.fillRect(0,0,W,135);
    ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="900 34px Arial";ctx.fillText("FITNAMENTE",W/2,62);
    const h=handle.value||"@fitnamente";ctx.font="800 28px Arial";ctx.fillText(h,W/2,H-70);
    const t=title.value.trim(); if(t){ctx.font="800 32px Arial";wrapText(ctx,t,W/2,112,940,40);}
    requestAnimationFrame(draw);
  };
  function wrapText(c,text,x,y,maxWidth,lineHeight){
    const words=text.split(" ");let line="";
    for(const word of words){const test=line+word+" ";if(c.measureText(test).width>maxWidth&&line){c.fillText(line,x,y);line=word+" ";y+=lineHeight;}else line=test;}
    c.fillText(line,x,y);
  }
  rec.start(250); await video.play(); draw();
  await new Promise(resolve=>video.onended=resolve);
  rec.stop(); await ended; stream.getTracks().forEach(t=>t.stop());
  URL.revokeObjectURL(video.src);
  return new Blob(chunks,{type:mime});
}
generate.onclick=async()=>{
  if(!files.length){status.textContent="Adicione pelo menos um vídeo.";return;}
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){status.textContent="Seu navegador não suporta a exportação local. Use Chrome/Edge atual.";return;}
  generate.disabled=true; outputList.innerHTML=""; outputs.classList.remove("hidden");
  for(let i=0;i<files.length;i++){
    status.textContent=`Gerando ${i+1} de ${files.length}…`;
    try{
      const blob=await renderVideo(files[i],i);
      const url=URL.createObjectURL(blob);
      const row=document.createElement("div");row.className="output";
      row.innerHTML=`<div class="output-name">${escapeHtml(files[i].name.replace(/\.[^.]+$/,""))}_fitnamente.webm</div>`;
      const a=document.createElement("a");a.className="download";a.href=url;a.download=files[i].name.replace(/\.[^.]+$/,"")+"_fitnamente.webm";a.textContent="Baixar";
      row.append(a);outputList.append(row);
    }catch(err){console.error(err);status.textContent=`Não foi possível gerar "${files[i].name}".`; }
  }
  status.textContent=`Concluído: ${files.length} vídeo(s).`;
  generate.disabled=false;
};
$("#clearOutputs").onclick=()=>{
  outputList.innerHTML="";outputs.classList.add("hidden");status.textContent="";
};
updatePreview();

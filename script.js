const $=s=>document.querySelector(s);
const templateFile=$("#templateFile"), videoFiles=$("#videoFiles"), img=$("#templatePreview"), stage=$("#stage"), box=$("#videoBox"), canvas=$("#canvas"), ctx=canvas.getContext("2d"), list=$("#files");
let videos=[], templateURL=null, dragging=false, resizing=false, sx=0,sy=0,start={};

templateFile.onchange=()=>{const f=templateFile.files[0];if(!f)return;templateURL=URL.createObjectURL(f);img.src=templateURL;img.onload=()=>{drawPreview();}};
videoFiles.onchange=()=>{videos=[...videos,...videoFiles.files].slice(0,50);renderFiles();drawPreview();videoFiles.value=""};
function renderFiles(){list.innerHTML="";videos.forEach((f,i)=>{const d=document.createElement("div");d.className="file";d.innerHTML=`<b>${esc(f.name)}</b><span>${size(f.size)}</span><button>×</button>`;d.querySelector("button").onclick=()=>{videos.splice(i,1);renderFiles();drawPreview()};list.append(d)})}
function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function size(n){let u=["B","KB","MB","GB"],i=0;while(n>1024&&i<3){n/=1024;i++}return n.toFixed(i?1:0)+" "+u[i]}
function pos(e){const r=stage.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
box.addEventListener("pointerdown",e=>{const p=pos(e),r=box.getBoundingClientRect(),sr=stage.getBoundingClientRect();resizing=(p.x>(r.right-sr.left-28)&&p.y>(r.bottom-sr.top-28));dragging=!resizing;sx=p.x;sy=p.y;start={left:box.offsetLeft,top:box.offsetTop,width:box.offsetWidth,height:box.offsetHeight};box.setPointerCapture(e.pointerId);e.preventDefault()});
box.addEventListener("pointermove",e=>{if(!dragging&&!resizing)return;const p=pos(e),dx=p.x-sx,dy=p.y-sy;if(dragging){box.style.left=Math.max(0,Math.min(stage.clientWidth-start.width,start.left+dx))+"px";box.style.top=Math.max(0,Math.min(stage.clientHeight-start.height,start.top+dy))+"px"}else{box.style.width=Math.max(60,Math.min(stage.clientWidth-start.left,start.width+dx))+"px";box.style.height=Math.max(60,Math.min(stage.clientHeight-start.top,start.height+dy))+"px"}drawPreview()});
box.addEventListener("pointerup",()=>{dragging=resizing=false});
$("#center").onclick=()=>{box.style.left=(stage.clientWidth-box.offsetWidth)/2+"px";box.style.top=(stage.clientHeight-box.offsetHeight)/2+"px";drawPreview()};
$("#fitWidth").onclick=()=>{box.style.left="5%";box.style.width="90%";box.style.top="30%";box.style.height="40%";drawPreview()};
function setupCanvas(){canvas.width=1080;canvas.height=1920}
async function drawToCanvas(video,previewOnly=false){
 setupCanvas();ctx.fillStyle="#111";ctx.fillRect(0,0,1080,1920);
 if(img.complete&&img.naturalWidth){ctx.drawImage(img,0,0,1080,1920)}
 if(video){const sr=stage.getBoundingClientRect(),br=box.getBoundingClientRect();const x=(br.left-sr.left)/sr.width*1080,y=(br.top-sr.top)/sr.height*1920,w=br.width/sr.width*1080,h=br.height/sr.height*1920;drawVideoCover(ctx,video,x,y,w,h,$("#fit").value)}
}
function drawVideoCover(c,v,x,y,w,h,fit){const vw=v.videoWidth||1,vh=v.videoHeight||1;let dw,dh;if(fit==="contain"){const s=Math.min(w/vw,h/vh);dw=vw*s;dh=vh*s}else{const s=Math.max(w/vw,h/vh);dw=vw*s;dh=vh*s}c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(v,x+(w-dw)/2,y+(h-dh)/2,dw,dh);c.restore()}
async function drawPreview(){if(!templateURL){setupCanvas();ctx.fillStyle="#151a17";ctx.fillRect(0,0,1080,1920);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="700 40px Arial";ctx.fillText("ENVIE UM TEMPLATE",540,950);return}if(videos.length){const v=document.createElement("video");v.src=URL.createObjectURL(videos[0]);v.muted=true;await new Promise(r=>v.onloadedmetadata=r);await drawToCanvas(v,true);URL.revokeObjectURL(v.src)}else await drawToCanvas(null)}
$("#fit").onchange=drawPreview;

async function renderOne(file){
 const v=document.createElement("video");v.src=URL.createObjectURL(file);v.muted=true;v.playsInline=true;await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j});
 setupCanvas();const stream=canvas.captureStream(30);if(v.captureStream)v.captureStream().getAudioTracks().forEach(t=>stream.addTrack(t));
 const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")?"video/webm;codecs=vp9,opus":"video/webm";const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:$("#quality").value==="high"?7000000:4500000});let chunks=[];rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);const stopped=new Promise(r=>rec.onstop=r);rec.start(200);await v.play();
 function frame(){if(v.ended)return;ctx.fillStyle="#111";ctx.fillRect(0,0,1080,1920);if(img.complete)ctx.drawImage(img,0,0,1080,1920);const sr=stage.getBoundingClientRect(),br=box.getBoundingClientRect(),x=br.left-sr.left, y=br.top-sr.top,w=br.width,h=br.height;drawVideoCover(ctx,v,x/sr.width*1080,y/sr.height*1920,w/sr.width*1080,h/sr.height*1920,$("#fit").value);requestAnimationFrame(frame)}frame();await new Promise(r=>v.onended=r);rec.stop();await stopped;stream.getTracks().forEach(t=>t.stop());URL.revokeObjectURL(v.src);return new Blob(chunks,{type:mime})}
$("#generate").onclick=async()=>{if(!templateURL){$("#status").textContent="Escolha um template primeiro.";return}if(!videos.length){$("#status").textContent="Adicione pelo menos um vídeo.";return}if(!window.MediaRecorder||!canvas.captureStream){$("#status").textContent="Use Chrome ou Edge atual.";return}$("#generate").disabled=true;$("#results").classList.remove("hidden");$("#resultList").innerHTML="";for(let i=0;i<videos.length;i++){ $("#status").textContent=`Gerando ${i+1} de ${videos.length}…`;try{const b=await renderOne(videos[i]),u=URL.createObjectURL(b),d=document.createElement("div");d.className="result";d.innerHTML=`<b>${esc(videos[i].name.replace(/\.[^.]+$/,""))}_fitnamente.webm</b><a download="${esc(videos[i].name.replace(/\.[^.]+$/,""))}_fitnamente.webm" href="${u}">BAIXAR</a>`;$("#resultList").append(d)}catch(e){console.error(e)}}$("#status").textContent="Concluído.";$("#generate").disabled=false};
setupCanvas();drawPreview();
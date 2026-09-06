import {FFmpeg} from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import {fetchFile,toBlobURL} from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";
const $=s=>document.querySelector(s),art=$("#art"),stage=$("#stage"),box=$("#box"),canvas=$("#canvas"),ctx=canvas.getContext("2d");
let vids=[],template=null,ffmpeg=null,loaded=false,drag=false,resize=false,sx=0,sy=0,start={};
const esc=s=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function render(){list.innerHTML="";vids.forEach((f,i)=>{let d=document.createElement("div");d.className="file";d.innerHTML=`<b>${esc(f.name)}</b><small>${Math.round(f.size/1024/1024*10)/10} MB</small><button>×</button>`;d.querySelector("button").onclick=()=>{vids.splice(i,1);render();state()};list.append(d)})}
function state(){$("#generate").disabled=!(loaded&&template&&vids.length)}
$("#template").onchange=()=>{template=$("#template").files[0];if(!template)return;art.src=URL.createObjectURL(template);art.onload=()=>{draw();state()};};
$("#videos").onchange=()=>{vids=[...vids,...$("#videos").files].slice(0,50);render();draw();state();$("#videos").value=""};
function point(e){let r=stage.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
box.onpointerdown=e=>{let p=point(e),r=box.getBoundingClientRect(),sr=stage.getBoundingClientRect();resize=p.x>(r.right-sr.left-30)&&p.y>(r.bottom-sr.top-30);drag=!resize;sx=p.x;sy=p.y;start={l:box.offsetLeft,t:box.offsetTop,w:box.offsetWidth,h:box.offsetHeight};box.setPointerCapture(e.pointerId);e.preventDefault()};
box.onpointermove=e=>{if(!drag&&!resize)return;let p=point(e),dx=p.x-sx,dy=p.y-sy;if(drag){box.style.left=Math.max(0,Math.min(stage.clientWidth-start.w,start.l+dx))+"px";box.style.top=Math.max(0,Math.min(stage.clientHeight-start.h,start.t+dy))+"px"}else{box.style.width=Math.max(50,Math.min(stage.clientWidth-start.l,start.w+dx))+"px";box.style.height=Math.max(50,Math.min(stage.clientHeight-start.t,start.h+dy))+"px"}draw()};
box.onpointerup=()=>drag=resize=false;
$("#center").onclick=()=>{box.style.left=(stage.clientWidth-box.offsetWidth)/2+"px";box.style.top=(stage.clientHeight-box.offsetHeight)/2+"px";draw()};
$("#width").onclick=()=>{box.style.left="5%";box.style.width="90%";box.style.top="30%";box.style.height="40%";draw()};
function coords(){let sr=stage.getBoundingClientRect(),r=box.getBoundingClientRect();return{x:Math.round((r.left-sr.left)/sr.width*1080),y:Math.round((r.top-sr.top)/sr.height*1920),w:Math.round(r.width/sr.width*1080),h:Math.round(r.height/sr.height*1920)}}
function draw(){canvas.width=1080;canvas.height=1920;ctx.fillStyle="#111";ctx.fillRect(0,0,1080,1920);if(art.complete&&art.naturalWidth)ctx.drawImage(art,0,0,1080,1920);if(vids.length){let v=document.createElement("video");v.src=URL.createObjectURL(vids[0]);v.muted=true;v.onloadedmetadata=()=>{let c=coords(),vw=v.videoWidth,vh=v.videoHeight,s=$("#fit").value==="contain"?Math.min(c.w/vw,c.h/vh):Math.max(c.w/vw,c.h/vh),dw=vw*s,dh=vh*s;ctx.save();ctx.beginPath();ctx.rect(c.x,c.y,c.w,c.h);ctx.clip();ctx.drawImage(v,c.x+(c.w-dw)/2,c.y+(c.h-dh)/2,dw,dh);ctx.restore();URL.revokeObjectURL(v.src)}}}
$("#fit").onchange=draw;

async function loadEngine(){
  if(loaded)return;
  $("#status").textContent="Carregando motor MP4…";
  const bases=[
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd",
    "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd"
  ];
  let lastError;
  for(const base of bases){
    try{
      ffmpeg=new FFmpeg();
      ffmpeg.on("log",({message})=>{if(/frame=|time=|speed=/.test(message))$("#status").textContent=message});
      $("#status").textContent="Conectando ao motor MP4…";
      await ffmpeg.load({
        coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,"text/javascript"),
        wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,"application/wasm")
      });
      loaded=true;
      $("#load").textContent="MOTOR MP4 CARREGADO";
      $("#status").textContent="Pronto.";
      state();
      return;
    }catch(e){
      lastError=e;
      console.error("Falha ao carregar FFmpeg em",base,e);
      try{ffmpeg?.terminate()}catch{}
    }
  }
  throw lastError || new Error("Não foi possível carregar o FFmpeg");
}
$("#load").onclick=()=>loadEngine().catch(e=>{
  console.error(e);
  $("#status").textContent="O motor MP4 não conseguiu carregar. Tente Ctrl+F5 e clique novamente. Se continuar, o bloqueio é do navegador/rede, não do template.";
});

async function transparentTemplate(){let c=document.createElement("canvas"),w=art.naturalWidth,h=art.naturalHeight;c.width=w;c.height=h;let x=c.getContext("2d");x.drawImage(art,0,0,w,h);let sr=stage.getBoundingClientRect(),r=box.getBoundingClientRect();x.clearRect((r.left-sr.left)/sr.width*w,(r.top-sr.top)/sr.height*h,r.width/sr.width*w,r.height/sr.height*h);return await new Promise(r=>c.toBlob(r,"image/png"))}
function ext(n){let m=n.toLowerCase();return m.endsWith(".mov")?"mov":m.endsWith(".webm")?"webm":m.endsWith(".mkv")?"mkv":"mp4"}

async function makeMP4(file,png,i){let input=`in${i}.${ext(file)}`,tpl=`tpl${i}.png`,out=`out${i}.mp4`;await ffmpeg.writeFile(input,await fetchFile(file));await ffmpeg.writeFile(tpl,await fetchFile(png));let c=coords(),vf;
if($("#fit").value==="contain")vf=`scale=${c.w}:${c.h}:force_original_aspect_ratio=decrease,pad=${c.w}:${c.h}:(ow-iw)/2:(oh-ih)/2:color=black,pad=1080:1920:${c.x}:${c.y}:color=black`;
else vf=`scale=${c.w}:${c.h}:force_original_aspect_ratio=increase,crop=${c.w}:${c.h},pad=1080:1920:${c.x}:${c.y}:color=black`;
await ffmpeg.exec(["-i",input,"-i",tpl,"-filter_complex",`[0:v]${vf}[v];[v][1:v]overlay=0:0:format=auto[outv]`,"-map","[outv]","-map","0:a?","-c:v","libx264","-preset","veryfast","-crf",$("#quality").value==="high"?"19":"23","-pix_fmt","yuv420p","-c:a","aac","-b:a","128k","-movflags","+faststart","-shortest",out]);let data=await ffmpeg.readFile(out);for(let f of [input,tpl,out])try{await ffmpeg.deleteFile(f)}catch{}return new Blob([data.buffer],{type:"video/mp4"})}

$("#generate").onclick=async()=>{if(!loaded||!template||!vids.length)return;$("#generate").disabled=true;$("#results").classList.remove("hidden");$("#out").innerHTML="";try{let png=await transparentTemplate();for(let i=0;i<vids.length;i++){$("#status").textContent=`Gerando MP4 ${i+1} de ${vids.length}…`;$("#bar").style.width=`${i/vids.length*100}%`;let b=await makeMP4(vids[i],png,i),u=URL.createObjectURL(b),name=vids[i].name.replace(/\.[^.]+$/,"")+"_fitnamente.mp4",d=document.createElement("div");d.className="result";d.innerHTML=`<b>${esc(name)}</b><a href="${u}" download="${esc(name)}">BAIXAR MP4</a>`;$("#out").append(d)}$("#bar").style.width="100%";$("#status").textContent="Concluído. MP4 pronto para postar."}catch(e){console.error(e);$("#status").textContent="Erro ao gerar. Tente um vídeo menor e recarregue a página."}$("#generate").disabled=false};
draw();state();
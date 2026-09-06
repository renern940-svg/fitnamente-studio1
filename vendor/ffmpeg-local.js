import {FFMessageType} from "./const.js";
import {getMessageID} from "./utils.js";
import {ERROR_NOT_LOADED,ERROR_TERMINATED} from "./errors.js";

export class FFmpegLocal {
  constructor(workerURL="./worker.js"){
    this.workerURL=workerURL; this.worker=null; this.loaded=false;
    this.resolves={}; this.rejects={}; this.logCallbacks=[]; this.progressCallbacks=[];
  }
  on(event,cb){ if(event==="log")this.logCallbacks.push(cb); if(event==="progress")this.progressCallbacks.push(cb); }
  #handlers(){
    this.worker.onmessage=({data:{id,type,data}})=>{
      if(type===FFMessageType.LOG){this.logCallbacks.forEach(f=>f(data));return}
      if(type===FFMessageType.PROGRESS){this.progressCallbacks.forEach(f=>f(data));return}
      if(type===FFMessageType.ERROR){this.rejects[id]?.(data);delete this.rejects[id];delete this.resolves[id];return}
      this.resolves[id]?.(data);delete this.resolves[id];delete this.rejects[id];
      if(type===FFMessageType.LOAD)this.loaded=true;
    };
  }
  #send(type,data,transfer=[]){
    if(!this.worker)return Promise.reject(ERROR_NOT_LOADED);
    const id=getMessageID();
    return new Promise((resolve,reject)=>{
      this.resolves[id]=resolve;this.rejects[id]=reject;
      this.worker.postMessage({id,type,data},transfer);
    });
  }
  async load(config={}){
    if(!this.worker){
      this.worker=new Worker(new URL(this.workerURL,location.href),{type:"module"});
      this.#handlers();
    }
    return this.#send(FFMessageType.LOAD,config);
  }
  writeFile(path,data){
    const transfer=data instanceof Uint8Array?[data.buffer]:[];
    return this.#send(FFMessageType.WRITE_FILE,{path,data},transfer);
  }
  exec(args,timeout=-1){return this.#send(FFMessageType.EXEC,{args,timeout});}
  readFile(path,encoding="binary"){return this.#send(FFMessageType.READ_FILE,{path,encoding});}
  deleteFile(path){return this.#send(FFMessageType.DELETE_FILE,{path});}
  terminate(){
    Object.values(this.rejects).forEach(r=>r(ERROR_TERMINATED));
    this.resolves={};this.rejects={};this.worker?.terminate();this.worker=null;this.loaded=false;
  }
}

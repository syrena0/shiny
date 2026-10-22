#!/usr/bin/env node
// Local development worker. Never bind this unauthenticated service to a public interface.
import {createServer} from 'node:http';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=fileURLToPath(new URL('..',import.meta.url)),run=promisify(execFile);let busy=false;
const origins=new Set(['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173']);
createServer(async(req,res)=>{
 const origin=req.headers.origin;const send=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(body))};
 if(!origins.has(origin)||!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress))return send(403,{error:'Local browser origins only'});
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type,X-Shiny-Import','Vary':'Origin'});return res.end()}
 if(req.url!=='/import'||req.method!=='POST'||req.headers['x-shiny-import']!=='1'||req.headers['content-type']!=='application/json')return send(400,{error:'Invalid import request'});
 if(busy)return send(409,{error:'An import is already running'});busy=true;let directory;
 try{
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>12*1024*1024)throw new Error('Request too large');chunks.push(chunk)}
  const {csv}=JSON.parse(Buffer.concat(chunks).toString());if(typeof csv!=='string')throw new Error('CSV is required');
  directory=await mkdtemp(join(tmpdir(),'shiny-feed-'));const input=join(directory,'feed.csv');await writeFile(input,csv);
  await run(process.execPath,[join(root,'scripts/import-feed.mjs'),input,'--write'],{cwd:root,maxBuffer:12*1024*1024});
  send(200,{products:JSON.parse(await readFile(join(root,'data/products.json'),'utf8'))});
 }catch(error){send(422,{error:error.code?'Import failed. Inspect the worker console.':error.message});console.error(error.stderr||error.message)}finally{if(directory)await rm(directory,{recursive:true,force:true});busy=false;}
}).listen(5180,'127.0.0.1',()=>console.log('SHINY local import worker ready on 127.0.0.1:5180. Open the existing local admin panel to import CSV files.'));

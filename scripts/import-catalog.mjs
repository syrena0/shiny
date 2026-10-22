#!/usr/bin/env node
import {readFile,writeFile,rename,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCatalog,mergeCatalog} from '../src/lib/catalog-schema.js';
const args=process.argv.slice(2);let input,targetArgument,write=false;
for(let i=0;i<args.length;i++){
 if(args[i]==='--write')write=true;
 else if(args[i]==='--target'&&args[i+1])targetArgument=args[++i];
 else if(!args[i].startsWith('--')&&!input)input=args[i];
 else{console.error('Unknown or incomplete argument.');process.exit(1);}
}
const target=targetArgument?resolve(targetArgument):resolve(dirname(fileURLToPath(import.meta.url)),'../data/products.json');
if(!input){console.error('Usage: npm run import:catalog -- input.json [--write] [--target path]');process.exit(1);}
try{
 if((await stat(input)).size>10*1024*1024)throw new Error('Input exceeds 10 MB.');
 const incoming=JSON.parse(await readFile(input,'utf8'));
 const validation=validateCatalog(incoming,{requireProvenance:true,checkReferences:false});
 if(!validation.valid)throw new Error(`Import rejected: ${JSON.stringify(validation.errors)}`);
 const existing=JSON.parse(await readFile(target,'utf8'));
 const result=mergeCatalog(existing,incoming);
 if(!result.valid)throw new Error(`Merged catalog rejected: ${JSON.stringify(result.errors)}`);
 if(write){const temporary=target+'.import.tmp';await writeFile(temporary,JSON.stringify(result.products,null,2)+'\n',{flag:'wx'});await rename(temporary,target);}
 console.log(JSON.stringify({mode:write?'written':'dry-run',added:result.added,updated:result.updated,total:result.products.length,notice:'Schema and rights declarations checked; factual accuracy and licensing must be verified by the data supplier.'},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}

#!/usr/bin/env node
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {parseCSV,planFeedImport,applyImportedImage,normalizeSourceFeed} from '../src/lib/feed-import.js';
import {validateCatalog} from '../src/lib/catalog-schema.js';
import {downloadBytes,optimizeImage} from './lib/image-download.mjs';
let root=resolve(fileURLToPath(new URL('..',import.meta.url)));const args=process.argv.slice(2);let input,sourceId,write=false;
for(let i=0;i<args.length;i++){if(args[i]==='--root'&&args[i+1])root=resolve(args[++i]);else if(args[i]==='--write')write=true;else if(args[i]==='--source'&&args[i+1])sourceId=args[++i];else if(!args[i].startsWith('-')&&!input)input=args[i];else throw new Error('Usage: import:feed -- feed.csv | --source SOURCE_ID [--write]');}
let stage;
try{
 const registry=JSON.parse(await readFile(join(root,'data/import-sources.json'),'utf8'));let rows;
 if(sourceId){const source=registry.sources.find(s=>s.id===sourceId&&s.enabled);if(!source?.feed_url)throw new Error('Configured source needs feed_url and feed_hosts');const bytes=await downloadBytes(source.feed_url,source.feed_hosts,{token:source.token_env?process.env[source.token_env]:undefined});const content=bytes.toString('utf8');rows=normalizeSourceFeed(source.feed_format==='json'?JSON.parse(content):parseCSV(content,{supplier:true}),source);}
 else if(input){const bytes=await readFile(resolve(input));if(bytes.length>10*1024*1024)throw new Error('Feed exceeds 10 MB');rows=input.endsWith('.json')?JSON.parse(bytes.toString()):parseCSV(bytes.toString());}
 else throw new Error('Provide a CSV/JSON feed or --source SOURCE_ID');
 if(!Array.isArray(rows)||rows.length>20000)throw new Error('Expected up to 20000 normalized feed records');
 const products=JSON.parse(await readFile(join(root,'data/products.json'),'utf8'));const plan=planFeedImport(rows,products,registry);
 if(!plan.valid){console.log(JSON.stringify({mode:'rejected',rows:plan.report,errors:plan.errors},null,2));process.exitCode=1;}
 else if(!write)console.log(JSON.stringify({mode:'dry-run',products:plan.products.length,downloads:plan.jobs.length,rows:plan.report},null,2));
 else {
  stage=join(root,'.import-stage-'+randomUUID());await mkdir(stage);const files=[];
  // Bounded sequential downloads avoid hammering suppliers and limit memory use.
  for(const job of plan.jobs){const product=plan.products.find(p=>p.id===job.product_id),source=registry.sources.find(s=>s.id===job.source_id);let review;
   try{
    const bytes=await downloadBytes(job.url,source.image_hosts,{token:source.image_token_env?process.env[source.image_token_env]:undefined});const optimized=await optimizeImage(bytes);const stem=optimized.sha256.slice(0,24);
    const asset={url:`/products/imported/${stem}.webp`,detailUrl:`/products/imported/${stem}-detail.webp`,sourceUrl:job.sourceUrl,license:job.license,licenseUrl:source.license_url,author:job.author,originalUrl:job.url,sha256:optimized.sha256,source_sha256:optimized.source_sha256,transformation:'Resized, oriented, flattened on white and encoded as WebP',width:optimized.width,height:optimized.height};
    for(const [name,data] of [[stem+'.webp',optimized.card],[stem+'-detail.webp',optimized.detail]]){await writeFile(join(stage,name),data);files.push(name)}
    const approved=source.approved_sha256?.includes(optimized.source_sha256)||job.auto_approve&&optimized.neutral_border>=.8;
    asset.review={status:approved?'approved':'needs-review',method:'source-and-background-check',checked_at:new Date().toISOString()};
    review={...job,status:approved?'approved':'needs-review',reason:approved?'Trusted studio feed; identity and background checks passed':'Visual review required before primary use',candidate:asset,neutral_border:optimized.neutral_border,checked_at:new Date().toISOString()};
    applyImportedImage(product,job,approved?asset:null);
   }catch(error){review={...job,status:'failed',reason:error.message,checked_at:new Date().toISOString()};applyImportedImage(product,job,null);}
   product.image_reviews=[...(product.image_reviews||[]).filter(r=>r.variant_key!==job.variant_key),review];console.error(`Image row ${job.row}: ${review.status}`);const row=plan.report.find(r=>r.row===job.row);row.image_status=review.status;row.reason=review.reason;
  }
  if(!validateCatalog(plan.products).valid)throw new Error('Final catalog validation failed; no catalog changes written');
  const destination=join(root,'public/products/imported');await mkdir(destination,{recursive:true});for(const name of files)await rename(join(stage,name),join(destination,name));
  const report={generated_at:new Date().toISOString(),mode:'written',products:plan.products.length,rows:plan.report};
  await writeFile(join(stage,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(join(stage,'products.json'),JSON.stringify(plan.products,null,2)+'\n');
  await rename(join(stage,'report.json'),join(root,'data/import-report.json'));await rename(join(stage,'products.json'),join(root,'data/products.json'));
  console.log(JSON.stringify(report,null,2));
 }
}catch(error){console.error(error.message);process.exitCode=1;}finally{if(stage)await rm(stage,{recursive:true,force:true});}

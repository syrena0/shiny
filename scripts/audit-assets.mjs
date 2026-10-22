import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCatalog,isPlaceholderImage} from '../src/lib/catalog-schema.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const products=JSON.parse(await readFile(resolve(root,'data/products.json'),'utf8'));
const validation=validateCatalog(products);
if(!validation.valid){console.error(JSON.stringify(validation,null,2));process.exit(1);}
const urls=[];let rightsDeclared=0;
for(const p of products){
 if(p.image)urls.push(p.image);
 for(const asset of [...p.images||[],...p.shades.flatMap(s=>[...s.images||[],...s.image?[s.image]:[]])]){
  urls.push(typeof asset==='string'?asset:asset.url);
  if(typeof asset==='object'&&asset.sourceUrl&&asset.license)rightsDeclared++;
 }
}
const missing=[];
for(const url of new Set(urls.filter(u=>u.startsWith('/')))){try{await access(resolve(root,'public',url.slice(1)));}catch{missing.push(url);}}
const sourceBacked=products.filter(p=>p.provenance).length;
console.log(JSON.stringify({products:products.length,sourceBackedProducts:sourceBacked,rightsDeclaredImages:rightsDeclared,remoteImageUrls:[...new Set(urls)].filter(u=>u.startsWith('https://')).length,placeholderOnlyProducts:products.filter(p=>isPlaceholderImage(p.image)&&!p.images?.length).length,missingLocalAssets:missing,validSchema:validation.valid,errors:validation.errors},null,2));
if(missing.length||!validation.valid)process.exitCode=1;

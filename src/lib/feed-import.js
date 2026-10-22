import {validateCatalog,isHttpsUrl,PRODUCT_CATEGORIES,isCalendarDate} from './catalog-schema.js';
import {numericPrice,productVariants} from './pricing.js';
export const FEED_COLUMNS=['source_id','product_id','gtin','brand','product_name','category','shade','size','image_url','image_source_url','image_license','image_author','image_type','background','store','price','currency','market','price_verified','purchase_url','price_source_url','last_checked','online_available','physical_available'];
export function parseCSV(text,{supplier=false}={}){
 if(typeof text!=='string'||text.length>10*1024*1024)throw new Error('CSV exceeds 10 MB');
 text=text.replace(/^\uFEFF/,'');const records=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<=text.length;i++){
  const c=text[i];if(quoted){if(c===undefined)throw new Error('Unclosed CSV quote');if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw new Error('Unexpected CSV quote');quoted=true;continue;}
  if(c===','||c==='\n'||c==='\r'||c===undefined){row.push(field);field='';closed=false;if(c!==','){if(row.some(x=>x!==''))records.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}continue;}
  if(closed)throw new Error('Characters after CSV quote');field+=c;
 }
 if(!records.length)throw new Error('Empty CSV');const headers=records.shift().map(h=>h.trim());
 if(headers.some(h=>!h||['__proto__','prototype','constructor'].includes(h))||new Set(headers).size!==headers.length||!supplier&&(headers.some(h=>!FEED_COLUMNS.includes(h))||!['source_id','brand','product_name'].every(h=>headers.includes(h))))throw new Error('Invalid or missing CSV headers');
 if(records.length>20000)throw new Error('Too many CSV rows');
 return records.map((record,i)=>{if(record.length!==headers.length)throw new Error(`Column count at row ${i+2}`);return Object.fromEntries(headers.map((h,j)=>[h,record[j].trim()]));});
}
export function writeCSV(rows,headers=FEED_COLUMNS){const cell=v=>{v=String(v??'');return /[",\r\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v};return '\uFEFF'+[headers,...rows.map(r=>headers.map(h=>r[h]))].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';}
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const line=s=>norm(s.split(' — ')[0]);
const bool=s=>s==='true'?true:s==='false'?false:null;
export function planFeedImport(rows,existing,registry){
 if(!Array.isArray(rows)||!rows.length||rows.length>20000||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)||Object.entries(r).some(([k,v])=>!FEED_COLUMNS.includes(k)||v!==null&&!['string','number','boolean'].includes(typeof v))))throw new Error('Invalid normalized feed records');
 rows=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,String(v??'').trim()])));
 const products=structuredClone(existing),report=[],jobs=[];const imageTargets=new Map();const sources=new Map(registry.sources.map(s=>[s.id,s]));const rowKeys=new Set();
 for(const [index,row] of rows.entries()){
  const result={row:index+2,product_id:row.product_id||null,status:'rejected',reason:'',image_status:'none'};report.push(result);
  try{
   const source=sources.get(row.source_id);if(!source?.enabled)throw new Error('Source is not authorized in the registry');
   if(!row.brand||!row.product_name)throw new Error('Brand and product name are required');
   const key=[row.source_id,row.product_id||row.gtin||line(row.product_name),norm(row.shade),row.size,row.store||''].join('|');if(rowKeys.has(key))throw new Error('Duplicate product/variant/store row');rowKeys.add(key);
   const identified=products.filter(p=>row.product_id?p.id===row.product_id:row.gtin&&(p.gtin===row.gtin||p.shades.some(s=>s.gtin===row.gtin)||p.variants?.some(v=>v.gtin===row.gtin)));
   const candidates=identified.length?identified:products.filter(p=>norm(p.brand)===norm(row.brand)&&line(p.name)===line(row.product_name));
   if(candidates.length>1)throw new Error('Ambiguous match; supply the product ID and exact SKU');
   let product=candidates[0];
   if(product&&(norm(product.brand)!==norm(row.brand)||line(product.name)!==line(row.product_name)))throw new Error('Identifier conflicts with brand/product name');
   if(row.product_id&&product&&product.id!==row.product_id)throw new Error('Product ID conflicts with named product');
   if(!product){
    if(!row.gtin||!/^\d{8,14}$/.test(row.gtin)||!PRODUCT_CATEGORIES.includes(row.category))throw new Error('New products require GTIN and category');
    const id=row.product_id||`feed-${source.id}-${row.gtin}`;if(!/^[\w-]+$/.test(id)||products.some(p=>p.id===id))throw new Error('Invalid or duplicate product ID');
    product={id,brand:row.brand,name:row.product_name,category:row.category,gtin:row.gtin,price_azn:null,rating:null,image:'',images:[],description:{az:'',en:'',ru:''},skin_type:[],finish:null,shades:[],stores:[],dupes:[],provenance:{source_url:source.terms_url,retrieved_at:new Date().toISOString().slice(0,10),kind:source.kind||'retailer',license:source.data_license||source.license}};
    products.push(product);
   }
   if(row.gtin){const owners=products.filter(p=>p.gtin===row.gtin||p.shades.some(s=>s.gtin===row.gtin)||p.variants?.some(v=>v.gtin===row.gtin));if(owners.some(owner=>owner.id!==product.id))throw new Error('GTIN belongs to another product');}
   result.product_id=product.id;
   if(row.category&&row.category!==product.category)throw new Error('Category conflicts with identified product');
   const shade=row.shade||null,size=row.size||product.size;
   let options=productVariants(product),variant=options.find(v=>v.shade===shade&&v.size===size);
   if(!variant&&options.length===1&&options[0].shade===shade&&!options[0].size&&size){
    product.size=size;if(product.shades.length===1)product.shades[0].size=size;options=productVariants(product);variant=options[0];
   }
   if(!variant&&size){const unsized=options.find(v=>v.shade===shade&&!v.size&&(!row.gtin||!v.gtin||v.gtin===row.gtin));if(unsized){const shadeRecord=product.shades.find(s=>s.name===shade);if(shadeRecord)shadeRecord.size=size;else product.size=size;options=productVariants(product);variant=options.find(v=>v.shade===shade&&v.size===size);}}
   if(!variant){
    if(!size||!row.gtin)throw new Error('Variant mismatch: exact shade, size and GTIN required');
    if(!product.variants)product.variants=options.map(v=>({...v,id:v.key,shade:v.shade}));
    if(product.variants.some(v=>v.gtin===row.gtin))throw new Error('GTIN conflicts with another variant');
    variant={id:'sku-'+row.gtin,key:'sku-'+row.gtin,name:shade||'',shade,size,gtin:row.gtin,image:'',images:[]};product.variants.push(variant);
    if(shade&&!product.shades.some(s=>s.name===shade))product.shades.push({name:shade,hex:null,undertone:'unknown'});
   }
   if(row.gtin&&variant.gtin&&variant.gtin!==row.gtin)throw new Error('GTIN conflicts with selected variant');
   if(row.gtin&&product.gtin===row.gtin&&((product.default_shade&&product.default_shade!==shade)||!product.shades.length&&shade!==null))throw new Error('Base GTIN belongs to a different shade');
   result.variant_key=variant.key;
   if(row.price){
    if(!source.price_import||row.price_verified!=='true'||row.currency!=='AZN'||row.market!=='AZ'||numericPrice(row.price)===null||!row.store||!size||!isHttpsUrl(row.purchase_url)||!isHttpsUrl(row.price_source_url)||!isCalendarDate(row.last_checked)||new Date(row.last_checked)>new Date())throw new Error('Verified AZ/AZN price needs an authorized retailer, exact size, source links and check date');
    if(!source.price_hosts?.includes(new URL(row.price_source_url).hostname)||!source.price_hosts.includes(new URL(row.purchase_url).hostname))throw new Error('Price source is outside authorized retailer hosts');
    const id=[source.id,product.id,variant.key,row.store].join(':');const offer={id,name:row.store,market:'AZ',currency:'AZN',shade,size,price_azn:numericPrice(row.price),verified:true,url:row.purchase_url,sourceUrl:row.price_source_url,last_checked:row.last_checked,online_available:bool(row.online_available),physical_available:bool(row.physical_available)};
    product.offers=[...(product.offers||[]).filter(o=>o.id!==id),offer];
   }
   if(row.image_url){
    if(!isHttpsUrl(row.image_url)||!isHttpsUrl(row.image_source_url)||!source.image_hosts?.includes(new URL(row.image_url).hostname)||!source.page_hosts?.includes(new URL(row.image_source_url).hostname)||row.image_license!==source.license||!row.image_author)throw new Error('Image needs a permitted host, source page, exact authorized license and author');
    if(row.image_type!=='studio'||!['white','neutral','transparent'].includes(row.background)){result.image_status='rejected';result.reason='Only studio photography on a neutral background is accepted';}
    else {const imageKey=product.id+'|'+variant.key;if(imageTargets.has(imageKey)&&imageTargets.get(imageKey)!==row.image_url)throw new Error('Conflicting images for one variant; resolve before importing');if(!imageTargets.has(imageKey))jobs.push({row:index+2,source_id:source.id,product_id:product.id,variant_key:variant.key,shade,size,gtin:row.gtin,url:row.image_url,sourceUrl:row.image_source_url,license:row.image_license,author:row.image_author,auto_approve:source.trusted_studio===true||source.approved_assets?.includes(row.image_url)===true});imageTargets.set(imageKey,row.image_url);result.image_status='queued';}
   }
   result.status='matched';
  }catch(error){result.reason=error.message;}
 }
 const validation=validateCatalog(products);return {valid:report.every(r=>r.status==='matched')&&validation.valid,products,report,jobs,errors:validation.errors};
}
export function applyImportedImage(product,job,asset,{preserveApproved=true}={}){
 const target=product.variants?.find(v=>v.id===job.variant_key)||product.shades.find(s=>s.name===job.shade)||product;
 if(!asset&&preserveApproved&&target.images?.some(a=>typeof a==='object'&&a.review?.status==='approved'))return;
 target.image=asset?.url||'';target.images=asset?[asset]:[];
 const isDefault=productVariants(product)[0].key===job.variant_key||product.default_variant===job.variant_key||product.default_shade===job.shade;
 if(target===product||isDefault){product.image=target.image;product.images=target.images;}
}

export function normalizeSourceFeed(payload,source){
 const pick=(object,path)=>String(path).split('.').reduce((value,key)=>value&&Object.hasOwn(value,key)&&!['__proto__','prototype','constructor'].includes(key)?value[key]:undefined,object);
 const records=source.records_path?pick(payload,source.records_path):payload;
 if(!Array.isArray(records)||records.length>20000)throw new Error('Configured API must return an array of product/variant records');
 return records.map(record=>{
  if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('Invalid supplier record');
  const mapped=source.field_map?Object.fromEntries(Object.entries(source.field_map).map(([column,path])=>[column,pick(record,path)])):record;
  const result={source_id:source.id,...source.defaults,...mapped};
  if(Object.entries(result).some(([key,value])=>!FEED_COLUMNS.includes(key)||value!=null&&!['string','number','boolean'].includes(typeof value)))throw new Error('Supplier fields must map to normalized scalar columns');
  if(result.gtin!==undefined&&typeof result.gtin!=='string')throw new Error('Supplier GTINs must be strings to preserve leading zeroes');
  return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,String(value??'').trim()]));
 });
}

import {validateCatalog,MAX_CATALOG_RECORDS} from './catalog-schema.js';
export function supabaseConfig(env){
 const url=env?.VITE_SUPABASE_URL||env?.SUPABASE_URL||'',key=env?.VITE_SUPABASE_ANON_KEY||env?.SUPABASE_ANON_KEY||'';
 if(!url&&!key)return null;
 let parsed;try{parsed=new URL(url);}catch{throw new Error('supabaseConfig');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||!key||key.startsWith('sb_secret_'))throw new Error('supabaseConfig');
 // Reject legacy elevated JWTs as well as new secret keys.
 if(key.split('.').length===3){
  try{const payload=key.split('.')[1].replaceAll('-','+').replaceAll('_','/');if(JSON.parse(globalThis.atob(payload)).role==='service_role')throw new Error('privateKey');}
  catch{throw new Error('supabaseConfig');}
 }
 return {url:parsed.origin,key};
}
export function decodeProductRow(row){
 if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('supabaseData');
 const data=row.catalog_data||{};
 if(typeof data!=='object'||Array.isArray(data))throw new Error('supabaseData');
 const core=new Set(['id','brand','name','category','price_azn','rating','image','skin_type','finish','description','shades','stores','dupes']);
 const fields=Object.fromEntries(Object.entries(row).filter(([key,value])=>value!==null||core.has(key)||Object.hasOwn(data,key)&&data[key]===null));
 const product={...data,...fields,id:row.catalog_id||data.id||row.id};delete product.catalog_data;delete product.catalog_id;
 return product;
}
export async function fetchSupabaseProducts(config,{signal,fetcher=fetch,pageSize=500}={}){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)throw new Error('supabaseData');
 const products=[];
 // Follow offsets until a short page; never assume the REST API returns the whole table.
 for(let offset=0;offset<=MAX_CATALOG_RECORDS;){
  const url=new URL('/rest/v1/products',config.url);url.searchParams.set('select','*');url.searchParams.set('order','id.asc');url.searchParams.set('limit',String(pageSize));url.searchParams.set('offset',String(offset));
  const response=await fetcher(url,{headers:{apikey:config.key,Accept:'application/json'},signal,cache:'no-store',redirect:'error'});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'supabasePermission':'supabaseFetch');
  const rows=await response.json();if(!Array.isArray(rows))throw new Error('supabaseData');
  products.push(...rows.map(decodeProductRow));if(products.length>MAX_CATALOG_RECORDS)throw new Error('supabaseData');
  const range=response.headers.get('content-range')?.match(/^(\d+)-(\d+)\/(\d+|\*)$/);
  if(range&&range[3]!=='*'&&Number(range[2])+1>=Number(range[3]))break;
  // A server may enforce a lower max_rows cap than our requested limit.
  if(!rows.length||(!range&&rows.length<pageSize))break;
  offset+=rows.length;
 }
 if(!products.length)throw new Error('supabaseEmpty');
 if(!validateCatalog(products).valid)throw new Error('supabaseData');
 return products;
}

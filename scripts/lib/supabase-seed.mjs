import {createHash} from 'node:crypto';
import {validateCatalog} from '../../src/lib/catalog-schema.js';
import {decodeProductRow} from '../../src/lib/supabase-catalog.js';
export const CORE_FIELDS=['brand','name','category','price_azn','rating','image','skin_type','finish','description','shades','stores','dupes'];
export function databaseId(id,type){if(type!=='uuid')return id;const h=createHash('md5').update(id).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function prepareSeed(products,definition){
 if(!validateCatalog(products).valid)throw new Error('Catalog validation failed; no database writes attempted.');
 const columns=definition?.properties;
 if(!columns?.id||!columns.catalog_id||!columns.catalog_data)throw new Error('Missing id/catalog_id/catalog_data columns. Run supabase/catalog-schema.sql first.');
 const jsonFields=['skin_type','description','shades','stores','dupes','catalog_data'];
 for(const key of jsonFields){const column=columns[key];if(column&&!['jsonb','json'].includes(column.format))throw new Error(`${key} must be JSONB (not a JSON-encoded text column). Run the schema setup/review existing column types.`);}
 const idType=columns.id.format==='uuid'?'uuid':'text';
 return products.map(p=>{
  const row={id:databaseId(p.id,idType),catalog_id:p.id,catalog_data:structuredClone(p)};
  for(const key of Object.keys(p))if(key!=='id'&&columns[key])row[key]=structuredClone(p[key]);
  return row;
 });
}
export async function seedCatalog(config,products,{fetcher=fetch,dryRun=false}={}){
 const headers={apikey:config.key,Accept:'application/json',...(config.key.split('.').length===3?{Authorization:'Bearer '+config.key}:{})};
 const schema=await fetcher(new URL('/rest/v1/',config.url),{headers,signal:AbortSignal.timeout(20000)});
 const definition=schema.ok?(await schema.json()).definitions?.products:await inspectReadableColumns(config,products,fetcher,headers);
 const rows=prepareSeed(products,definition);
 if(dryRun)return {mode:'dry-run',products:rows.length,written:0};
 // Preserve existing database primary keys (and their foreign-key relationships).
 const ids=new Map();let offset=0;
 for(;;){const lookup=new URL('/rest/v1/products',config.url);lookup.searchParams.set('select','id,catalog_id');lookup.searchParams.set('order','id.asc');lookup.searchParams.set('limit','500');lookup.searchParams.set('offset',String(offset));const existing=await fetcher(lookup,{headers,signal:AbortSignal.timeout(20000)});if(!existing.ok)throw new Error('Cannot verify existing product identities; no writes attempted.');const page=await existing.json();if(!Array.isArray(page))throw new Error('Invalid identity response; no writes attempted.');for(const row of page)if(row.catalog_id)ids.set(row.catalog_id,row.id);offset+=page.length;if(!page.length||(!existing.headers.get('content-range')&&page.length<500))break;if(offset>20000)throw new Error('Identity lookup exceeds catalog limit; no writes attempted.');}
 for(const row of rows)if(ids.has(row.catalog_id))row.id=ids.get(row.catalog_id);
 const endpoint=new URL('/rest/v1/products',config.url);endpoint.searchParams.set('on_conflict','catalog_id');
 const response=await fetcher(endpoint,{method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows),signal:AbortSignal.timeout(60000)});
 if(!response.ok){let code='';try{code=(await response.json()).code||''}catch{/* Do not print server responses that could contain credentials. */}throw new Error(`Seed rejected (HTTP ${response.status}${code?`, ${code}`:''}). No anonymous write policy was added. Run the exported seed SQL as project owner or supply a CLI-only elevated key through your environment.`);}
 const returned=await response.json();if(!Array.isArray(returned)||returned.length!==products.length)throw new Error('Database write response did not confirm every product. Verify database contents before rerunning.');
 const restored=returned.map(decodeProductRow);
 for(const original of products){const actual=restored.find(p=>p.id===original.id);if(!actual)throw new Error('Seed response identity validation failed.');for(const key of Object.keys(original))if(JSON.stringify(sortJSON(original[key]))!==JSON.stringify(sortJSON(actual[key])))throw new Error(`Seed verification failed for ${original.id}.${key}; database transforms need review.`);}
 return {mode:'seed',products:products.length,written:returned.length,verified:true};
}
function sortJSON(value){if(Array.isArray(value))return value.map(sortJSON);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sortJSON(value[k])]));return value;}
export function exportSeedSQL(products,schemaSQL){
 if(!validateCatalog(products).valid)throw new Error('Invalid catalog');
 const data=JSON.stringify(products).replaceAll("'","''");
 const columns=['id','catalog_id','catalog_data',...CORE_FIELDS];
 return `-- Generated from data/products.json; review and run as project owner.\nbegin;\n${schemaSQL}\ninsert into public.products (${columns.join(',')})\nselect ${columns.map(c=>'r.'+c).join(',')}\nfrom jsonb_array_elements('${data}'::jsonb) as entry(data)\ncross join lateral jsonb_populate_record(null::public.products, entry.data || jsonb_build_object(\n 'id',case when pg_typeof((null::public.products).id)::text='uuid' then to_jsonb(md5(entry.data->>'id')::uuid) else to_jsonb(entry.data->>'id') end,\n 'catalog_id',entry.data->>'id','catalog_data',entry.data)) as r\non conflict (catalog_id) do update set ${columns.filter(c=>c!=='id'&&c!=='catalog_id').map(c=>c+'=excluded.'+c).join(',')};\ncommit;\n`;
}

// New Supabase publishable keys cannot read the root OpenAPI endpoint. Inspect
// only the authorized products endpoint with read-only, zero-row selections.
async function inspectReadableColumns(config,products,fetcher,headers){
 const names=[...new Set(['id','catalog_id','catalog_data',...products.flatMap(p=>Object.keys(p))])].filter(k=>/^[a-z_][a-z0-9_]*$/.test(k));
 const request=async select=>{const url=new URL('/rest/v1/products',config.url);url.searchParams.set('select',select);url.searchParams.set('limit','0');return fetcher(url,{headers,signal:AbortSignal.timeout(20000)});};
 for(let count=0;count<100;count++){
  const response=await request(names.join(','));if(response.ok)break;
  let error;try{error=await response.json()}catch{throw new Error(`Cannot inspect readable products columns (HTTP ${response.status}); no writes attempted.`)}
  const missing=error.code==='42703'&&error.message?.match(/column products\.([a-z_][a-z0-9_]*) does not exist/);
  if(!missing||!names.includes(missing[1]))throw new Error(`Cannot inspect readable products columns (HTTP ${response.status}); no writes attempted.`);
  names.splice(names.indexOf(missing[1]),1);
 }
 const properties=Object.fromEntries(names.map(name=>[name,{format:'text'}]));
 if(!properties.catalog_data||!properties.catalog_id)return {properties};
 const nested=['skin_type','description','shades','stores','dupes','catalog_data'].filter(k=>properties[k]);
 const jsonCheck=await request(nested.map(k=>`probe_${k}:${k}->shiny_type_probe`).join(','));
 if(!jsonCheck.ok)throw new Error('Nested product columns must support JSON/JSONB. Review supabase/catalog-schema.sql; no writes attempted.');
 for(const key of nested)properties[key].format='jsonb';
 const idUrl=new URL('/rest/v1/products',config.url);idUrl.searchParams.set('select','id');idUrl.searchParams.set('limit','0');idUrl.searchParams.set('id','eq.'+products[0].id);
 const idCheck=await fetcher(idUrl,{headers,signal:AbortSignal.timeout(20000)});
 if(!idCheck.ok){const error=await idCheck.json();if(error.code==='22P02'&&error.message?.includes('uuid'))properties.id.format='uuid';else throw new Error('Unsupported database primary key type; no writes attempted.');}
 return {properties};
}

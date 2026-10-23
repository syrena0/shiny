import {test,expect} from './test-base';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fetchSupabaseProducts,supabaseConfig,decodeProductRow} from '../src/lib/supabase-catalog';
import {prepareSeed,seedCatalog,databaseId,exportSeedSQL} from '../scripts/lib/supabase-seed.mjs';
const seed=JSON.parse(readFileSync(new URL('../data/products.json',import.meta.url),'utf8'));
const config={url:'https://catalog.fixture.test',key:'sb_publishable_TEST_ONLY'};
const definition={properties:{id:{format:'uuid'},catalog_id:{format:'text'},catalog_data:{format:'jsonb'},...Object.fromEntries(['skin_type','description','shades','stores','dupes'].map(k=>[k,{format:'jsonb'}]))}};
function fixture(id='remote-product'){return {...structuredClone(seed[0]),id,name:'REMOTE DATABASE PRODUCT',price_azn:12.34,offers:[],dupes:[]}}
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
test('seed preserves JSONB objects, arrays, prices and every extra field; UUID rows retain original catalog ids',()=>{
 const rows=prepareSeed(seed,definition);expect(rows).toHaveLength(70);expect(rows[0].skin_type).toEqual(seed[0].skin_type);expect(typeof rows[0].description).toBe('object');expect(Array.isArray(rows[0].shades)).toBe(true);expect(rows[0].catalog_data.offers).toEqual(seed[0].offers);expect(rows[0].id).toMatch(/^[a-f0-9]{8}-[a-f0-9-]{27}$/);expect(databaseId(seed[0].id,'uuid')).toBe(rows[0].id);expect(decodeProductRow(rows[0])).toMatchObject(seed[0]);expect(decodeProductRow({...rows[0],size:null})).toMatchObject(seed[0]);
 expect(()=>prepareSeed(seed,{properties:{id:{format:'uuid'}}})).toThrow('catalog_data');expect(()=>prepareSeed(seed,{properties:{...definition.properties,shades:{format:'text'}}})).toThrow('JSONB');
});
test('REST seed is one atomic upsert with exact row verification and never adds anonymous write permissions',async()=>{
 const requests=[],fetcher=async(url,options)=>{requests.push({url:String(url),options});return options.method==='POST'?response(JSON.parse(options.body)):url.pathname==='/rest/v1/'?response({definitions:{products:definition}}):response([{id:'9b4c7a51-0d65-40dd-83d6-dadac628d0e9',catalog_id:seed[0].id}])};
 expect(await seedCatalog(config,seed,{fetcher})).toMatchObject({written:70,verified:true});expect(requests).toHaveLength(3);expect(requests[2].url).toContain('on_conflict=catalog_id');expect(requests[2].options.headers.Prefer).toContain('resolution=merge-duplicates');expect(requests[2].options.headers).not.toHaveProperty('Authorization');expect(JSON.parse(requests[2].options.body)[0].id).toBe('9b4c7a51-0d65-40dd-83d6-dadac628d0e9');
 let writes=0;await seedCatalog(config,seed,{dryRun:true,fetcher:async()=>{writes++;return response({definitions:{products:definition}})}});expect(writes).toBe(1);
 await expect(seedCatalog(config,seed,{fetcher:async(url,o)=>o.method==='POST'?response({code:'42501'},403):url.pathname==='/rest/v1/'?response({definitions:{products:definition}}):response([])})).rejects.toThrow('No anonymous write policy');
});
test('REST reads paginate past a server cap, reconstruct JSONB records and reject duplicates or empty RLS responses',async()=>{
 const a=fixture('a'),b=fixture('b'),calls=[];
 const products=await fetchSupabaseProducts(config,{pageSize:500,fetcher:async(url,o)=>{calls.push([String(url),o]);const offset=Number(url.searchParams.get('offset'));return offset===0?response([{id:'database-uuid',catalog_id:'a',catalog_data:a}],200,{'content-range':'0-0/*'}):offset===1?response([b],200,{'content-range':'1-1/2'}):response([])}});
 expect(products.map(p=>p.id)).toEqual(['a','b']);expect(calls).toHaveLength(2);expect(calls[1][0]).toContain('offset=1');expect(calls[0][1].headers.apikey).toBe(config.key);
 await expect(fetchSupabaseProducts(config,{fetcher:async()=>response([])})).rejects.toThrow('supabaseEmpty');await expect(fetchSupabaseProducts(config,{fetcher:async()=>response([a,a])})).rejects.toThrow('supabaseData');await expect(fetchSupabaseProducts(config,{fetcher:async()=>response({},403)})).rejects.toThrow('supabasePermission');
 expect(()=>supabaseConfig({VITE_SUPABASE_URL:config.url,VITE_SUPABASE_ANON_KEY:'sb_secret_PRIVATE'})).toThrow();const elevated='x.'+Buffer.from(JSON.stringify({role:'service_role',extra:'ÿ'})).toString('base64url')+'.x';expect(()=>supabaseConfig({VITE_SUPABASE_URL:config.url,VITE_SUPABASE_ANON_KEY:elevated})).toThrow();
});
test('database data wins over an old browser catalog and favorites survive initial asynchronous loading',async({page})=>{
 const product=fixture();await page.addInitScript(old=>{localStorage.setItem('shiny-catalog-v1',JSON.stringify(old));localStorage.setItem('shiny-language','"en"');localStorage.setItem('shiny-favorites','["remote-product"]')},seed);
 await page.route('**/rest/v1/products**',route=>route.fulfill({json:[product]}));await page.goto('/');await expect(page.locator('.product-card')).toHaveCount(1);await expect(page.locator('.product-name')).toContainText('REMOTE DATABASE PRODUCT');await expect(page.locator('.product-bottom')).toContainText('12.34');await expect(page.locator('.favorite-button')).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shiny-catalog-v1')).length)).toBe(70);await page.reload();await expect(page.locator('.product-name')).toContainText('REMOTE DATABASE PRODUCT');
});
test('empty and denied databases show an honest backup and retry recovers without redesigning the catalog',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));await page.route('**/rest/v1/products**',route=>route.fulfill({json:[]}));await page.goto('/#admin');await expect(page.locator('.database-status')).toContainText('empty or read access');await expect(page.locator('.admin-editor')).toBeVisible();await page.route('**/rest/v1/products**',route=>route.fulfill({status:403,json:{code:'42501'}}));await page.getByRole('button',{name:'Retry connection'}).click();await expect(page.locator('.database-status')).toContainText('database is unavailable');await page.route('**/rest/v1/products**',route=>route.fulfill({json:[fixture()]}));await page.getByRole('button',{name:'Retry connection'}).click();await expect(page.locator('.database-status')).toHaveCount(0);await page.getByRole('button',{name:'Back to shop'}).click();await expect(page.locator('.product-name')).toContainText('REMOTE DATABASE PRODUCT');
});
test('SQL export is a single reviewed transaction with JSONB payloads and no anonymous write policy',()=>{
 const sql=exportSeedSQL(seed,readFileSync(new URL('../supabase/catalog-schema.sql',import.meta.url),'utf8'));expect(sql).toContain('jsonb_array_elements');expect(sql).toContain('jsonb_populate_record');expect(sql).toContain('on conflict (catalog_id) do update');expect(sql).not.toMatch(/for\s+(insert|update|all)\s+to\s+anon/i);expect(sql).toContain('commit;');expect(execFileSync('git',['check-ignore','.env'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}).trim()).toBe('.env');
});
test('publishable keys can seed through read-only column probes when root OpenAPI requires a secret key',async()=>{
 let writes=0;const result=await seedCatalog(config,[fixture()],{fetcher:async(url,options)=>{
  if(url.pathname==='/rest/v1/')return response({message:'Secret API key required'},401);
  if(options.method==='POST'){writes++;return response(JSON.parse(options.body));}
  if(url.searchParams.has('id'))return response({code:'22P02',message:'invalid input syntax for type uuid'},400);
  return response([]);
 }});expect(result.verified).toBe(true);expect(writes).toBe(1);
});

import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {fetch as proxyFetch,EnvHttpProxyAgent} from 'undici';
import {supabaseConfig} from '../src/lib/supabase-catalog.js';
import {seedCatalog,exportSeedSQL} from './lib/supabase-seed.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
try{
 const products=JSON.parse(await readFile(resolve(root,'data/products.json'),'utf8'));
 const sqlIndex=args.indexOf('--export-sql');
 if(sqlIndex>=0){if(!args[sqlIndex+1]||args[sqlIndex+1].startsWith('--'))throw new Error('Provide a destination file after --export-sql.');const target=resolve(args[sqlIndex+1]);await writeFile(target,exportSeedSQL(products,await readFile(resolve(root,'supabase/catalog-schema.sql'),'utf8')));console.log(`Exported transaction for ${products.length} products to ${target}. No database connection or write was made.`);}
 else {
  const env={...loadEnv('production',root,''),...process.env};const config=supabaseConfig(env);if(!config)throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  const elevated=env.SUPABASE_SERVICE_ROLE_KEY;if(elevated)config.key=elevated;
  const dispatcher=new EnvHttpProxyAgent();let report;
  try{report=await seedCatalog(config,products,{dryRun:args.includes('--dry-run'),fetcher:(url,options)=>proxyFetch(url,{...options,dispatcher,redirect:'error'})})}finally{await dispatcher.destroy()}
 console.log(JSON.stringify(report,null,2));if(!args.includes('--dry-run'))await writeFile(resolve(root,'supabase-seed-report.json'),JSON.stringify({...report,finished_at:new Date().toISOString()},null,2)+'\n');
 }
}catch(error){console.error('Supabase migration failed:',error.message);process.exitCode=1;}

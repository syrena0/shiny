import {useEffect,useRef,useState,useCallback} from 'react';
import {readCatalog,saveCatalogData,catalogStorageIssue,seedProducts} from './catalog';
import {fetchSupabaseProducts,supabaseConfig} from './lib/supabase-catalog';
import {quarantineRejectedImages} from './lib/image-review';
export default function useProductCatalog(){
 const [settings]=useState(()=>{try{return {config:supabaseConfig(import.meta.env)}}catch{return {config:null,error:'supabaseConfig'}}});
 const [products,setProducts]=useState(()=>settings.config?[]:readCatalog());
 const [catalogIssue,setCatalogIssue]=useState(catalogStorageIssue),[status,setStatus]=useState(()=>settings.config?'loading':settings.error?'backup':'local'),[error,setError]=useState(settings.error||null),[attempt,setAttempt]=useState(0);
 const edited=useRef(false);
 useEffect(()=>{
  if(!settings.config)return;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let disposed=false;
  setStatus('loading');setError(null);
  fetchSupabaseProducts(settings.config,{signal:controller.signal}).then(remote=>{
   if(!disposed){if(!edited.current)setProducts(quarantineRejectedImages(remote));setStatus('remote');}
  }).catch(failure=>{
   if(disposed)return;
   // Never let a stale browser snapshot silently replace the public database catalog.
   if(!edited.current)setProducts(structuredClone(seedProducts));setError(failure.message);setStatus('backup');
  }).finally(()=>clearTimeout(timeout));
  return()=>{disposed=true;clearTimeout(timeout);controller.abort();};
 },[settings,attempt]);
 const saveCatalog=useCallback(next=>{saveCatalogData(next);edited.current=true;setProducts(next);setCatalogIssue(false)},[]);
 return {products,catalogIssue,status,error,saveCatalog,retry:()=>setAttempt(n=>n+1)};
}

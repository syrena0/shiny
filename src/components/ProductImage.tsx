import {useEffect,useState} from 'react';
import {Camera} from 'lucide-react';
import {calendarCopy} from '../calendarI18n';
import type {Language} from '../data/calendar';
export type CatalogImage=string|{url:string;alt?:string;sourceUrl?:string;license?:string};
export function imageUrl(asset:CatalogImage):string{return typeof asset==='string'?asset:asset.url;}
export function isPlaceholder(src?:string){return !src||/^\/products\/[^/]+\.svg$/.test(src);}
export default function ProductImage({src,alt,lang='az',className='',loading='lazy'}:{src?:string;alt:string;lang?:Language;className?:string;loading?:'lazy'|'eager'}){
 const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
 useEffect(()=>{setFailed(false);setLoaded(false)},[src]);
 const c=calendarCopy[lang];
 if(isPlaceholder(src)||failed)return <div className={`photo-placeholder ${className}`} role="img" aria-label={`${alt}: ${c.photo}`}><Camera size={27} strokeWidth={1}/><span>{c.photo}</span></div>;
 return <div className={`product-photo ${className}`} aria-busy={!loaded}>{!loaded&&<span className="photo-loading" role="status">{c.loading}</span>}<img src={src} alt={alt} loading={loading} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} style={{opacity:loaded?1:0}}/></div>;
}

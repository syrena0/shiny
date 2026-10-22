import {useEffect,useRef,useState} from 'react';
import {Camera} from 'lucide-react';
import {isPlaceholderImage} from '../lib/catalog-schema';
import {calendarCopy} from '../calendarI18n';
import type {Language} from '../data/calendar';
export type ImageAsset={url:string;detailUrl?:string;alt?:string;sourceUrl?:string;license?:string;licenseUrl?:string;author?:string;width?:number;height?:number;sources?:{url:string;width:number}[]};
export type CatalogImage=string|ImageAsset;
// Only the known bundled demo placeholders are hidden, not every SVG asset.
export function imageUrl(asset?:CatalogImage|null):string{return typeof asset==='string'?asset:asset?.url||'';}
export const isPlaceholder=isPlaceholderImage;
export default function ProductImage({src,alt,lang='az',className='',loading='lazy',sizes='(max-width: 580px) 45vw, (max-width: 800px) 38vw, 28vw'}:{src?:CatalogImage;alt:string;lang?:Language;className?:string;loading?:'lazy'|'eager';sizes?:string}){
 const asset=typeof src==='object'?src:undefined;
 const url=loading==='eager'&&asset?.detailUrl?asset.detailUrl:imageUrl(src);
 const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{setFailed(false);setLoaded(!!image.current?.complete&&image.current.naturalWidth>0)},[url]);
 const c=calendarCopy[lang];
 if(isPlaceholder(url)&&!asset?.sourceUrl||failed)return <div className={`photo-placeholder ${className}`} role="img" aria-label={`${alt}: ${c.photo}`}><Camera size={27} strokeWidth={1}/><span>{c.photo}</span></div>;
 const srcSet=loading==='eager'&&asset?.detailUrl?undefined:asset?.sources?.map(source=>`${source.url} ${source.width}w`).join(', ');
 return <div className={`product-photo ${className}`} aria-busy={!loaded}>{!loaded&&<span className="photo-loading" aria-hidden="true">{c.loading}</span>}<img ref={image} src={url} srcSet={srcSet} sizes={srcSet?sizes:undefined} width={asset?.width} height={asset?.height} alt={asset?.alt||alt} loading={loading} decoding="async" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} style={{opacity:loaded?1:0}}/></div>;
}

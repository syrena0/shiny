import {ExternalLink,Info,MapPin} from 'lucide-react';
import {comparisonOffers,type VerifiedOffer,type GeneralStore} from '../lib/offers';
import {calendarCopy} from '../calendarI18n';
import type {Language} from '../data/calendar';
import {auditCopy} from '../auditI18n';
import {money} from '../i18n';
import retailers from '../../data/retailers.json';
import {dupeCopy} from '../dupeI18n';
export default function PriceComparison({product,shade,size,lang,t}:{product:{price_azn?:number|null;offers?:VerifiedOffer[];stores:GeneralStore[]};shade:string|null;size?:string;lang:Language;t:Record<string,string>}){
 const c=calendarCopy[lang],offers=comparisonOffers(product,shade,size),copy=dupeCopy[lang];
 const storeKey=(name:string)=>name.trim().toLocaleLowerCase();
 const missingRetailers=retailers.filter(r=>!offers.some(o=>storeKey(o.name)===storeKey(r.name)));
 const availability=(v:boolean|null)=>v===true?t.inStock:v===false?t.outOfStock:c.unknown;
 return <section className="stores" id="store-comparison" tabIndex={-1} aria-label={t.stores}>
  <h3>{t.stores}</h3>
  <p className="offer-context">{c.variant}: {shade||auditCopy[lang].noShades} · {size||c.sizeUnknown}</p>
  {offers.length?<div className="verified-offers">{offers.map((s,i)=>{
   const reference=s.price_scope==='reference',general=s.price_scope!=='variant';
   const link=s.url||retailers.find(r=>storeKey(r.name)===storeKey(s.name))?.url;
   return <article className={`verified-offer ${i===0?'lowest-offer':''}`} key={s.id} data-price-scope={s.price_scope}>
    {i===0&&!general&&s.verified&&<span className="lowest-badge">{c.lowest}</span>}
    <div className="offer-top"><b>{s.name}</b><strong>{money(s.price_azn,lang)}</strong></div>
    <p>{reference?copy.reference:general?copy.generalPrice:`${s.shade||auditCopy[lang].noShades} · ${s.size}`}{general&&s.size?` · ${s.size}`:''}</p>
    {!s.verified&&<small title={reference?copy.referenceNote:undefined}>{reference?copy.referenceNote:t.sample}</small>}
    <small>{c.online}: {availability(s.online_available)} · {c.physical}: {availability(s.physical_available)}</small>
    {s.location&&<p><MapPin size={12}/>{s.location}</p>}
    <div className="offer-bottom"><small>{s.last_checked?`${t.checked}: ${s.last_checked}`:c.unknown}</small>{link&&<a href={link} target="_blank" rel="noopener noreferrer">{s.url?c.buy:copy.visitStore}<ExternalLink size={13}/></a>}</div>
   </article>;
  })}</div>:<div className="no-verified-offers"><Info size={20}/><p>{c.noOffers}</p></div>}
  <div className="pending-retailers">{missingRetailers.map(r=><article key={r.id} className="pending-retailer"><b>{r.name}</b><span>{copy.noQuote}</span><a href={r.url} target="_blank" rel="noopener noreferrer">{copy.visitStore}<ExternalLink size={12}/></a></article>)}</div>
  <p className="store-note">{offers.some(o=>o.price_scope==='reference')?copy.basePriceNote:offers.some(o=>o.price_scope==='product')?copy.generalPriceNote:c.offerNote}</p>
 </section>;
}

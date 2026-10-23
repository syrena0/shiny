import {ExternalLink,Info,MapPin} from 'lucide-react';
import {verifiedOffers,type VerifiedOffer} from '../lib/offers';
import {calendarCopy} from '../calendarI18n';
import type {Language} from '../data/calendar';
import {auditCopy} from '../auditI18n';
import {money} from '../i18n';
import retailers from '../../data/retailers.json';
import {dupeCopy} from '../dupeI18n';
type SampleStore={name:string;price_azn:number;in_stock:boolean;last_checked:string};
export default function PriceComparison({product,shade,size,lang,t}:{product:{offers?:VerifiedOffer[];stores:SampleStore[]};shade:string|null;size?:string;lang:Language;t:Record<string,string>}){
 const c=calendarCopy[lang],offers=verifiedOffers(product,shade,size),copy=dupeCopy[lang];
 const missingRetailers=retailers.filter(r=>!offers.some(o=>o.name.toLowerCase()===r.name.toLowerCase()));
 const availability=(v:boolean|null)=>v===true?t.inStock:v===false?t.outOfStock:c.unknown;
 return <section className="stores" id="store-comparison" tabIndex={-1} aria-label={t.stores}><h3>{t.stores}</h3><p className="offer-context">{c.variant}: {shade||auditCopy[lang].noShades} · {size||c.sizeUnknown}</p>{offers.length?<div className="verified-offers">{offers.map((s,i)=><article className={`verified-offer ${i===0?'lowest-offer':''}`} key={s.id}>{i===0&&<span className="lowest-badge">{c.lowest}</span>}<div className="offer-top"><b>{s.name}</b><strong>{money(s.price_azn,lang)}</strong></div><p>{s.shade||auditCopy[lang].noShades} · {s.size}</p><small>{c.online}: {availability(s.online_available)} · {c.physical}: {availability(s.physical_available)}</small>{s.location&&<p><MapPin size={12}/>{s.location}</p>}<div className="offer-bottom"><small>{t.checked}: {s.last_checked}</small><a href={s.url} target="_blank" rel="noopener noreferrer">{c.buy}<ExternalLink size={13}/></a></div></article>)}</div>:<div className="no-verified-offers"><Info size={20}/><p>{c.noOffers}</p></div>}<div className="pending-retailers">{missingRetailers.map(r=><article key={r.id} className="pending-retailer"><b>{r.name}</b><span>{copy.noQuote}</span><a href={r.url} target="_blank" rel="noopener noreferrer">{copy.visitStore}<ExternalLink size={12}/></a></article>)}</div><p className="store-note">{c.offerNote}</p>{product.stores.length>0&&<details className="sample-store-details"><summary>{t.sample} · {product.stores.length}</summary>{product.stores.map((s,i)=><div className="store-row" key={`${s.name}-${i}`}><div><b>{s.name}</b><small>{t.sample} · {s.last_checked}</small></div><strong>{money(s.price_azn,lang)}</strong></div>)}</details>}</section>;
}

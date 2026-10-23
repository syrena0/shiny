import {Sparkles,ArrowUpRight} from 'lucide-react';
import ProductImage from './ProductImage';
import {auditCopy} from '../auditI18n';
import {money} from '../i18n';
import {dupeCopy} from '../dupeI18n';
import {resolveAlternatives} from '../lib/dupes';
import {variantGallery} from '../lib/product-edit';
export default function DupeSection({product,products,t,lang,onOpen,variant}) {
 const alternatives=resolveAlternatives(product,products,variant),c=dupeCopy[lang];
 if(!alternatives.length)return null;
 return <section className="dupe-section"><h3><Sparkles size={18}/>{t.alternatives}</h3><p className="dupe-sample-label">{c.editorial}</p>{alternatives.map(({relation:d,product:p,variant:v,price})=><article className="dupe-item" key={p.id} data-alternative-id={p.id}><div className="dupe-item-top"><button className="dupe-photo" aria-label={`${t.details}: ${p.name}`} onClick={()=>onOpen(p,false,v.key)}><ProductImage src={variantGallery(p,v)[0]} alt={`${p.brand} ${p.name}${v.shade?' · '+v.shade:''}`} lang={lang}/></button><div><small>{p.brand}</small><button onClick={()=>onOpen(p,false,v.key)}>{p.name}<ArrowUpRight size={14}/></button>{v.shade&&<p className="dupe-variant">{c.shade}: {v.shade}</p>}{v.size&&<p className="dupe-variant">{c.size}: {v.size}</p>}<strong>{price.amount===null?auditCopy[lang].priceUnavailable:`${price.from?t.from+' ':''}${money(price.amount,lang)}`}</strong>{price.amount!==null&&!price.verified&&<small className="dupe-reference" title={c.referenceNote}>{c.reference}</small>}</div></div><p>{d.reason[lang]}</p><p className="dupe-difference"><b>{c.difference}: </b>{d.difference?.[lang]||c.note}</p><div className="dupe-traits">{p.finish&&<span>{t[p.finish]}</span>}<span>{c.notMeasured}</span></div>{d.sources?.length>0&&<details className="dupe-sources"><summary>{c.source}</summary>{d.sources.map((s,i)=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{i+1}. {s.name} ↗</a>)}</details>}<button className="card-compare" onClick={()=>onOpen(p,true,v.key)}>{t.stores}<ArrowUpRight size={14}/></button></article>)}</section>;
}

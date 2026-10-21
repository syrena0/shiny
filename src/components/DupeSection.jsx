import {Sparkles,ArrowUpRight} from 'lucide-react';
import {money} from '../i18n';
export default function DupeSection({product,products,t,lang,onOpen}) {
 if(!product.dupes.length)return null;
 return <section className="dupe-section"><h3><Sparkles size={18}/>{t.alternatives}</h3>{product.dupes.map(d=>{const p=products.find(p=>p.id===d.dupe_product_id); if(!p)return null;return <div className="dupe-item" key={p.id}><div className="dupe-item-top"><img src={p.image} alt={p.name}/><div><small>{p.brand}</small><button onClick={()=>onOpen(p)}>{p.name}<ArrowUpRight size={14}/></button><strong>{money(p.price_azn,lang)}</strong></div><span className="match-pill">{d.match_percentage}%<small>{t.match}</small></span></div><p>{d.reason[lang]}</p><div className="dupe-traits"><span>{t[p.finish]}</span><span>{t[p.shades[0].undertone]}</span><b>{money(product.price_azn-p.price_azn,lang)} {t.save}</b></div></div>})}</section>
}

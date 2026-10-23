import {useState} from 'react';
import {Heart,Star,ArrowUpRight,Sparkles} from 'lucide-react';
import ProductImage from './ProductImage';
import {defaultVariant,productVariants,variantPrice} from '../lib/pricing';
import {importCopy} from '../importI18n';
import {auditCopy} from '../auditI18n';
import {brandTier} from '../lib/product-traits';
import {money} from '../i18n';
export default function ProductCard({product:p,t,lang,favorite,toggleFavorite,onOpen}) {
 const premium=brandTier(p)==='premium';
 const variants=productVariants(p);const [variantKey,setVariantKey]=useState(()=>defaultVariant(p).key);
 const variant=variants.find(v=>v.key===variantKey)||defaultVariant(p),price=variantPrice(p,variant),amount=price.amount;
 const primary=variant.images?.[0]||variant.image||(variant.key===defaultVariant(p).key?(p.images?.[0]||p.image):'');
 const a=auditCopy[lang],c=importCopy[lang];
 return <article className="product-card" data-product-id={p.id}><div className={'product-image '+(premium?'premium-image':'affordable-image')}><span className={'tier-tag '+(!premium?'budget':'')}>{premium?t.premium:t.affordable}</span><button className={'favorite-button '+(favorite?'selected':'')} aria-label={favorite?t.removeFavorite:t.addFavorite} aria-pressed={favorite} onClick={()=>toggleFavorite(p.id)}><Heart size={17} fill={favorite?'currentColor':'none'}/></button><button className="image-open" aria-label={`${t.details}: ${p.name}`} onClick={()=>onOpen(p,false,variant.key)}><ProductImage src={primary} alt={`${p.brand} ${p.name}`} lang={lang}/></button>{p.dupes.length>0&&<span className="dupe-badge"><Sparkles size={12}/>{t.dupeAvailable}</span>}</div><div className="product-info"><div className="product-meta"><span>{p.brand}</span>{Number.isFinite(p.rating)&&<span className="rating"><Star size={11} fill="currentColor"/>{p.rating.toFixed(1)}</span>}</div><button className="product-name" onClick={()=>onOpen(p,false,variant.key)}>{p.name}</button><div className="shade-dots">{p.shades.map(s=><button key={s.name} aria-label={s.name} aria-pressed={variant.shade===s.name} title={s.name} className="card-shade" style={{background:s.hex||'#e8e2d9'}} onClick={()=>setVariantKey(variants.find(v=>v.shade===s.name)?.key||variant.key)}/>)}{p.shades.length>0&&<span className="more-shades">{p.shades.length}</span>}<span className="category-label">{t[p.category]}</span></div>{(variant.shade||variant.size)&&<p className="card-variant">{[variant.shade,variant.size].filter(Boolean).join(' · ')}</p>}<div className="product-bottom"><div>{amount!==null&&<small>{price.from?t.from:price.verified?'':c.reference}</small>}<strong className={amount===null?'unknown-price':undefined}>{amount===null?a.priceUnavailable:money(amount,lang)}</strong></div><button className="card-compare" aria-label={`${c.compare}: ${p.name}`} onClick={()=>onOpen(p,true,variant.key)}>{c.compare}<ArrowUpRight size={15}/></button></div></div></article>
}

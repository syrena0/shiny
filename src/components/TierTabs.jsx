import {brandTier} from '../lib/product-traits';
export default function TierTabs({products,t,filters,setFilters}){
 const selected=filters.tier.length===1?filters.tier[0]:'all';
 return <div className="tier-tabs" role="group" aria-label={t.tier}>{['all','premium','affordable'].map(key=><button key={key} aria-pressed={key===selected} className={key===selected?'selected':''} onClick={()=>setFilters(f=>({...f,tier:key==='all'?[]:[key]}))}>{t[key]} <small>{key==='all'?products.length:products.filter(p=>brandTier(p)===key).length}</small></button>)}</div>;
}

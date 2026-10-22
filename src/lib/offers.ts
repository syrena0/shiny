import {isCalendarDate,isHttpsUrl} from './catalog-schema';
export interface VerifiedOffer {
 market:'AZ';currency:'AZN';id:string;name:string;shade:string|null;size:string;price_azn:number;verified:true;
 url:string;sourceUrl:string;last_checked:string;online_available:boolean|null;
 physical_available:boolean|null;location?:string;
}
function validOffer(o:VerifiedOffer,now=new Date()):boolean{
 return !!o&&o.verified===true&&o.market==='AZ'&&o.currency==='AZN'&&typeof o.name==='string'&&!!o.name.trim()&&
  typeof o.id==='string'&&!!o.id.trim()&&(o.shade===null||typeof o.shade==='string'&&!!o.shade.trim())&&typeof o.size==='string'&&!!o.size.trim()&&
  Number.isFinite(o.price_azn)&&o.price_azn>=0&&isHttpsUrl(o.url)&&isHttpsUrl(o.sourceUrl)&&
  isCalendarDate(o.last_checked)&&new Date(o.last_checked+'T00:00:00Z')<=now&&
  (o.online_available===null||typeof o.online_available==='boolean')&&(o.physical_available===null||typeof o.physical_available==='boolean');
}
export function allVerifiedOffers(product:{offers?:VerifiedOffer[]}):VerifiedOffer[]{
 const ids=new Set<string>();
 return (product.offers||[]).filter(o=>{if(!validOffer(o)||ids.has(o.id))return false;ids.add(o.id);return true;});
}
export function verifiedOffers(product:{offers?:VerifiedOffer[]},shade?:string|null,size?:string):VerifiedOffer[]{
 if(shade===undefined||!size)return [];
 return allVerifiedOffers(product).filter(o=>o.shade===shade&&o.size===size).sort((a,b)=>a.price_azn-b.price_azn);
}
export function catalogPrice(product:{price_azn:number|null;offers?:VerifiedOffer[]}):number|null{
 const offers=allVerifiedOffers(product);
 return offers.length?Math.min(...offers.map(offer=>offer.price_azn)):product.price_azn;
}

export interface VerifiedOffer {
 market:'AZ';currency:'AZN';id:string;name:string;shade:string;size:string;price_azn:number;verified:true;
 url:string;sourceUrl:string;last_checked:string;online_available:boolean|null;
 physical_available:boolean|null;location?:string;
}
export function verifiedOffers(product:{offers?:VerifiedOffer[]},shade?:string,size?:string):VerifiedOffer[]{
 if(!shade||!size)return [];
 return (product.offers||[]).filter(o=>o.verified===true&&o.market==='AZ'&&o.currency==='AZN'&&o.shade===shade&&o.size===size&&o.name&&o.id&&
  Number.isFinite(o.price_azn)&&o.price_azn>=0&&/^https:\/\//.test(o.url)&&/^https:\/\//.test(o.sourceUrl)&&
  /^\d{4}-\d{2}-\d{2}$/.test(o.last_checked)&&new Date(o.last_checked)<=new Date()).sort((a,b)=>a.price_azn-b.price_azn);
}
export function allVerifiedOffers(product:{offers?:VerifiedOffer[]}):VerifiedOffer[]{
 return (product.offers||[]).filter(o=>verifiedOffers(product,o.shade,o.size).some(v=>v.id===o.id));
}

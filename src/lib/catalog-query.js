import {allVerifiedOffers} from './offers';
import {dictionaries,premiumBrands} from '../i18n';
export const PAGE_SIZE=18;
export function normalizedSearch(value){return String(value).normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/ı/g,'i').replace(/\s+/g,' ').trim();}
export function indexCatalog(products){return products.map(product=>{
 const offers=allVerifiedOffers(product);
 return {product,search:normalizedSearch([product.name,product.brand,product.category,...Object.values(product.description),...product.shades.map(s=>s.name),...Object.values(dictionaries).map(d=>d[product.category])].join(' ')),
 offers,price:offers.length?Math.min(...offers.map(o=>o.price_azn)):product.price_azn,tier:product.brand_tier||(premiumBrands.includes(product.brand)?'premium':'affordable')};
});}
export function queryCatalog(index,{view='discover',favorites=[],category='all',query='',filters,sort='recommended'}){
 const terms=normalizedSearch(query).split(' ').filter(Boolean),favoriteIds=new Set(favorites);
 const activePrice=filters.min!==''||filters.max!=='';
 return index.filter(({product:p,search,offers,tier,price})=>
  (view!=='favorites'||favoriteIds.has(p.id))&&(view!=='dupes'||p.dupes.length>0)&&
  (category==='all'||p.category===category)&&terms.every(term=>search.includes(term))&&
  (filters.productType==='all'||(filters.productType==='skincare')===['moisturizer','makeup_remover'].includes(p.category))&&
  (!filters.brands.length||filters.brands.includes(p.brand))&&(!filters.stores.length||offers.some(o=>filters.stores.includes(o.name)))&&
  (filters.availability==='all'||(filters.availability==='inStock'?offers.some(o=>o.online_available===true||o.physical_available===true):filters.availability==='outOfStock'?offers.some(o=>o.online_available===false&&o.physical_available===false):!offers.length))&&
  (!activePrice||price!==null)&&
  (filters.min===''||price>=Number(filters.min))&&(filters.max===''||price<=Number(filters.max))&&
  (!filters.skin.length||filters.skin.some(s=>p.skin_type.includes(s)))&&(!filters.tier.length||filters.tier.includes(tier))
 ).sort((a,b)=>{
  if(sort==='priceAsc'||sort==='priceDesc'){
   if(a.price===null)return b.price===null?0:1;if(b.price===null)return -1;
   return sort==='priceAsc'?a.price-b.price:b.price-a.price;
  }
  return sort==='topRated'?(b.product.rating??-1)-(a.product.rating??-1):0;
 }).map(row=>row.product);
}

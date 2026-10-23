import {allVerifiedOffers,catalogPrice} from './pricing';
import {isPlaceholderImage} from './catalog-schema';
import {brandTier} from './product-traits';
import {careCopy} from '../careI18n';
import {dictionaries} from '../i18n';
export const PAGE_SIZE=18;
export function normalizedSearch(value){return String(value).normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/ı/g,'i').replace(/\s+/g,' ').trim();}
export function indexCatalog(products){return products.map(product=>{
 const offers=allVerifiedOffers(product);
 return {product,search:normalizedSearch([product.name,product.brand,product.category,...Object.values(product.description),...product.shades.map(s=>s.name),...Object.values(dictionaries).flatMap(d=>[d[product.category],d[product.finish],...product.skin_type.map(s=>d[s])]),...Object.values(careCopy).map(d=>d[product.coverage])].join(' ')),
 offers,price:catalogPrice(product),tier:brandTier(product)};
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
  (!filters.finish?.length||filters.finish.includes(p.finish))&&(!filters.coverage?.length||filters.coverage.includes(p.coverage))&&
  (!filters.skin.length||filters.skin.some(s=>p.skin_type.includes(s)))&&(!filters.tier.length||filters.tier.includes(tier))
 ).sort((a,b)=>{
  if(sort==='priceAsc'||sort==='priceDesc'){
   if(a.price===null)return b.price===null?0:1;if(b.price===null)return -1;
   return sort==='priceAsc'?a.price-b.price:b.price-a.price;
  }
  return sort==='topRated'?(b.product.rating??-1)-(a.product.rating??-1):Number(!isPlaceholderImage(b.product.image))-Number(!isPlaceholderImage(a.product.image));
 }).map(row=>row.product);
}

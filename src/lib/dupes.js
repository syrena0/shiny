import {brandTier} from './product-traits.js';
import {defaultVariant,productVariants,variantPrice} from './pricing.js';
export function resolveAlternatives(product,products,selectedVariant=defaultVariant(product)){
 if(brandTier(product)!=='premium')return [];
 const byId=products instanceof Map?products:new Map(products.map(p=>[p.id,p]));
 return (product.dupes||[]).flatMap(relation=>{
  const alternative=byId.get(relation.dupe_product_id);
  if(!alternative||alternative.id===product.id||brandTier(alternative)!=='affordable'||alternative.category!==product.category)return [];
  if(relation.premium_shade&&relation.premium_shade!==selectedVariant.shade)return [];
  const variant=relation.alternative_shade?productVariants(alternative).find(v=>v.shade===relation.alternative_shade&&(!relation.alternative_size||v.size===relation.alternative_size)):defaultVariant(alternative);
  if(!variant)return [];
  return [{relation,product:alternative,variant,price:variantPrice(alternative,variant)}];
 });
}

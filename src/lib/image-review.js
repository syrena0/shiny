import {isPlaceholderImage} from './catalog-schema.js';
import {defaultVariant,variantPrice} from './pricing.js';
export function imageStatus(product){
 const variant=defaultVariant(product),assets=variant.images?.length?variant.images:variant.shade===product.default_shade||!variant.shade?product.images:[];
 const asset=assets?.[0];const url=typeof asset==='string'?asset:asset?.url||variant.image||product.image;
 if(isPlaceholderImage(url))return 'missing';
 return asset?.review?.status==='approved'?'ready':'pending';
}
export function verificationReport(products){return products.map(p=>({id:p.id,brand:p.brand,name:p.name,image_status:imageStatus(p),price_status:variantPrice(p).amount===null?'missing':variantPrice(p).verified?'verified':'reference',reviews:p.image_reviews||[]}));}
export function quarantineRejectedImages(products){return products.map(p=>{
 const copy=structuredClone(p);
 for(const target of [copy,...copy.shades,...(copy.variants||[])]){
  const old=target.image;if(old&&isPlaceholderImage(old)){target.image='';target.images=(target.images||[]).filter(asset=>!isPlaceholderImage(typeof asset==='string'?asset:asset.url));}
  else if(target.images)target.images=target.images.filter(asset=>!isPlaceholderImage(typeof asset==='string'?asset:asset.url));
 }
 return copy;
});}

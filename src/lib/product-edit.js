import {defaultVariant,productVariants} from './pricing.js';
const clone=value=>structuredClone(value);
const assetURL=a=>typeof a==='string'?a:a?.url||'';
export function variantGallery(product,variant=defaultVariant(product)){
 if(variant.images?.length)return variant.images;
 if(variant.image)return [variant.image];
 return variant.key===defaultVariant(product).key?(product.images?.length?product.images:product.image?[product.image]:[]):[];
}
export function primaryProductImage(product){return product?variantGallery(product)[0]:undefined;}
const replaceImage=(target,value)=>{target.image=value;target.images=value?[value]:[];};
export function editMainImage(input,value){
 const product=clone(input),variant=defaultVariant(product);replaceImage(product,value);
 if(product.variants?.length){const target=product.variants.find(v=>v.id===variant.key);if(target)replaceImage(target,value);}
 const shade=product.shades.find(s=>s.name===variant.shade);if(shade)replaceImage(shade,value);
 product.image_override={scope:'default-variant',variant_key:variant.key};
 return product;
}
export function editShadeField(input,index,key,value,variantKey){
 const product=clone(input),shade=product.shades[index];if(!shade)return product;
 const oldName=shade.name,options=productVariants(product).filter(v=>v.shade===oldName);
 const selected=options.find(v=>v.key===variantKey)||options.find(v=>v.key===product.default_variant)||options[0];
 const target=product.variants?.find(v=>v.id===selected?.key);
 const defaultKey=defaultVariant(product).key;
 if(key==='name'){
  shade.name=value;for(const v of product.variants||[])if(v.shade===oldName)v.shade=value;
  if(product.default_shade===oldName)product.default_shade=value;
 }else if(key==='image'){
  if(target)replaceImage(target,value);
  // The shade-level gallery describes its first/default size, never every size at once.
  if(!target||selected?.key===options[0]?.key)replaceImage(shade,value);
  if(selected?.key===defaultKey)replaceImage(product,value);
 }else if(['price_azn','size','gtin'].includes(key)){
  if(target)target[key]=value;else shade[key]=value;
 }else shade[key]=value;
 return product;
}
export function addProductShade(input,name){
 const product=clone(input);product.shades.push({name,hex:null,undertone:'unknown'});
 if(product.variants)product.variants.push({id:'manual-'+crypto.randomUUID(),shade:name,image:'',images:[]});
 return product;
}
export function removeProductShade(input,index){
 const product=clone(input),name=product.shades[index]?.name,wasDefault=defaultVariant(product).shade===name;
 product.shades=product.shades.filter((_,i)=>i!==index);
 if(product.variants){product.variants=product.variants.filter(v=>v.shade!==name);if(!product.variants.length)delete product.variants;}
 if(product.default_shade===name)delete product.default_shade;
 if(product.default_variant&&!product.variants?.some(v=>v.id===product.default_variant))delete product.default_variant;
 if(wasDefault){if(product.pricing_scope!=='all_variants')product.price_azn=null;if(!product.shades.length&&!product.variants?.length){replaceImage(product,'');return product;}const next=defaultVariant(product);product.default_shade=next.shade||undefined;const image=next.image||assetURL(next.images?.[0]);replaceImage(product,image);if(next.images?.length)product.images=clone(next.images);}
 return product;
}

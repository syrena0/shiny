import {quarantineRejectedImages} from './lib/image-review';
import {validateCatalog,isImageUrl,isPlaceholderImage} from './lib/catalog-schema';
import seedProducts from '../data/products.json' with {type:'json'};
import photoMigration from '../data/photo-migration.json' with {type:'json'};
export const CATALOG_KEY = 'shiny-catalog-v1';
export {seedProducts};
export function readCatalog() {
  try {
    const raw=localStorage.getItem(CATALOG_KEY);
    if(raw!==null){const saved=JSON.parse(raw);if(validateCatalog(saved).valid)return quarantineRejectedImages(reconcileBundledPhotos(saved));}
  } catch { /* Preserve corrupt/unavailable storage; fall back without overwriting user data. */ }
  return structuredClone(seedProducts);
}
export const safeImage=isImageUrl;
export function saveCatalogData(products){
 const result=validateCatalog(products);if(!result.valid)throw new Error('invalidCatalog');
 localStorage.setItem(CATALOG_KEY,JSON.stringify(products));
}
export async function uploadImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('imageType');
  if (file.size > 8 * 1024 * 1024) throw new Error('imageSize');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', .82);
  } finally { URL.revokeObjectURL(url); }
}

export function catalogStorageIssue(){
 try{const raw=localStorage.getItem(CATALOG_KEY);if(raw===null)return false;try{return !validateCatalog(JSON.parse(raw)).valid;}catch{return true;}}catch{return false;}
}

function legacyFingerprint(value){
 let hash=2166136261;const text=JSON.stringify(value);
 for(let index=0;index<text.length;index++)hash=Math.imul(hash^text.charCodeAt(index),16777619)>>>0;
 return hash.toString(16).padStart(8,'0');
}
export function reconcileBundledPhotos(saved){
 const savedById=new Map(saved.map(p=>[p.id,p]));
 // Upgrade only legacy full-catalog snapshots, not an intentionally separate imported catalog.
 if(!photoMigration.legacy_ids.every(id=>savedById.has(id)))return saved;
 const defaults=new Map(seedProducts.map(p=>[p.id,p]));
 const reconciled=seedProducts.map(product=>{
  const previous=savedById.get(product.id);if(!previous)return structuredClone(product);
  const baseline=photoMigration.fields[product.id];
  const customImage=!isPlaceholderImage(previous.image)||(previous.images||[]).some(asset=>!isPlaceholderImage(typeof asset==='string'?asset:asset.url));
  if(!baseline||customImage||isPlaceholderImage(product.image)||legacyFingerprint(previous.brand)!==baseline.brand||legacyFingerprint(previous.name)!==baseline.name)return previous;
  const updated={...previous,image:product.image,images:structuredClone(product.images),provenance:structuredClone(product.provenance),gtin:product.gtin};
  for(const [field,fingerprint] of Object.entries(baseline))if(legacyFingerprint(previous[field])===fingerprint)updated[field]=structuredClone(product[field]);
  if(legacyFingerprint(previous.shades)===baseline.shades){if(product.default_shade)updated.default_shade=product.default_shade;else delete updated.default_shade;}
  if(product.size&&!previous.size)updated.size=product.size;
  return updated;
 });
 for(const previous of saved)if(!defaults.has(previous.id))reconciled.push(previous);
 return validateCatalog(reconciled).valid?reconciled:saved;
}

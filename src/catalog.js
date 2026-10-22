import {validateCatalog,isImageUrl} from './lib/catalog-schema';
import seedProducts from '../data/products.json';
export const CATALOG_KEY = 'shiny-catalog-v1';
export {seedProducts};
export function readCatalog() {
  try {
    const raw=localStorage.getItem(CATALOG_KEY);
    if(raw!==null){const saved=JSON.parse(raw);if(validateCatalog(saved).valid)return saved;}
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

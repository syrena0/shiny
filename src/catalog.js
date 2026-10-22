import seedProducts from '../data/products.json';
export const CATALOG_KEY = 'shiny-catalog-v1';
export {seedProducts};
export function readCatalog() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATALOG_KEY));
    // Only accept a complete catalog with our known product IDs and structure.
    if (Array.isArray(saved) && saved.length === seedProducts.length &&
      seedProducts.every(p => saved.some(s => s.id === p.id)) &&
      saved.every(p => typeof p.name === 'string' && typeof p.brand === 'string' &&
        Number.isFinite(p.price_azn) && p.price_azn >= 0 && typeof p.image === 'string' &&
        Array.isArray(p.shades) && p.shades.length > 0 && p.shades.every(s => /^#[0-9a-f]{6}$/i.test(s.hex)) &&
        Array.isArray(p.stores) && Array.isArray(p.dupes) && p.description && Array.isArray(p.skin_type))) return saved;
  } catch { /* Fall back to the bundled catalog when browser storage is unavailable. */ }
  return structuredClone(seedProducts);
}
export function safeImage(value) {
  return /^https:\/\/[^\s]+$/i.test(value) || /^\/products\/[\w.-]+$/.test(value) || /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value);
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

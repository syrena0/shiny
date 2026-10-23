const normalize=name=>String(name).normalize('NFKD').toLowerCase().replace(/\p{M}|[^a-z0-9]/gu,'');
const premium=new Set(['Fenty Beauty','Fenty','Rare Beauty','Dior','NARS','Charlotte Tilbury','MAC','MAC Cosmetics','Clarins','Lancôme','Estée Lauder','Clinique','Chanel','Yves Saint Laurent','Armani Beauty','Shiseido','Benefit','Hourglass','Pat McGrath Labs'].map(normalize));
export function brandTier(product){return product.brand_tier|| (premium.has(normalize(product.brand))?'premium':'affordable');}
export const COVERAGES=['light','medium','full'];
export const FINISHES=['natural','radiant','glossy','matte'];

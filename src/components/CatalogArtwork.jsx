import ProductImage from './ProductImage';
import {primaryProductImage} from '../lib/product-edit';
export const ART_PRODUCTS={oil:'obf-0609332820050',lipstick:'obf-0773602544172',concealer:'obf-0800897129781',liquidLip:'obf-0800897003968'};
export default function CatalogArtwork({products,id,className,lang}){
 const product=products.find(p=>p.id===id);
 return <ProductImage src={primaryProductImage(product)} alt={product?`${product.brand} ${product.name}`:''} className={className} lang={lang} loading="eager"/>;
}

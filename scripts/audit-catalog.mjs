import {readFile,writeFile} from 'node:fs/promises';
import {priceAudit} from '../src/lib/pricing.js';
import {verificationReport} from '../src/lib/image-review.js';
const url=new URL('../data/products.json',import.meta.url),products=JSON.parse(await readFile(url,'utf8'));
const prices=priceAudit(products),images=verificationReport(products);
const report={generated_at:new Date().toISOString(),products:products.length,verified_price_products:prices.filter(p=>p.verified).length,reference_price_products:prices.filter(p=>p.amount!==null&&!p.verified).length,price_unavailable:prices.filter(p=>p.amount===null).map(p=>({id:p.id,brand:p.brand,name:p.name,reason:'No verified AZN offer or catalog reference price'})),approved_primary_images:images.filter(p=>p.image_status==='ready').length,image_attention:images.filter(p=>p.image_status!=='ready').map(p=>({id:p.id,brand:p.brand,name:p.name,status:p.image_status}))};
if(process.argv.includes('--write'))await writeFile(new URL('../data/verification-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

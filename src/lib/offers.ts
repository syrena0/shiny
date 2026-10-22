export interface VerifiedOffer {
 market:'AZ';currency:'AZN';id:string;name:string;shade:string|null;size:string;price_azn:number;verified:true;
 url:string;sourceUrl:string;last_checked:string;online_available:boolean|null;
 physical_available:boolean|null;location?:string;
}
import * as pricing from './pricing.js';
export const allVerifiedOffers=pricing.allVerifiedOffers as (product:{offers?:VerifiedOffer[]})=>VerifiedOffer[];
export const verifiedOffers=pricing.verifiedOffers as (product:{offers?:VerifiedOffer[]},shade?:string|null,size?:string)=>VerifiedOffer[];
export const catalogPrice=pricing.catalogPrice as (product:{price_azn:number|null;offers?:VerifiedOffer[]})=>number|null;

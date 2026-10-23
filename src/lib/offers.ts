export interface VerifiedOffer {
 market:'AZ';currency:'AZN';id:string;name:string;shade:string|null;size:string;price_azn:number;verified:true;
 url:string;sourceUrl:string;last_checked:string;online_available:boolean|null;
 physical_available:boolean|null;location?:string;
}
import * as pricing from './pricing.js';
export const allVerifiedOffers=pricing.allVerifiedOffers as (product:{offers?:VerifiedOffer[]})=>VerifiedOffer[];
export const verifiedOffers=pricing.verifiedOffers as (product:{offers?:VerifiedOffer[]},shade?:string|null,size?:string)=>VerifiedOffer[];
export const catalogPrice=pricing.catalogPrice as (product:{price_azn:number|null;offers?:VerifiedOffer[]})=>number|null;

export type GeneralStore={name:string;price_azn:number;in_stock:boolean;last_checked:string;url?:string};
export type ComparisonOffer=Omit<VerifiedOffer,'verified'|'shade'|'size'|'url'|'sourceUrl'|'last_checked'> & {
 verified:boolean;shade?:string|null;size?:string;url:string|null;price_scope:'variant'|'product'|'reference'|'demo';sourceUrl?:string;last_checked?:string;
};
export const comparisonOffers=pricing.comparisonOffers as (product:{price_azn?:number|null;offers?:VerifiedOffer[];stores?:GeneralStore[]},shade?:string|null,size?:string)=>ComparisonOffer[];

export const demoComparisonOffers=pricing.demoComparisonOffers as typeof comparisonOffers;

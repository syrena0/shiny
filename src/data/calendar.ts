export type Language='az'|'en'|'ru';
export type ThreeSlots=[string|null,string|null,string|null];
export type RankingEvidence={market:string;periodStart:string;periodEnd:string;metric:'units_sold'|'revenue_azn';sourceUrl:string;verifiedAt:string};
export type CalendarMonth={month:number;kind:'editorial'|'coming-soon'|'verified';productIds:ThreeSlots;evidence?:RankingEvidence};
export const CALENDAR_YEAR=2026;
// These are editorial catalog selections, never asserted sales rankings.
// Future/empty months retain exactly three empty slots. Add evidence before using `verified`.
export const calendarMonths:CalendarMonth[]=[
 {month:1,kind:'editorial',productIds:['obf-0810763030585','obf-0609332820050','obf-0773602544172']},
 {month:2,kind:'editorial',productIds:['obf-3348901607339','obf-4059729447395','obf-4059729421937']},
 {month:3,kind:'editorial',productIds:['obf-3600531324506','obf-0800897129781','obf-4250947516027']},
 {month:4,kind:'editorial',productIds:['obf-0607845023180','obf-4250587735543','prod-11']},
 {month:5,kind:'editorial',productIds:['obf-3348901614900','obf-0773602657070','obf-0609332820050']},
 {month:6,kind:'editorial',productIds:['obf-0800897003968','obf-4059729302809','obf-4059729441973']},
 {month:7,kind:'editorial',productIds:['obf-6902395970101','obf-0773602736850','obf-3600530733842']},
 {month:8,kind:'editorial',productIds:['obf-0609332813373','obf-0041554217964','obf-4250587735543']},
 {month:9,kind:'editorial',productIds:['obf-0773602544172','obf-0800897129781','prod-13']},
 {month:10,kind:'editorial',productIds:['obf-3348901607339','obf-0810763030585','prod-14']},
 {month:11,kind:'coming-soon',productIds:[null,null,null]},
 {month:12,kind:'coming-soon',productIds:[null,null,null]},
];
export function resolveMonth(entry:CalendarMonth,now=new Date()):CalendarMonth {
 // Interpret month boundaries in the Azerbaijani market, not the browser timezone.
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Baku',year:'numeric',month:'numeric'}).formatToParts(now);
 const year=Number(parts.find(p=>p.type==='year')?.value),month=Number(parts.find(p=>p.type==='month')?.value);
 const future=CALENDAR_YEAR>year||(CALENDAR_YEAR===year&&entry.month>month);
 if(future)return {...entry,kind:'coming-soon',productIds:[null,null,null]};
 const e=entry.evidence;
 // Only completed reporting periods with a traceable source can claim verified rankings.
 const verified=entry.kind==='verified'&&e&&e.market&&e.metric&&/^https:\/\//.test(e.sourceUrl)&&
  e.periodStart===`${CALENDAR_YEAR}-${String(entry.month).padStart(2,'0')}-01`&&
  new Date(e.periodEnd).getTime()===Date.UTC(CALENDAR_YEAR,entry.month,0)&&
  new Date(e.periodEnd)<now&&new Date(e.verifiedAt)>=new Date(e.periodEnd)&&new Date(e.verifiedAt)<=now&&
  entry.productIds.every(Boolean)&&new Set(entry.productIds).size===3;
 if(entry.kind==='verified'&&!verified)return {...entry,kind:'coming-soon',productIds:[null,null,null],evidence:undefined};
 return entry;
}

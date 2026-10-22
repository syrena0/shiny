export type Language='az'|'en'|'ru';
export type ThreeSlots=[string|null,string|null,string|null];
export type RankingEvidence={market:string;periodStart:string;periodEnd:string;metric:'units_sold'|'revenue_azn';sourceUrl:string;verifiedAt:string};
export type CalendarMonth={month:number;kind:'editorial'|'coming-soon'|'verified';productIds:ThreeSlots;evidence?:RankingEvidence};
export const CALENDAR_YEAR=2026;
// These are editorial catalog selections, never asserted sales rankings.
// Future/empty months retain exactly three empty slots. Add evidence before using `verified`.
export const calendarMonths:CalendarMonth[]=[
 {month:1,kind:'editorial',productIds:['prod-13','prod-5','prod-1']},
 {month:2,kind:'editorial',productIds:['prod-3','prod-15','prod-6']},
 {month:3,kind:'editorial',productIds:['prod-2','prod-10','prod-14']},
 {month:4,kind:'editorial',productIds:['prod-4','prod-8','prod-12']},
 {month:5,kind:'editorial',productIds:['prod-1','prod-3','prod-5']},
 {month:6,kind:'editorial',productIds:['prod-9','prod-11','prod-6']},
 {month:7,kind:'editorial',productIds:['prod-2','prod-8','prod-10']},
 {month:8,kind:'editorial',productIds:['prod-12','prod-13','prod-14']},
 {month:9,kind:'editorial',productIds:['prod-7','prod-15','prod-4']},
 {month:10,kind:'editorial',productIds:['prod-3','prod-1','prod-13']},
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

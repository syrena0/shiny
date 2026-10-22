import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {fetch,EnvHttpProxyAgent} from 'undici';
const dispatcher=new EnvHttpProxyAgent();
export function isPublicAddress(address){
 if(isIP(address)===4){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===192&&(b===0||b===88&&c===99)||a===203&&b===0&&c===113);}
 if(isIP(address)===6)return /^[23][0-9a-f]{3}:/i.test(address)&&!address.toLowerCase().startsWith('2001:db8:');
 return false;
}
export async function checkRemoteURL(value,hosts){
 let u;try{u=new URL(value)}catch{throw new Error('Invalid remote URL')}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||isIP(u.hostname)||!hosts.includes(u.hostname)||[...u.searchParams.keys()].some(k=>/token|secret|signature|credential|api[_-]?key/i.test(k)))throw new Error('Remote URL is not an authorized public HTTPS endpoint');
 // A configured egress proxy resolves remote DNS and must enforce private-network blocking.
 // Managed cloud environments intentionally disable direct DNS for proxied hosts.
 if(!(process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy)){
  const addresses=await Promise.race([lookup(u.hostname,{all:true}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('DNS lookup timed out')),5000).unref())]);
  if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw new Error('Private or reserved destination rejected');
 }
 return u;
}
export async function downloadBytes(url,hosts,{maxBytes=10*1024*1024,token}={}){
 let current=url;
 for(let redirects=0;redirects<4;redirects++){
  const u=await checkRemoteURL(current,hosts);const headers={};if(token&&new URL(url).hostname===u.hostname)headers.Authorization=`Bearer ${token}`;
  const response=await fetch(u,{dispatcher,headers,redirect:'manual',signal:AbortSignal.timeout(20000)});
  if([301,302,303,307,308].includes(response.status)){await response.body?.cancel();current=new URL(response.headers.get('location'),u).href;continue;}
  if(!response.ok){await response.body?.cancel();throw new Error(`Source returned HTTP ${response.status}`)}
  if(Number(response.headers.get('content-length'))>maxBytes){await response.body.cancel();throw new Error('Download exceeds size limit')}
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes){await response.body.cancel().catch(()=>{});throw new Error('Download exceeds size limit')}chunks.push(chunk)}
  return Buffer.concat(chunks);
 }
 throw new Error('Too many redirects');
}
export async function optimizeImage(bytes){
 const image=sharp(bytes,{limitInputPixels:25000000,animated:false,failOn:'error'}),metadata=await image.metadata();
 if(!['jpeg','png','webp','avif','heif'].includes(metadata.format)||metadata.pages>1||!metadata.width||!metadata.height)throw new Error('Unsupported, animated or invalid image');
 if(Math.max(metadata.width,metadata.height)<300||Math.min(metadata.width,metadata.height)<32)throw new Error('Image resolution too low');
 const sample=await image.clone().rotate().flatten({background:'#fff'}).resize(64,64,{fit:'fill'}).removeAlpha().raw().toBuffer();let neutral=0,total=0;
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(x<4||y<4||x>59||y>59){const rgb=[...sample.subarray((y*64+x)*3,(y*64+x)*3+3)];total++;if(Math.max(...rgb)-Math.min(...rgb)<25&&Math.min(...rgb)>200)neutral++;}
 const stats=await image.clone().stats();if(stats.channels.every(c=>c.stdev<3))throw new Error('Blank image');
 const options={fit:'inside',withoutEnlargement:true};
 const card=await image.clone().rotate().flatten({background:'#fff'}).resize(600,600,options).webp({quality:84}).toBuffer();
 const detail=await image.clone().rotate().flatten({background:'#fff'}).resize(1200,1200,options).webp({quality:88}).toBuffer();
 return {card,detail,width:metadata.width,height:metadata.height,neutral_border:neutral/total,source_sha256:createHash('sha256').update(bytes).digest('hex'),sha256:createHash('sha256').update(card).digest('hex')};
}

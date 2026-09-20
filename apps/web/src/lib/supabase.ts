const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const isSupabaseConfigured=Boolean(SUPABASE_URL&&SUPABASE_PUBLISHABLE_KEY);
export async function testSupabaseConnection():Promise<{ok:boolean;message:string}>{
 if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY)return{ok:false,message:'Supabase 환경변수가 설정되지 않았습니다.'};
 try{const r=await fetch(`${SUPABASE_URL}/rest/v1/products?select=id&limit=1`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${SUPABASE_PUBLISHABLE_KEY}`}});
 if(!r.ok)return{ok:false,message:`Supabase 응답 ${r.status}: ${(await r.text()).slice(0,180)}`};
 return{ok:true,message:'Supabase 연결 및 products 조회 성공'};}catch(e){return{ok:false,message:e instanceof Error?e.message:'Supabase 연결에 실패했습니다.'};}
}
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export type SupabaseConnection = {
  ok: boolean;
  message: string;
};

export async function testSupabaseConnection(): Promise<SupabaseConnection> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: `Supabase 응답 ${response.status}: ${body.slice(0, 180)}` };
    }

    return { ok: true, message: 'Supabase 연결 및 products 조회 성공' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Supabase 연결에 실패했습니다.',
    };
  }
}

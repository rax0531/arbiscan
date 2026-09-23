const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export type SupabaseConnection = {
  ok: boolean;
  message: string;
};

function getHeaders() {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY ?? '',
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY ?? ''}`,
  };
}

export async function testSupabaseConnection(): Promise<SupabaseConnection> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id&limit=1`, {
      headers: getHeaders(),
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

export async function fetchProductSourceData(): Promise<{
  ok: boolean;
  data: Array<{
    canonical_key: string;
    title: string;
    category: string | null;
    source_data: Record<string, unknown> | null;
  }>;
  message: string;
}> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, data: [], message: 'Supabase 환경변수가 설정되지 않았습니다.' };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=canonical_key,title,category,source_data&order=created_at.asc`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        data: [],
        message: `상품 조회 실패 ${response.status}: ${body.slice(0, 180)}`,
      };
    }

    const data = (await response.json()) as Array<{
      canonical_key: string;
      title: string;
      category: string | null;
      source_data: Record<string, unknown> | null;
    }>;

    return {
      ok: true,
      data,
      message: `Supabase에서 상품 ${data.length}개를 불러왔습니다.`,
    };
  } catch (error) {
    return {
      ok: false,
      data: [],
      message: error instanceof Error ? error.message : '상품 조회에 실패했습니다.',
    };
  }
}
export async function fetchLatestExchangeRate(
  baseCurrency: string,
  quoteCurrency: string
): Promise<{
  ok: boolean;
  rate: number | null;
  observedAt: string | null;
  message: string;
}> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return {
      ok: false,
      rate: null,
      observedAt: null,
      message: 'Supabase 환경변수가 설정되지 않았습니다.',
    };
  }

  try {
    const params = new URLSearchParams({
      select: 'base_currency,quote_currency,rate,observed_at,source,rate_date',
      source: 'eq.frankfurter',
      base_currency: `eq.${baseCurrency.toUpperCase()}`,
      quote_currency: `eq.${quoteCurrency.toUpperCase()}`,
      order: 'rate_date.desc,observed_at.desc',
      limit: '1',
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/exchange_rates?${params.toString()}`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      const body = await response.text();

      return {
        ok: false,
        rate: null,
        observedAt: null,
        message: `환율 조회 실패 ${response.status}: ${body.slice(0, 180)}`,
      };
    }

    const rows = (await response.json()) as Array<{
      base_currency: string;
      quote_currency: string;
      rate: number | string;
      observed_at: string;
    }>;

    if (rows.length === 0) {
      return {
        ok: false,
        rate: null,
        observedAt: null,
        message: `${baseCurrency.toUpperCase()}/${quoteCurrency.toUpperCase()} 환율 데이터가 없습니다.`,
      };
    }

    return {
      ok: true,
      rate: Number(rows[0].rate),
      observedAt: rows[0].observed_at,
      message: `${baseCurrency.toUpperCase()}/${quoteCurrency.toUpperCase()} 환율을 불러왔습니다.`,
    };
  } catch (error) {
    return {
      ok: false,
      rate: null,
      observedAt: null,
      message: error instanceof Error
        ? error.message
        : '환율 조회에 실패했습니다.',
    };
  }
}

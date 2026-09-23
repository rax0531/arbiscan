import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
}

interface FrankfurterRateResponse {
  base: string;
  date: string;
  quote: string;
  rate: number;
}

async function fetchFrankfurterRate(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<FrankfurterRateResponse> {
  const url =
    `https://api.frankfurter.dev/v2/rate/${baseCurrency}/${quoteCurrency}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Frankfurter API 오류: ${response.status} ${await response.text()}`,
    );
  }

  return await response.json();
}

async function saveRate(rateData: FrankfurterRateResponse) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/exchange_rates`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        source: "frankfurter",
        rate_date: rateData.date,
        base_currency: rateData.base,
        quote_currency: rateData.quote,
        rate: rateData.rate,
        observed_at: new Date().toISOString(),
      }),
    },
  );

  if (response.status === 409) {
    const errorBody = await response.text();

    if (errorBody.includes('"code":"23505"')) {
      return false;
    }

    throw new Error(
      `환율 저장 실패: ${response.status} ${errorBody}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `환율 저장 실패: ${response.status} ${await response.text()}`,
    );
  }

  return true;
}

serve(async () => {
  try {
    const rates = await Promise.all([
      fetchFrankfurterRate("JPY", "KRW"),
      fetchFrankfurterRate("USD", "KRW"),
    ]);

    const results = [];

    for (const rate of rates) {
      const inserted = await saveRate(rate);

      results.push({
        pair: `${rate.base}/${rate.quote}`,
        rate: rate.rate,
        rateDate: rate.date,
        inserted,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        source: "frankfurter",
        results,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        ok: false,
        message: error instanceof Error
          ? error.message
          : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});

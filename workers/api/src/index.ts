export interface Env {
  ENVIRONMENT: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RAKUTEN_APPLICATION_ID?: string;
  RAKUTEN_ACCESS_KEY?: string;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

const rakutenHeaders = (env: Env) => ({
  accessKey: env.RAKUTEN_ACCESS_KEY!,
  Referer: 'https://github.com/rax0531/arbiscan',
  Origin: 'https://github.com',
});

const supabaseHeaders = (env: Env, prefer?: string) => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
  'Content-Type': 'application/json',
  ...(prefer ? { Prefer: prefer } : {}),
});

const enuriHeaders = () => ({
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language':
    'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
});

/*
 * 한국 가격 Provider 공통 후보 형식.
 *
 * Danawa / Enuri / 향후 다른 Provider는
 * 각자의 원본 응답을 이 형식으로 변환한 뒤
 * 동일상품 판정 단계로 넘긴다.
 *
 * 중요한 점:
 * - Provider가 상품을 찾지 못해도 전체 파이프라인을 중단하지 않는다.
 * - name / price 등이 없을 수 있다.
 * - 동일상품 여부는 이 단계에서 확정하지 않는다.
 */
type KoreanPriceCandidate = {
  provider: string;
  externalId: string | null;
  title: string | null;
  url: string | null;
  priceKrw: number | null;
  sellerName: string | null;

  /*
   * Provider 자체가 제공하는 보조정보.
   * 동일상품 판정 단계에서는 참고자료로만 사용한다.
   */
  metadata?: Record<string, unknown>;
};

/*
 * Provider 검색 결과의 공통 형식.
 */
type KoreanPriceProviderResult = {
  provider: string;
  keyword: string;
  candidates: KoreanPriceCandidate[];
};

/*
 * 상품명 비교에 사용할 기본 정규화 함수.
 *
 * 기존 Enuri /match에서 사용하던 normalize와
 * 동일한 성격의 로직을 Provider 공통 영역에서도
 * 사용할 수 있도록 별도로 정의한다.
 *
 * 단, 이 함수만으로 동일상품을 확정하지 않는다.
 */
const normalizeProductText = (
  value: string | null | undefined,
) =>
  (value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()[\]{}\-_/.,+]/g, '');

/*
 * 가격이 실제 유효한 숫자인지 확인한다.
 *
 * Provider가 가격을 찾지 못한 경우 null을 유지한다.
 * 0 이하의 값도 실제 판매가격으로 취급하지 않는다.
 */
const isValidKrwPrice = (
  value: number | null | undefined,
) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0;

/*
 * Danawa 검색 결과를 공통 한국 가격 후보 형식으로 변환한다.
 *
 * 이 함수는 "동일상품 판정"을 하지 않는다.
 * Danawa가 반환한 상품 후보를 그대로 공통 형식으로
 * 변환하는 역할만 담당한다.
 */
const toDanawaCandidates = (
  keyword: string,
  products: Array<{
    name: string | null;
    pcode: string;
    url: string;
    price: number | null;
    productType: string | null;
    position: number | null;
  }>,
): KoreanPriceProviderResult => {
  const candidates =
    products.map(
      (product): KoreanPriceCandidate => ({
        provider: 'danawa',
        externalId:
          product.pcode ?? null,
        title:
          product.name ?? null,
        url:
          product.url ?? null,
        priceKrw:
          isValidKrwPrice(
            product.price,
          )
            ? product.price
            : null,
        sellerName: null,
        metadata: {
          productType:
            product.productType ??
            null,
          position:
            product.position ??
            null,
        },
      }),
    );

  return {
    provider: 'danawa',
    keyword,
    candidates,
  };
};

const searchDanawaProvider = async (
  keyword: string,
): Promise<KoreanPriceProviderResult> => {
  const danawaUrl =
    `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(keyword)}`;

  const response = await fetch(
    danawaUrl,
    {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':
          'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    },
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Danawa request failed: ${response.status}`,
    );
  }

  const pcodeMatches = [
    ...responseText.matchAll(
      /https?:\/\/prod\.danawa\.com\/info\/\?pcode=(\d+)[^"'<>\s]*/gi,
    ),
  ];

  const pcodeSet =
    new Set<string>();

  const pcodeEntries:
    Array<{
      pcode: string;
      url: string;
      position: number;
    }> = [];

  for (
    const match of
      pcodeMatches
  ) {
    const pcode =
      match[1];

    if (
      !pcode ||
      pcodeSet.has(pcode)
    ) {
      continue;
    }

    pcodeSet.add(pcode);

    pcodeEntries.push({
      pcode,
      url: match[0],
      position:
        match.index ?? 0,
    });
  }

  const products:
    Array<{
      name: string | null;
      pcode: string;
      url: string;
      price: number | null;
      productType: string | null;
      position: number | null;
    }> = [];

  for (
    let index = 0;
    index <
      pcodeEntries.length;
    index += 1
  ) {
    const entry =
      pcodeEntries[index];

    const nextPosition =
      pcodeEntries[index + 1]
        ?.position ??
      Math.min(
        responseText.length,
        entry.position + 50000,
      );

    const cardText =
      responseText.slice(
        entry.position,
        nextPosition,
      );

    let name:
      string | null =
        null;

    const nameMatch =
      cardText.match(
        /<p[^>]*class=["'][^"']*\bprod_name\b[^"']*["'][^>]*>[\s\S]{0,5000}?<a[^>]*>([\s\S]*?)<\/a>/i,
      );

    if (
      nameMatch
    ) {
      name =
        nameMatch[1]
          .replace(
            /<[^>]+>/g,
            ' ',
          )
          .replace(
            /&nbsp;/gi,
            ' ',
          )
          .replace(
            /&amp;/gi,
            '&',
          )
          .replace(
            /\s+/g,
            ' ',
          )
          .trim();

      if (!name) {
        name = null;
      }
    }

    let price:
      number | null =
        null;

    const priceMatch =
      cardText.match(
        /<p[^>]*class=["'][^"']*\bprice_sect\b[^"']*["'][^>]*>[\s\S]{0,5000}?<strong[^>]*>([\d,]+)<\/strong>\s*원/i,
      );

    if (
      priceMatch
    ) {
      const parsedPrice =
        Number(
          priceMatch[1]
            .replace(
              /,/g,
              '',
            ),
        );

      if (
        Number.isFinite(
          parsedPrice,
        ) &&
        parsedPrice > 0
      ) {
        price =
          parsedPrice;
      }
    }

    let productType:
      string | null =
        null;

    const productTypeMatch =
      cardText.match(
        />(정품|해외구매|중고|해외리퍼비시)<\/a>/i,
      );

    if (
      productTypeMatch
    ) {
      productType =
        productTypeMatch[1];
    }

    products.push({
      name,
      pcode:
        entry.pcode,
      url:
        entry.url,
      price,
      productType,
      position:
        products.length + 1,
    });
  }

  const uniqueProducts =
    Array.from(
      new Map(
        products.map(
          (product) => [
            product.pcode,
            product,
          ],
        ),
      ).values(),
    );

  return toDanawaCandidates(
    keyword,
    uniqueProducts,
  );
};


const searchEnuriProvider = async (
  keyword: string,
): Promise<KoreanPriceProviderResult> => {
  const enuriUrl =
    `https://price.enuri.com/search?keyword=${encodeURIComponent(keyword)}`;

  const response = await fetch(
    enuriUrl,
    {
      method: 'GET',
      headers: enuriHeaders(),
      redirect: 'follow',
    },
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Enuri request failed: ${response.status}`,
    );
  }

  const jsonLdMatch =
    responseText.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/is,
    );

  if (!jsonLdMatch) {
    throw new Error(
      'Enuri JSON-LD not found',
    );
  }

  let jsonLd: {
    itemListElement?: Array<{
      item?: {
        name?: string;
        sku?: string;
        offers?: {
          lowPrice?: number | string;
          highPrice?: number | string;
          offerCount?: number | string;
        };
        url?: string;
      };
    }>;
  };

  try {
    jsonLd = JSON.parse(
      jsonLdMatch[1],
    );
  } catch (error) {
    throw new Error(
      `Enuri JSON-LD parse failed: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  const candidates =
    (jsonLd.itemListElement ?? [])
      .map(
        (entry): KoreanPriceCandidate | null => {
          const item = entry.item;

          if (!item) {
            return null;
          }

          const price = Number(
            item.offers?.lowPrice ?? NaN,
          );

          return {
            provider: 'enuri',
            externalId:
              item.sku ?? null,
            title:
              item.name ?? null,
            url:
              item.url ?? null,
            priceKrw:
              isValidKrwPrice(price)
                ? price
                : null,
            sellerName: null,
            metadata: {
              highPrice:
                item.offers?.highPrice ?? null,
              offerCount:
                item.offers?.offerCount ?? null,
            },
          };
        },
      )
      .filter(
        (
          candidate,
        ): candidate is KoreanPriceCandidate =>
          candidate !== null,
      );

  return {
    provider: 'enuri',
    keyword,
    candidates,
  };
};

const extractIdentifierCandidates = (item: any): string[] => {
  const candidates = new Set<string>();

  const sources = [
    item?.itemUrl,
    ...(item?.mediumImageUrls ?? []),
    ...(item?.smallImageUrls ?? []),
    ...(item?.thumbnailImageUrls ?? []),
  ];

  for (const source of sources) {
    if (typeof source !== 'string') {
      continue;
    }

    const matches =
      source.match(/\d{13}/g) ?? [];

    for (const match of matches) {
      candidates.add(match);
    }
  }

  return Array.from(candidates);
};


/*
 * 여러 한국 가격 Provider를 병렬 조회해 하나의 후보 풀로 합친다.
 * 특정 Provider에 결과가 없거나 요청이 실패해도 다른 Provider 결과는 유지한다.
 * 동일상품 여부는 이 단계에서 확정하지 않는다.
 */
type KoreanPriceProviderSearchStatus = {
  provider: string;
  ok: boolean;
  candidateCount: number;
  error?: string;
};

const isLikelyAccessoryOrPart = (
  title: string,
): boolean => {
  const normalizedTitle =
    normalizeProductText(title);

  const exclusionKeywords = [
    '보호필름',
    '외부보호필름',
    '케이스',
    '파우치',
    '이어패드',
    '이어패드커버',
    '헤드밴드커버',
    '헤드밴드',
    '커버',
    '케이블',
    '오디오케이블',
    'aux',
    '수리부품',
    '교체부품',
    '교체용',
    '부품',
    '스피커',
    '힌지',
    '브래킷',
    '호환',
    '호환품',
  ];

  return exclusionKeywords.some(
    (keyword) =>
      normalizedTitle.includes(
        normalizeProductText(keyword),
      ),
  );
};

const filterKoreanPriceCandidates = (
  candidates: KoreanPriceCandidate[],
): KoreanPriceCandidate[] => {
  return candidates.filter(
    (candidate) => {
      if (
        !candidate.title ||
        !candidate.title.trim()
      ) {
        return false;
      }

      if (
        !isValidKrwPrice(
          candidate.priceKrw,
        )
      ) {
        return false;
      }

      if (
        isLikelyAccessoryOrPart(
          candidate.title,
        )
      ) {
        return false;
      }

      return true;
    },
  );
};

type KoreanPriceMatch = {
  candidate: KoreanPriceCandidate;

  /*
   * 0~100 사이의 동일상품 가능성 점수.
   *
   * 이 점수만으로 동일상품을 확정하지 않는다.
   * 브랜드 / 모델명 / 숫자 토큰 / 핵심 문자열의
   * 일치 여부를 종합해 후보 우선순위를 정한다.
   */
  matchScore: number;

  /*
   * 점수에 반영된 근거.
   * 이후 UI에서 "왜 이 상품으로 판단했는지"
   * 보여주기 위한 데이터로 사용한다.
   */
  evidence: string[];

  /*
   * 사람이 추가 확인해야 하는 경우 true.
   */
  requiresVerification: boolean;
};

type KoreanPriceAggregateResult = {
  keyword: string;
  providers: KoreanPriceProviderSearchStatus[];

  // Provider가 반환한 원본 후보.
  // 이후 필터 기준이 변경되어도 원본 데이터를 보존한다.
  candidates: KoreanPriceCandidate[];

  // 실제 차익분석에 우선 사용할 정제 후보.
  filteredCandidates: KoreanPriceCandidate[];
  /*
   * 정제 후보에 대한 동일상품 가능성 평가 결과.
   * 점수가 낮은 후보도 삭제하지 않고 보존한다.
   */
  matchedCandidates: KoreanPriceMatch[];
};

/*
 * 상품명에서 의미 있는 토큰을 추출한다.
 *
 * 단순 문자열 포함 여부만 사용하면
 * WH-1000XM5 / WH-1000XM4처럼 비슷하지만 다른
 * 모델을 잘못 매칭할 수 있으므로 숫자/영문 모델 토큰을
 * 별도로 비교한다.
 */
const extractProductTokens = (
  value: string | null | undefined,
): string[] => {
  const source =
    value ?? '';

  if (!source.trim()) {
    return [];
  }

  /*
   * 반드시 정규화하기 전에 원문에서 토큰을 추출한다.
   *
   * SONY WH-1000XM5
   * → ["WH-1000XM5"]
   *
   * SONY WH-1000XM5 스모키 핑크 에디션
   * → ["WH-1000XM5"]
   *
   * 제조사 SONY와 모델번호 WH-1000XM5가
   * 하나로 합쳐지는 것을 방지한다.
   */
  const rawTokens =
    source.match(
      /[a-z]+(?:[-_/]?[0-9]+)+(?:[-_/]?[a-z0-9]+)*|[0-9]+[a-z]+[a-z0-9-]*/gi,
    ) ?? [];

  return Array.from(
    new Set(
      rawTokens
        .map((token) =>
          normalizeProductText(token),
        )
        .filter(
          (token) =>
            /[a-z]/.test(token) &&
            /[0-9]/.test(token),
        ),
    ),
  );
};

/*
 * 두 상품명의 동일상품 가능성을 계산한다.
 *
 * 현재 단계에서는 "확정"하지 않는다.
 * 점수는 이후 실제 상품번호(JAN/EAN/UPC/MPN)가 확보되면
 * 더 높은 우선순위의 증거로 보강한다.
 */
const calculateKoreanPriceMatch = (
  sourceTitle: string,
  candidate: KoreanPriceCandidate,
): KoreanPriceMatch => {
  const sourceNormalized =
    normalizeProductText(sourceTitle);

  const candidateNormalized =
    normalizeProductText(candidate.title);

  const evidence: string[] = [];

  if (
    !sourceNormalized ||
    !candidateNormalized
  ) {
    return {
      candidate,
      matchScore: 0,
      evidence: [
        '상품명이 없어 자동 매칭 근거가 부족함',
      ],
      requiresVerification: true,
    };
  }

  let score = 0;

  /*
   * 완전히 동일한 정규화 상품명.
   *
   * 가장 강한 텍스트 기반 근거지만,
   * 이것만으로 최종 확정하지 않는다.
   */
  if (
    sourceNormalized ===
    candidateNormalized
  ) {
    score += 70;
    evidence.push(
      '정규화된 상품명이 완전히 일치함',
    );
  } else {
    /*
     * 한쪽 상품명이 다른 쪽 상품명을 포함하는 경우.
     * 옵션/색상/에디션 등이 붙는 경우를 고려한다.
     */
    if (
      sourceNormalized.includes(
        candidateNormalized,
      ) ||
      candidateNormalized.includes(
        sourceNormalized,
      )
    ) {
      score += 45;
      evidence.push(
        '상품명 핵심 문자열이 서로 포함 관계임',
      );
    }
  }

  const sourceTokens =
    extractProductTokens(sourceTitle);

  const candidateTokens =
    extractProductTokens(
      candidate.title,
    );

  const sourceTokenSet =
    new Set(sourceTokens);

  const candidateTokenSet =
    new Set(candidateTokens);

  const sharedTokens =
    sourceTokens.filter(
      (token) =>
        candidateTokenSet.has(token),
    );

  /*
   * 모델번호처럼 보이는 영문+숫자 토큰.
   *
   * 예:
   * WH1000XM5
   * ILCE7CL
   * EF1635L3
   */
  const sourceModelTokens =
    sourceTokens.filter(
      (token) =>
        /[a-z]/.test(token) &&
        /[0-9]/.test(token),
    );

  const candidateModelTokens =
    candidateTokens.filter(
      (token) =>
        /[a-z]/.test(token) &&
        /[0-9]/.test(token),
    );

  const conflictingModelTokens =
    sourceModelTokens.filter(
      (token) =>
        candidateModelTokens.length > 0 &&
        !candidateTokenSet.has(token),
    );

  /*
   * 핵심 모델 토큰이 정확히 일치하면 강한 가산점.
   */
  const exactModelMatches =
    sourceModelTokens.filter(
      (token) =>
        candidateTokenSet.has(token),
    );

  if (exactModelMatches.length > 0) {
    score += Math.min(
      25,
      exactModelMatches.length * 25,
    );

    evidence.push(
      `모델 토큰 일치: ${exactModelMatches.join(', ')}`,
    );
  }

  /*
   * 모델 토큰이 존재하는데 서로 다르면
   * 강하게 감점한다.
   *
   * 예:
   * WH1000XM5 vs WH1000XM4
   */
  if (
    sourceModelTokens.length > 0 &&
    candidateModelTokens.length > 0 &&
    exactModelMatches.length === 0
  ) {
    score -= 50;

    evidence.push(
      `모델 토큰 불일치: ${sourceModelTokens.join(', ')} vs ${candidateModelTokens.join(', ')}`,
    );
  }

  /*
   * 일반 숫자 토큰도 추가적인 보조 근거로 사용한다.
   */
  const sourceNumberTokens =
    sourceTokens.filter(
      (token) => /^\d+$/.test(token),
    );

  const sharedNumberTokens =
    sourceNumberTokens.filter(
      (token) =>
        candidateTokenSet.has(token),
    );

  if (
    sharedNumberTokens.length > 0
  ) {
    score += Math.min(
      10,
      sharedNumberTokens.length * 5,
    );

    evidence.push(
      `숫자 토큰 일치: ${sharedNumberTokens.join(', ')}`,
    );
  }

  /*
   * 전체 토큰 겹침 정도.
   */
  const overlapRatio =
    sourceTokenSet.size > 0
      ? sharedTokens.length /
        sourceTokenSet.size
      : 0;

  if (overlapRatio >= 0.5) {
    score += 10;
    evidence.push(
      '핵심 토큰의 절반 이상이 일치함',
    );
  }

  /*
   * 점수 범위를 0~100으로 제한한다.
   */
  const matchScore = Math.max(
    0,
    Math.min(
      100,
      score,
    ),
  );

  /*
   * 현재는 다음 조건에서 사람 확인을 요구한다.
   *
   * - 80점 미만
   * - 모델 토큰 충돌
   * - 모델 토큰 자체가 없는 경우
   */
  const requiresVerification =
    matchScore < 80 ||
    conflictingModelTokens.length > 0 ||
    sourceModelTokens.length === 0;

  if (
    sourceModelTokens.length === 0
  ) {
    evidence.push(
      '명확한 모델 토큰이 없어 추가 확인이 필요함',
    );
  }

  return {
    candidate,
    matchScore,
    evidence,
    requiresVerification,
  };
};

const searchKoreanPriceProviders = async (
  keyword: string,
): Promise<KoreanPriceAggregateResult> => {
  const providerSearches: Array<{
    provider: string;
    search: () => Promise<KoreanPriceProviderResult>;
  }> = [
    {
      provider: 'danawa',
      search: () => searchDanawaProvider(keyword),
    },
    {
      provider: 'enuri',
      search: () => searchEnuriProvider(keyword),
    },
  ];

  const results = await Promise.all(
    providerSearches.map(async ({ provider, search }) => {
      try {
        const result = await search();

        return {
          provider,
          ok: true,
          result,
          error: undefined,
        };
      } catch (error) {
        return {
          provider,
          ok: false,
          result: null,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        };
      }
    }),
  );

  /*
   * Provider가 반환한 원본 후보는 그대로 보존한다.
   *
   * 이후 필터 기준이나 중복 제거 기준이 변경되더라도
   * 원본 데이터 자체는 손실되지 않도록 한다.
   */
  const candidates =
    results.flatMap(
      ({ result }) =>
        result?.candidates ?? [],
    );

  const filteredCandidates =
    filterKoreanPriceCandidates(
      candidates,
    );

  /*
   * Danawa / Enuri처럼 여러 Provider가
   * 동일한 상품을 각각 반환할 수 있다.
   *
   * 정규화된 상품명을 기준으로 동일상품을 하나로 통합한다.
   *
   * 예:
   *
   * Danawa
   *   SONY WH-1000XM5       367,260원
   *
   * Enuri
   *   SONY  WH-1000XM5      367,260원
   *
   * → 하나의 후보로 통합
   *
   * 반면:
   *
   * SONY WH-1000XM5
   * SONY WH-1000XM5 스모키 핑크 에디션
   *
   * 은 정규화된 상품명이 다르므로 별도 상품으로 유지한다.
   */
  const deduplicatedMap =
    new Map<
      string,
      KoreanPriceCandidate
    >();

  for (const candidate of filteredCandidates) {
    const candidateKey =
      normalizeProductText(
        candidate.title,
      );

    if (!candidateKey) {
      continue;
    }

    const existing =
      deduplicatedMap.get(
        candidateKey,
      );

    if (!existing) {
      deduplicatedMap.set(
        candidateKey,
        {
          ...candidate,
          provider: 'aggregated',
          metadata: {
            ...(candidate.metadata ?? {}),
            providerSources: [
              {
                provider:
                  candidate.provider,
                externalId:
                  candidate.externalId,
                title:
                  candidate.title,
                url:
                  candidate.url,
                priceKrw:
                  candidate.priceKrw,
                sellerName:
                  candidate.sellerName,
                metadata:
                  candidate.metadata ??
                  null,
              },
            ],
          },
        },
      );

      continue;
    }

    const existingPrice =
      existing.priceKrw ??
      Number.POSITIVE_INFINITY;

    const candidatePrice =
      candidate.priceKrw ??
      Number.POSITIVE_INFINITY;

    /*
     * 동일상품의 여러 Provider 중
     * 실제 차익분석에서는 가장 낮은 한국 가격을
     * 대표 가격으로 사용한다.
     */
    const preferred =
      candidatePrice <
      existingPrice
        ? candidate
        : existing;

    const existingSources =
      Array.isArray(
        existing.metadata
          ?.providerSources,
      )
        ? existing.metadata
            ?.providerSources
        : [];

    deduplicatedMap.set(
      candidateKey,
      {
        ...preferred,
        provider: 'aggregated',
        metadata: {
          ...(preferred.metadata ?? {}),
          providerSources: [
            ...existingSources,
            {
              provider:
                candidate.provider,
              externalId:
                candidate.externalId,
              title:
                candidate.title,
              url:
                candidate.url,
              priceKrw:
                candidate.priceKrw,
              sellerName:
                candidate.sellerName,
              metadata:
                candidate.metadata ??
                null,
            },
          ],
        },
      },
    );
  }

  const deduplicatedCandidates =
    Array.from(
      deduplicatedMap.values(),
    );

  /*
   * 현재 검색어를 해외 상품명으로 간주하고
   * 중복 제거된 한국 가격 후보 각각에 대해
   * 동일상품 가능성을 계산한다.
   *
   * Provider가 여러 개여도 동일상품은
   * 여기서 한 번만 평가한다.
   */
  const matchedCandidates =
    deduplicatedCandidates.map(
      (candidate) =>
        calculateKoreanPriceMatch(
          keyword,
          candidate,
        ),
    );

  const providers =
    results.map(
      ({
        provider,
        ok,
        result,
        error,
      }) => ({
        provider,
        ok,
        candidateCount:
          result?.candidates.length ??
          0,
        ...(error
          ? { error }
          : {}),
      }),
    );

  return {
    keyword,
    providers,
    candidates,
    filteredCandidates:
      deduplicatedCandidates,
    matchedCandidates,
  };
};

const verifyRakutenProductCode = async (
  productCode: string,
  env: Env,
) => {
  if (
    !env.RAKUTEN_APPLICATION_ID ||
    !env.RAKUTEN_ACCESS_KEY
  ) {
    throw new Error('Rakuten API configuration is missing');
  }

  const rakutenUrl = new URL(
    'https://openapi.rakuten.co.jp/ichibaproduct/api/Product/Search/20250801',
  );

  rakutenUrl.searchParams.set(
    'applicationId',
    env.RAKUTEN_APPLICATION_ID,
  );
  rakutenUrl.searchParams.set('productCode', productCode);
  rakutenUrl.searchParams.set('format', 'json');
  rakutenUrl.searchParams.set('formatVersion', '2');

  await new Promise((resolve) => setTimeout(resolve, 1100));

  const response = await fetch(
    rakutenUrl.toString(),
    {
      method: 'GET',
      headers: rakutenHeaders(env),
    },
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Rakuten Product Search API failed: ${response.status} ${responseText}`,
    );
  }

  let data: any;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Rakuten Product Search API returned invalid JSON: ${responseText}`,
    );
  }

  const products = Array.isArray(data?.Products)
    ? data.Products
    : [];

  if (products.length !== 1) {
    return null;
  }

  const product = products[0];

  if (product?.productCode !== productCode) {
    return null;
  }

  return {
    productCode: product.productCode,
    productId: product.productId ?? null,
    productName: product.productName ?? null,
    productNo: product.productNo ?? null,
    brandName: product.brandName ?? null,
    salesItemCount: product.salesItemCount ?? null,
    salesMinPrice: product.salesMinPrice ?? null,
    genreId: product.genreId ?? null,
    genreName: product.genreName ?? null,
  };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'arbiscan-api',
        environment: env.ENVIRONMENT,
      });
    }

    if (
      url.pathname === '/api/rakuten/identify-test' &&
      request.method === 'GET'
    ) {
      if (
        !env.RAKUTEN_APPLICATION_ID ||
        !env.RAKUTEN_ACCESS_KEY
      ) {
        return json({
          error: 'Rakuten API configuration is missing',
        }, 500);
      }

      const keyword = url.searchParams.get('keyword') || 'SONY';

      const rakutenUrl = new URL(
        'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401',
      );

      rakutenUrl.searchParams.set(
        'applicationId',
        env.RAKUTEN_APPLICATION_ID,
      );
      rakutenUrl.searchParams.set('keyword', keyword);
      rakutenUrl.searchParams.set('hits', '1');
      rakutenUrl.searchParams.set('page', '1');
      rakutenUrl.searchParams.set('format', 'json');
      rakutenUrl.searchParams.set('formatVersion', '2');

      try {
        const response = await fetch(
          rakutenUrl.toString(),
          {
            method: 'GET',
            headers: rakutenHeaders(env),
          },
        );

        const responseText = await response.text();

        if (!response.ok) {
          return json({
            error: 'Rakuten Item Search API request failed',
            status: response.status,
            detail: responseText,
          }, 502);
        }

        let data: any;

        try {
          data = JSON.parse(responseText);
        } catch {
          return json({
            error: 'Rakuten Item Search API returned invalid JSON',
            detail: responseText,
          }, 502);
        }

        const item = data?.Items?.[0];

        if (!item) {
          return json({
            ok: true,
            source: 'rakuten',
            keyword,
            item: null,
            identifierCandidates: [],
            verifiedProducts: [],
          });
        }

        const identifierCandidates =
          extractIdentifierCandidates(item);

        const verifiedProducts = [];

        for (const productCode of identifierCandidates) {
          const verifiedProduct =
            await verifyRakutenProductCode(
              productCode,
              env,
            );

          if (verifiedProduct) {
            verifiedProducts.push(verifiedProduct);
          }
        }

        return json({
          ok: true,
          source: 'rakuten-identify-test',
          keyword,
          item: {
            itemCode: item.itemCode ?? null,
            itemName: item.itemName ?? null,
            itemPrice: item.itemPrice ?? null,
            itemUrl: item.itemUrl ?? null,
          },
          identifierCandidates,
          verifiedProducts,
        });
      } catch (error) {
        return json({
          error: 'Rakuten product identification test failed',
          detail: error instanceof Error
            ? error.message
            : String(error),
        }, 502);
      }
    }

if (
  url.pathname.startsWith('/api/products/') &&
  url.pathname.endsWith('/identifiers') &&
  request.method === 'GET'
) {
  try {
    const productId = url.pathname
      .slice('/api/products/'.length, -'/identifiers'.length)
      .replace(/\/$/, '');

    if (!productId) {
      return json({
        error: 'Product ID is required',
      }, 400);
    }

    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/product_identifiers?select=*&product_id=eq.${encodeURIComponent(productId)}&order=verified.desc,identifier_type.asc`,
      {
        method: 'GET',
        headers: supabaseHeaders(env),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      return json({
        error: 'Supabase request failed',
        status: response.status,
        detail: errorText,
      }, 502);
    }

    const identifiers = await response.json();

    return json({
      productId,
      identifiers,
      count: Array.isArray(identifiers)
        ? identifiers.length
        : 0,
      source: 'supabase',
    });
  } catch (error) {
    return json({
      error: 'Product identifier lookup failed',
      detail:
        error instanceof Error
          ? error.message
          : String(error),
    }, 502);
  }
}

if (
  url.pathname === '/api/products' &&
  request.method === 'GET'
) {
      try {
        const response = await fetch(
          `${env.SUPABASE_URL}/rest/v1/products?select=*&order=updated_at.desc`,
          {
            method: 'GET',
            headers: supabaseHeaders(env),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          return json({
            error: 'Supabase request failed',
            status: response.status,
            detail: errorText,
          }, 502);
        }

        const items = await response.json();

        return json({
          items,
          source: 'supabase',
        });
      } catch (error) {
        return json({
          error: 'Supabase connection failed',
          detail: error instanceof Error
            ? error.message
            : String(error),
        }, 502);
      }
    }

      if (
        url.pathname.startsWith('/api/products/') &&
        url.pathname.endsWith('/listings') &&
        request.method === 'GET'
      ) {
        try {
          const productId = url.pathname
            .slice('/api/products/'.length, -'/listings'.length)
            .replace(/\/$/, '');

          if (!productId) {
            return json({
              error: 'Product ID is required',
            }, 400);
          }

          const response = await fetch(
            `${env.SUPABASE_URL}/rest/v1/market_listings?select=*&product_id=eq.${encodeURIComponent(productId)}&order=price.asc`,
            {
              method: 'GET',
              headers: supabaseHeaders(env),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();

            return json({
              error: 'Supabase request failed',
              status: response.status,
              detail: errorText,
            }, 502);
          }

          const listings = await response.json();

          return json({
            productId,
            listings,
            count: Array.isArray(listings)
              ? listings.length
              : 0,
            source: 'supabase',
          });
        } catch (error) {
          return json({
            error: 'Supabase connection failed',
            detail: error instanceof Error
              ? error.message
              : String(error),
          }, 502);
        }
      }

if (
  url.pathname.startsWith('/api/products/') &&
  url.pathname.endsWith('/korean-listings') &&
  request.method === 'GET'
) {
  try {
    const productId = url.pathname
      .slice('/api/products/'.length, -'/korean-listings'.length)
      .replace(/\/$/, '');

    if (!productId) {
      return json({
        error: 'Product ID is required',
      }, 400);
    }

    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/korean_listings?select=*&product_id=eq.${encodeURIComponent(productId)}&order=price_krw.asc`,
      {
        method: 'GET',
        headers: supabaseHeaders(env),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      return json({
        error: 'Supabase request failed',
        status: response.status,
        detail: errorText,
      }, 502);
    }

    const listings = await response.json();

    return json({
      productId,
      listings,
      count: Array.isArray(listings)
        ? listings.length
        : 0,
      source: 'supabase',
    });
  } catch (error) {
    return json({
      error: 'Supabase connection failed',
      detail: error instanceof Error
        ? error.message
        : String(error),
    }, 502);
  }
}

if (
  url.pathname.startsWith('/api/products/') &&
  url.pathname.endsWith('/korean-listings') &&
  request.method === 'POST'
) {
  try {
    const productId = url.pathname
      .slice('/api/products/'.length, -'/korean-listings'.length)
      .replace(/\/$/, '');

    if (!productId) {
      return json({
        error: 'Product ID is required',
      }, 400);
    }

const body = await request.json() as {
  marketplace?: string;
  externalId?: string | null;
  title?: string;
  url?: string | null;
  priceKrw?: number | null;
  sellerName?: string | null;
};

const marketplace = body.marketplace;
const externalId = body.externalId ?? null;
const title = body.title;
const urlValue = body.url ?? null;
const priceKrw = body.priceKrw ?? null;
const sellerName = body.sellerName ?? null;

    if (!marketplace || !title) {
      return json({
        error: 'marketplace and title are required',
      }, 400);
    }

    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/korean_listings?on_conflict=product_id,marketplace,external_id`,
      {
        method: 'POST',
        headers: {
          ...supabaseHeaders(env),
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          product_id: productId,
          marketplace,
          external_id: externalId,
          title,
          url: urlValue,
          price_krw: priceKrw,
          seller_name: sellerName,
          observed_at: new Date().toISOString(),
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      return json({
        error: 'Supabase request failed',
        status: response.status,
        detail: errorText,
      }, 502);
    }

    const listings = await response.json();

    return json({
      saved: true,
      productId,
      listing: Array.isArray(listings)
        ? listings[0] ?? null
        : listings,
      source: 'supabase',
    });
  } catch (error) {
    return json({
      error: 'Korean listing save failed',
      detail: error instanceof Error
        ? error.message
        : String(error),
    }, 400);
  }
}

if (
      url.pathname === '/api/rakuten/product-test' &&
      request.method === 'GET'
    ) {
      if (
        !env.RAKUTEN_APPLICATION_ID ||
        !env.RAKUTEN_ACCESS_KEY
      ) {
        return json({
          error: 'Rakuten API configuration is missing',
        }, 500);
      }

      const productCode = url.searchParams.get('productCode')
        || '4548736121683';

      const rakutenUrl = new URL(
        'https://openapi.rakuten.co.jp/ichibaproduct/api/Product/Search/20250801',
      );

      rakutenUrl.searchParams.set(
        'applicationId',
        env.RAKUTEN_APPLICATION_ID,
      );
      rakutenUrl.searchParams.set('productCode', productCode);
      rakutenUrl.searchParams.set('format', 'json');
      rakutenUrl.searchParams.set('formatVersion', '2');

      try {
        const response = await fetch(
          rakutenUrl.toString(),
          {
            method: 'GET',
            headers: rakutenHeaders(env),
          },
        );

        const responseText = await response.text();

        if (!response.ok) {
          return json({
            error: 'Rakuten Product Search API request failed',
            status: response.status,
            detail: responseText,
          }, 502);
        }

        let data: unknown;

        try {
          data = JSON.parse(responseText);
        } catch {
          return json({
            error: 'Rakuten Product Search API returned invalid JSON',
            detail: responseText,
          }, 502);
        }

        return json({
          ok: true,
          source: 'rakuten-product-search',
          productCode,
          data,
        });
      } catch (error) {
        return json({
          error: 'Rakuten Product Search request failed',
          detail: error instanceof Error ? error.message : String(error),
        }, 502);
      }
    }

    if (
      (url.pathname === '/api/rakuten/test' ||
       url.pathname === '/api/rakuten/collect-test') &&
      request.method === 'GET'
    ) {
      if (
        !env.RAKUTEN_APPLICATION_ID ||
        !env.RAKUTEN_ACCESS_KEY
      ) {
        return json({
          error: 'Rakuten API configuration is missing',
        }, 500);
      }

      if (
        url.pathname === '/api/rakuten/collect-test' &&
        (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
      ) {
        return json({
          error: 'Supabase configuration is missing',
        }, 500);
      }

      const keyword = url.searchParams.get('keyword') || 'SONY';

      const rakutenUrl = new URL(
        'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401',
      );

      rakutenUrl.searchParams.set(
        'applicationId',
        env.RAKUTEN_APPLICATION_ID,
      );
      rakutenUrl.searchParams.set('keyword', keyword);
      rakutenUrl.searchParams.set('hits', '1');
      rakutenUrl.searchParams.set('page', '1');
      rakutenUrl.searchParams.set('format', 'json');
      rakutenUrl.searchParams.set('formatVersion', '2');

      try {
        const response = await fetch(
          rakutenUrl.toString(),
          {
            method: 'GET',
            headers: rakutenHeaders(env),
          },
        );

        const responseText = await response.text();

        if (!response.ok) {
          return json({
            error: 'Rakuten API request failed',
            status: response.status,
            detail: responseText,
          }, 502);
        }

        let data: any;

        try {
          data = JSON.parse(responseText);
        } catch {
          return json({
            error: 'Rakuten API returned invalid JSON',
            detail: responseText,
          }, 502);
        }

        const item = data?.Items?.[0];

        if (!item) {
          return json({
            ok: true,
            source: 'rakuten',
            keyword,
            count: data?.count ?? 0,
            item: null,
          });
        }

        if (url.pathname === '/api/rakuten/test') {
          return json({
            ok: true,
            source: 'rakuten',
            keyword,
            data,
          });
        }

                const identifierCandidates =
          extractIdentifierCandidates(item);

        if (identifierCandidates.length === 0) {
          return json({
            error: 'No product identifier candidate found',
            keyword,
            item: {
              itemCode: item.itemCode ?? null,
              itemName: item.itemName ?? null,
              itemPrice: item.itemPrice ?? null,
              itemUrl: item.itemUrl ?? null,
            },
            identifierCandidates: [],
          }, 422);
        }

        let verifiedProduct: any = null;

        for (const productCode of identifierCandidates) {
          const candidate =
            await verifyRakutenProductCode(
              productCode,
              env,
            );

          if (candidate) {
            verifiedProduct = candidate;
            break;
          }
        }

        if (!verifiedProduct) {
          return json({
            error: 'No verified Rakuten product found',
            keyword,
            item: {
              itemCode: item.itemCode ?? null,
              itemName: item.itemName ?? null,
              itemPrice: item.itemPrice ?? null,
              itemUrl: item.itemUrl ?? null,
            },
            identifierCandidates,
          }, 422);
        }

        const identifierType = 'JAN';
        const identifierValue =
          verifiedProduct.productCode;

        /*
         * 1. JAN으로 기존 상품을 찾는다.
         */
        const identifierLookupUrl = new URL(
          `${env.SUPABASE_URL}/rest/v1/product_identifiers`,
        );

        identifierLookupUrl.searchParams.set(
          'select',
          'product_id,identifier_type,identifier_value,verified',
        );
        identifierLookupUrl.searchParams.set(
          'identifier_type',
          `eq.${identifierType}`,
        );
        identifierLookupUrl.searchParams.set(
          'identifier_value',
          `eq.${identifierValue}`,
        );
        identifierLookupUrl.searchParams.set(
          'limit',
          '1',
        );

        const identifierResponse = await fetch(
          identifierLookupUrl.toString(),
          {
            method: 'GET',
            headers: supabaseHeaders(env),
          },
        );

        if (!identifierResponse.ok) {
          const detail =
            await identifierResponse.text();

          return json({
            error: 'Product identifier lookup failed',
            status: identifierResponse.status,
            detail,
          }, 502);
        }

        const identifierRows =
          await identifierResponse.json();

        let product: any = null;
        let productCreated = false;

        /*
         * 2. 이미 JAN이 등록되어 있으면
         *    연결된 products를 사용한다.
         */
        if (
          Array.isArray(identifierRows) &&
          identifierRows.length > 0 &&
          identifierRows[0]?.product_id
        ) {
          const productId =
            identifierRows[0].product_id;

          const productLookupUrl = new URL(
            `${env.SUPABASE_URL}/rest/v1/products`,
          );

          productLookupUrl.searchParams.set(
            'select',
            '*',
          );
          productLookupUrl.searchParams.set(
            'id',
            `eq.${productId}`,
          );
          productLookupUrl.searchParams.set(
            'limit',
            '1',
          );

          const productLookupResponse = await fetch(
            productLookupUrl.toString(),
            {
              method: 'GET',
              headers: supabaseHeaders(env),
            },
          );

          if (!productLookupResponse.ok) {
            const detail =
              await productLookupResponse.text();

            return json({
              error: 'Existing product lookup failed',
              status: productLookupResponse.status,
              detail,
            }, 502);
          }

          const existingProducts =
            await productLookupResponse.json();

          product = Array.isArray(existingProducts)
            ? existingProducts[0]
            : existingProducts;
        }

        /*
         * 3. JAN으로 기존 상품을 찾지 못했으면
         *    JAN을 canonical key로 새 상품을 생성한다.
         */
        if (!product?.id) {
          const canonicalKey =
            `global:jan:${identifierValue}`;

          const productSourceData = {
            source: 'rakuten',
            sourceMarket: 'JP',
            itemCode: item.itemCode,
            shopCode: item.shopCode,
            shopName: item.shopName,
            itemPrice: item.itemPrice,
            availability: item.availability,
            reviewCount: item.reviewCount,
            reviewAverage: item.reviewAverage,
            pointRate: item.pointRate,
            postageFlag: item.postageFlag,
            shipOverseasFlag: item.shipOverseasFlag,
            affiliateRate: item.affiliateRate,
            genreId: item.genreId,
            verifiedProduct,
            collectedAt: new Date().toISOString(),
          };

          const productResponse = await fetch(
            `${env.SUPABASE_URL}/rest/v1/rpc/upsert_product_observation`,
            {
              method: 'POST',
              headers: supabaseHeaders(env),
              body: JSON.stringify({
                p_canonical_key: canonicalKey,
                p_title: verifiedProduct.productName
                  || item.itemName,
                p_brand: verifiedProduct.brandName
                  || null,
                p_model: verifiedProduct.productNo
                  || null,
                p_category: verifiedProduct.genreName
                  || (
                    item.genreId
                      ? String(item.genreId)
                      : null
                  ),
                p_image_url:
                  item.mediumImageUrls?.[0] ?? null,
                p_source_data: productSourceData,
              }),
            },
          );

          if (!productResponse.ok) {
            const detail =
              await productResponse.text();

            return json({
              error: 'Product upsert failed',
              status: productResponse.status,
              detail,
            }, 502);
          }

          const productRows =
            await productResponse.json();

          product = Array.isArray(productRows)
            ? productRows[0]
            : productRows;

          if (!product?.id) {
            return json({
              error: 'Product upsert returned no product id',
              detail: productRows,
            }, 502);
          }

          productCreated = true;

          /*
           * 4. 새로 생성한 상품에 검증된 JAN을 등록한다.
           */
          const identifierInsertResponse =
            await fetch(
              `${env.SUPABASE_URL}/rest/v1/product_identifiers`,
              {
                method: 'POST',
                headers: supabaseHeaders(
                  env,
                  'resolution=merge-duplicates,return=representation',
                ),
                body: JSON.stringify({
                  product_id: product.id,
                  identifier_type: identifierType,
                  identifier_value: identifierValue,
                  source: 'rakuten-product-search',
                  verified: true,
                }),
              },
            );

          if (!identifierInsertResponse.ok) {
            const detail =
              await identifierInsertResponse.text();

            return json({
              error: 'Product identifier upsert failed',
              status: identifierInsertResponse.status,
              detail,
            }, 502);
          }
        }

        /*
         * 5. Rakuten 판매처 listing을 저장한다.
         *
         * itemCode는 상품 식별자가 아니라
         * 판매처별 listing 식별자로만 사용한다.
         */
        const listingResponse = await fetch(
          `${env.SUPABASE_URL}/rest/v1/market_listings?on_conflict=product_id,market,external_id`,
          {
            method: 'POST',
            headers: supabaseHeaders(
              env,
              'resolution=merge-duplicates,return=representation',
            ),
            body: JSON.stringify({
              product_id: product.id,
              market: 'rakuten-jp',
              external_id: item.itemCode,
              title: item.itemName,
              url: item.itemUrl ?? null,
              currency: 'JPY',
              price: item.itemPrice ?? null,
              condition: 'new',
              availability: item.availability
                ? 'available'
                : 'unavailable',
              observed_at: new Date().toISOString(),
            }),
          },
        );

        if (!listingResponse.ok) {
          const detail =
            await listingResponse.text();

          return json({
            error: 'Market listing upsert failed',
            status: listingResponse.status,
            detail,
          }, 502);
        }

        const listingRows =
          await listingResponse.json();

        const listing = Array.isArray(listingRows)
          ? listingRows[0]
          : listingRows;

        if (!listing?.id) {
          return json({
            error: 'Market listing upsert returned no listing id',
            detail: listingRows,
          }, 502);
        }

        /*
         * 6. 가격 이력을 기록한다.
         */
        const historyResponse = await fetch(
          `${env.SUPABASE_URL}/rest/v1/price_history`,
          {
            method: 'POST',
            headers: supabaseHeaders(env),
            body: JSON.stringify({
              market_listing_id: listing.id,
              price: item.itemPrice,
              currency: 'JPY',
              observed_at: new Date().toISOString(),
            }),
          },
        );

        if (!historyResponse.ok) {
          const detail =
            await historyResponse.text();

          return json({
            error: 'Price history insert failed',
            status: historyResponse.status,
            detail,
          }, 502);
        }

        return json({
          ok: true,
          source: 'rakuten',
          saved: true,
          identification: {
            identifierType,
            identifierValue,
            verifiedProduct,
          },
          product: {
            id: product.id,
            created: productCreated,
            canonicalKey: product.canonical_key,
            title: product.title,
            brand: product.brand,
            model: product.model,
          },
          listing: {
            id: listing.id,
            market: listing.market,
            externalId: listing.external_id,
            price: listing.price,
            currency: listing.currency,
          },
          priceHistory: {
            recorded: true,
            price: item.itemPrice,
            currency: 'JPY',
          },
        });
      } catch (error) {
        return json({
          error: 'Rakuten collection failed',
          detail: error instanceof Error ? error.message : String(error),
        }, 502);
      }
    }

    if (
      url.pathname === '/api/naver/smartstore-test' &&
      request.method === 'GET'
    ) {
      const smartStoreUrl =
        'https://smartstore.naver.com/parkerasahi/products/13237207848';

      try {
        const response = await fetch(
          smartStoreUrl,
          {
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
              'Accept':
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language':
                'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            },
          },
        );

        const responseText = await response.text();
        const html = responseText.toLowerCase();

        return json({
          ok: response.ok,
          source: 'naver-smartstore',
          status: response.status,
          contentType:
            response.headers.get('content-type'),
          contentLength: responseText.length,
          finalUrl: response.url,
          hasHtml: html.includes('<html'),
          hasProductId: html.includes('13237207848'),
          hasProductName:
            html.includes('productname') ||
            html.includes('product_name'),
          hasPrice:
            html.includes('"price"') ||
            html.includes('saleprice') ||
            html.includes('sale_price'),
        });
      } catch (error) {
        return json({
          error: 'Naver Smart Store fetch failed',
          detail:
            error instanceof Error
              ? error.message
              : String(error),
        }, 502);
      }
    }

    if (
      url.pathname === '/api/coupang-test' &&
      request.method === 'GET'
    ) {
      const coupangUrl =
        'https://www.coupang.com/vp/products/9275908532?itemId=27458787978&vendorItemId=94424084717';

      try {
        const response = await fetch(
          coupangUrl,
          {
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
              'Accept':
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language':
                'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            },
          },
        );

        const responseText = await response.text();
        const html = responseText.toLowerCase();

        return json({
          ok: response.ok,
          source: 'coupang',
          status: response.status,
          contentType:
            response.headers.get('content-type'),
          contentLength: responseText.length,
          finalUrl: response.url,
          hasHtml: html.includes('<html'),
          hasProductId:
            html.includes('9275908532'),
          hasProductNumber:
            html.includes('쿠팡상품번호') ||
            html.includes('productid'),
          hasPrice:
            html.includes('20,460') ||
            html.includes('"price"') ||
            html.includes('price'),
          hasSeller:
            html.includes('판매자') ||
            html.includes('seller'),
        });
      } catch (error) {
        return json({
          error: 'Coupang fetch failed',
          detail:
            error instanceof Error
              ? error.message
              : String(error),
        }, 502);
      }
    }

               if (
  url.pathname === '/api/korean-price/search' &&
  request.method === 'GET'
) {
  const keyword =
    url.searchParams.get('keyword')?.trim();

  if (!keyword) {
    return json({
      error: 'keyword is required',
    }, 400);
  }

  try {
    const aggregateResult =
      await searchKoreanPriceProviders(
        keyword,
      );

    const successfulProviders =
      aggregateResult.providers.filter(
        (provider) => provider.ok,
      ).length;

return json({
  ok: successfulProviders > 0,
  source: 'korean-price-aggregator',
  keyword,
  providerCount:
    aggregateResult.providers.length,
  successfulProviderCount:
    successfulProviders,
  productCount:
    aggregateResult.candidates.length,
  filteredProductCount:
    aggregateResult.filteredCandidates.length,
  providers:
    aggregateResult.providers,
  candidates:
    aggregateResult.candidates,
  filteredCandidates:
    aggregateResult.filteredCandidates,
  matchedCandidates:
    aggregateResult.matchedCandidates,
});

  } catch (error) {
    return json({
      error: 'Korean price provider search failed',
      detail:
        error instanceof Error
          ? error.message
          : String(error),
    }, 502);
  }
}

if (
  url.pathname === '/api/danawa/search' &&
  request.method === 'GET'
) {
  const keyword =
    url.searchParams.get('keyword')?.trim();

  if (!keyword) {
    return json({
      error: 'keyword is required',
    }, 400);
  }

  try {
    const providerResult =
      await searchDanawaProvider(
        keyword,
      );

    return json({
      ok: true,
      source: 'danawa',
      keyword,
      productCount:
        providerResult.candidates.length,
      providerResult,
    });
  } catch (error) {
    return json({
      error: 'Danawa search failed',
      detail:
        error instanceof Error
          ? error.message
          : String(error),
    }, 502);
  }
}

           if (
        url.pathname === '/api/enuri-test' &&
        request.method === 'GET'
      ) {
        const enuriUrl =
          'https://www.enuri.com/list.jsp?cate=05030939';

        try {
          const response = await fetch(
            enuriUrl,
            {
              method: 'GET',
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
                'Accept':
                  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language':
                  'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
              },
            },
          );

          const responseText = await response.text();

          const productMatches = [
            ...responseText.matchAll(
              /\{\\"index\\":\d+.*?\\"suffixText\\":\\".*?\\"\}/g,
            ),
          ];

          const products = productMatches
            .map((match) => {
              try {
                const productJson = match[0]
                  .replace(/\\"/g, '"');

                return JSON.parse(productJson) as {
                  index?: number;
                  displayOrder?: number;
                  productName?: string;
                  price?: number;
                  mallName?: string;
                  deliveryFeeText?: string;
                };
              } catch {
                return null;
              }
            })
            .filter(
              (
                product,
              ): product is NonNullable<typeof product> =>
                product !== null,
            );

          return json({
            ok: response.ok,
            source: 'enuri',
            status: response.status,
            finalUrl: response.url,
            productCount: products.length,
            products: products.map((product) => ({
              index:
                product.index ?? null,
              displayOrder:
                product.displayOrder ?? null,
              productName:
                product.productName ?? null,
              price:
                product.price ?? null,
              mallName:
                product.mallName ?? null,
              deliveryFeeText:
                product.deliveryFeeText ?? null,
            })),
          });
        } catch (error) {
          return json({
            error: 'Enuri fetch failed',
            detail:
              error instanceof Error
                ? error.message
                : String(error),
          }, 502);
        }
         }

      if (
        url.pathname === '/api/enuri/search' &&
        request.method === 'GET'
      ) {
        const keyword =
          url.searchParams.get('keyword')?.trim();

        if (!keyword) {
          return json({
            error: 'keyword is required',
          }, 400);
        }

        try {
          const providerResult =
            await searchEnuriProvider(
              keyword,
            );

          return json({
            ok: true,
            source: 'enuri',
            keyword,
            productCount:
              providerResult.candidates.length,
            providerResult,
          });
        } catch (error) {
          return json({
            error: 'Enuri search failed',
            detail:
              error instanceof Error
                ? error.message
                : String(error),
          }, 502);
        }
      }

      if (
        url.pathname === '/api/enuri/catalog' &&
        request.method === 'GET'
      ) {
        const catalogNo = url.searchParams.get('catalogNo')?.trim();

        if (!catalogNo) {
          return json({
            error: 'catalogNo is required',
          }, 400);
        }

        const enuriUrl =
          `https://price.enuri.com/catalog/${encodeURIComponent(catalogNo)}`;

        try {
          const response = await fetch(
            enuriUrl,
            {
              method: 'GET',
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36',
                'Accept':
                  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language':
                  'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
              },
            },
          );

          const responseText = await response.text();

          if (!response.ok) {
            return json({
              ok: false,
              source: 'enuri',
              status: response.status,
              finalUrl: response.url,
              catalogNo,
              error: 'Enuri catalog fetch failed',
            }, 502);
          }

          const itemsMatch = responseText.match(
            /\{\\"hasUnitPrice\\":false,\\"selectedValue\\":\\"[^"]+\\",\\"items\\":(\[.*?\])\}/s,
          );

          if (!itemsMatch) {
            return json({
              ok: true,
              source: 'enuri',
              status: response.status,
              finalUrl: response.url,
              catalogNo,
              optionCount: 0,
              options: [],
              error: 'Catalog option data not found',
            });
          }

          let options: Array<{
            catalogNo?: string | number;
            value?: string | number;
            label?: string;
            price?: number | string;
            mallCount?: number | string;
          }>;

          try {
            const itemsJson = itemsMatch[1]
              .replace(/\\"/g, '"');

            options = JSON.parse(itemsJson);
          } catch (error) {
            return json({
              error: 'Enuri catalog option parse failed',
              detail:
                error instanceof Error
                  ? error.message
                  : String(error),
            }, 502);
          }

          return json({
            ok: true,
            source: 'enuri',
            status: response.status,
            finalUrl: response.url,
            catalogNo,
            optionCount: options.length,
            options: options.map((option) => ({
              catalogNo:
                option.catalogNo ?? null,
              value:
                option.value ?? null,
              label:
                option.label ?? null,
              price:
                option.price ?? null,
              mallCount:
                option.mallCount ?? null,
            })),
          });
        } catch (error) {
          return json({
            error: 'Enuri catalog fetch failed',
            detail:
              error instanceof Error
                ? error.message
                : String(error),
          }, 502);
        }
      }

if (
  url.pathname === '/api/enuri/match' &&
  request.method === 'GET'
) {
  const model = url.searchParams.get('model')?.trim();
  const brand = url.searchParams.get('brand')?.trim();
  const configuration =
    url.searchParams.get('configuration')?.trim();

  if (!model) {
    return json({
      error: 'model is required',
    }, 400);
  }

  if (!configuration) {
    return json({
      error: 'configuration is required',
    }, 400);
  }

  try {
    /*
     * 문자열 정규화
     */
    const normalize = (
      value: string | null | undefined,
    ) =>
      (value ?? '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[()[\]{}\-_/.,+]/g, '');

    const normalizedModel = normalize(model);
    const normalizedBrand = normalize(brand);
    const normalizedConfiguration =
      normalize(configuration);

    /*
     * 구성명 alias
     *
     * 예:
     * 28-60mm
     * 28-60mm F4-5.6
     * SEL2860
     * 2860
     */
    const configurationAliases =
  normalizedConfiguration
    ? [normalizedConfiguration]
    : [];

    const isConfigurationMatch = (
      value: string | null | undefined,
    ) => {
      const normalizedValue =
        normalize(value);

      if (!normalizedValue) {
        return false;
      }

      return configurationAliases.some(
        (alias) => {
          const normalizedAlias =
            normalize(alias);

          return (
            normalizedValue.includes(
              normalizedAlias,
            ) ||
            normalizedAlias.includes(
              normalizedValue,
            )
          );
        },
      );
    };

    /*
     * 1. Enuri 검색어 생성
     *
     * Enuri는 모델번호만으로 검색했을 때
     * 실제 카탈로그보다 판매상품 Redirect가
     * 많이 나올 수 있으므로 여러 검색어를
     * 순차적으로 사용한다.
     */
   const searchKeywords = [
  model,
  [
    brand,
    model,
  ]
    .filter(Boolean)
    .join(' '),
  [
    model,
    configuration,
  ]
    .filter(Boolean)
    .join(' '),
  [
    brand,
    model,
    configuration,
  ]
    .filter(Boolean)
    .join(' '),
]
  .map((keyword) => keyword.trim())
  .filter((keyword, index, array) =>
    keyword.length > 0 &&
    array.indexOf(keyword) === index,
  );

type EnuriProduct = {
  name: string | null;
  sku: string | null;
  lowPrice: number | string | null;
  highPrice: number | string | null;
  offerCount: number | string | null;
  url: string | null;
};

type CatalogCandidate =
  EnuriProduct & {
    score: number;
    searchKeyword: string;
  };

type SellerCandidate =
  EnuriProduct & {
    score: number;
    searchKeyword: string;
  };

/*
 * 2. 여러 검색어에서 카탈로그/판매상품 후보 수집
 */
const catalogCandidateMap =
  new Map<string, CatalogCandidate>();

const sellerCandidateMap =
  new Map<string, SellerCandidate>();

for (
  const searchKeyword of searchKeywords
) {
  const searchUrl =
    `https://price.enuri.com/search?keyword=${encodeURIComponent(searchKeyword)}`;

  const searchResponse =
    await fetch(
      searchUrl,
      {
        method: 'GET',
        headers: enuriHeaders(),
      },
    );

  const searchText =
    await searchResponse.text();

  if (!searchResponse.ok) {
    continue;
  }

  const jsonLdMatch =
    searchText.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/is,
    );

  if (!jsonLdMatch) {
    continue;
  }

  let jsonLd: {
    itemListElement?: Array<{
      item?: {
        name?: string;
        sku?: string;
        offers?: {
          lowPrice?: number | string;
          highPrice?: number | string;
          offerCount?: number | string;
        };
        url?: string;
      };
    }>;
  };

  try {
    jsonLd =
      JSON.parse(
        jsonLdMatch[1],
      );
  } catch {
    continue;
  }

  const products =
    (
      jsonLd.itemListElement ??
      []
    )
      .map((entry) => {
        const item =
          entry.item;

        if (!item) {
          return null;
        }

        return {
          name:
            item.name ??
            null,
          sku:
            item.sku ??
            null,
          lowPrice:
            item.offers
              ?.lowPrice ??
            null,
          highPrice:
            item.offers
              ?.highPrice ??
            null,
          offerCount:
            item.offers
              ?.offerCount ??
            null,
          url:
            item.url ??
            null,
        };
      })
      .filter(
        (
          product,
        ): product is EnuriProduct =>
          product !== null,
      );

  for (
    const product of products
  ) {
    if (
      typeof product.url !==
      'string'
    ) {
      continue;
    }

    const normalizedName =
      normalize(
        product.name,
      );

    /*
     * 중고 상품은 후보에서 제외한다.
     */
    if (
      normalizedName.includes(
        '중고',
      )
    ) {
      continue;
    }

    let score = 0;

    const modelMatched =
      normalizedModel.length > 0 &&
      normalizedName.includes(
        normalizedModel,
      );

    const brandMatched =
      normalizedBrand.length > 0 &&
      normalizedName.includes(
        normalizedBrand,
      );

    /*
     * 모델명은 필수 조건으로 사용한다.
     *
     * Enuri 검색 결과에는 액세서리/부품도 함께
     * 섞여 들어올 수 있기 때문에 모델명이 실제
     * 상품명에 존재하지 않는 후보는 제외한다.
     */
    if (!modelMatched) {
      continue;
    }

    score += 3;

    if (brandMatched) {
      score += 2;
    }

    /*
     * configuration은 판매상품의 경우
     * 검색 결과 상품명에서 직접 확인한다.
     *
     * 카탈로그 상품은 이후 상세 옵션에서
     * 다시 정확하게 확인한다.
     */
    const configurationMatchedInName =
      normalizedConfiguration.length > 0 &&
      isConfigurationMatch(
        product.name,
      );

    /*
     * 실제 Enuri 카탈로그
     *
     * /detail.jsp?modelno=...
     */
    const catalogMatch =
      /\/detail\.jsp\?modelno=\d+/i.test(
        product.url,
      );

    if (catalogMatch) {
      const catalogNo =
        product.sku?.trim();

      if (!catalogNo) {
        continue;
      }

      const existing =
        catalogCandidateMap.get(
          catalogNo,
        );

      if (
        !existing ||
        score > existing.score
      ) {
        catalogCandidateMap.set(
          catalogNo,
          {
            ...product,
            score,
            searchKeyword,
          },
        );
      }

      continue;
    }

    /*
     * 개별 판매상품
     *
     * /move/Redirect.jsp
     *
     * 이 단계에서는 판매상품 URL 자체를
     * 후보로 보존한다.
     *
     * 실제 가격/배송비는 다음 단계에서
     * Redirect 페이지를 직접 조회한다.
     */
    const sellerMatch =
  /\/move\/Redirect\.jsp/i.test(
    product.url,
  );

console.log(
  'ENURI_SELLER_CANDIDATE_DEBUG',
  {
    searchKeyword,
    name: product.name,
    url: product.url,
    normalizedName,
    normalizedModel,
    normalizedConfiguration,
    modelMatched,
    configurationMatchedInName,
    sellerMatch,
  },
);

if (!sellerMatch) {
  continue;
}

    /*
     * 판매상품은 configuration이 상품명에
     * 명시적으로 확인되는 경우만 우선한다.
     *
     * configuration이 없는 요청은
     * 별도의 구성 조건 없이 진행할 수 있다.
     */
    if (
      normalizedConfiguration &&
      !configurationMatchedInName
    ) {
      continue;
    }

    if (
      configurationMatchedInName
    ) {
      score += 4;
    }

    /*
     * 같은 판매상품이 여러 검색어에서
     * 발견될 수 있으므로 URL을 후보 키로 사용한다.
     */
    const sellerKey =
      product.url;

    const existing =
      sellerCandidateMap.get(
        sellerKey,
      );

    if (
      !existing ||
      score > existing.score
    ) {
      sellerCandidateMap.set(
        sellerKey,
        {
          ...product,
          score,
          searchKeyword,
        },
      );
    }
  }
}

const catalogCandidates =
  Array.from(
    catalogCandidateMap.values(),
  ).sort(
    (a, b) =>
      b.score - a.score,
  );

const sellerCandidates =
  Array.from(
    sellerCandidateMap.values(),
  ).sort(
    (a, b) =>
      b.score - a.score,
  );
    if (
  catalogCandidates.length === 0 &&
  sellerCandidates.length === 0
) {
  return json({
    matched: false,
    source: 'enuri',
    model,
    brand: brand ?? null,
    configuration,
    searchKeywords,
    candidateCount: 0,
    candidates: [],
    error:
      'No Enuri product candidate found',
  });
}

/*
 * 3. 개별 판매상품 후보 확인
 *
 * Enuri 검색 결과의 판매상품은 JSON-LD에
 * 가격 정보가 없는 경우가 많다.
 *
 * 따라서 Redirect.jsp를 직접 조회하여
 * 실제 판매가격과 배송비를 확인한다.
 */
for (
  const candidate of
    sellerCandidates
) {
  let price =
    Number(
      candidate.lowPrice,
    );

  let shippingText:
    string | null =
      null;

  /*
   * 검색 결과에 가격이 없으면
   * Enuri 판매상품 Redirect 페이지에서
   * 실제 가격을 조회한다.
   */
  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    if (
      typeof candidate.url !==
      'string'
    ) {
      continue;
    }

    try {
      const sellerResponse =
        await fetch(
          candidate.url,
          {
            method: 'GET',
            headers:
              enuriHeaders(),
            redirect:
              'follow',
          },
        );

      const sellerText =
        await sellerResponse.text();

      if (
        !sellerResponse.ok
      ) {
        continue;
      }

      /*
       * Enuri Redirect 페이지의
       * 실제 판매가격
       *
       * 예:
       * _conv.value = '546360';
       */
      const priceMatch =
        sellerText.match(
          /_conv\.value\s*=\s*['"]([\d,]+(?:\.\d+)?)['"]/i,
        );

      if (
        priceMatch
      ) {
        price =
          Number(
            priceMatch[1]
              .replace(
                /,/g,
                '',
              ),
          );
      }

      /*
       * 배송비 정보
       *
       * 예:
       * <span class="deli_price">
       *   (무료배송)
       */
      const shippingMatch =
        sellerText.match(
          /<span[^>]*class=["'][^"']*deli_price[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
        );

      if (
        shippingMatch
      ) {
        shippingText =
          shippingMatch[1]
            .replace(
              /<[^>]+>/g,
              '',
            )
            .replace(
              /\s+/g,
              ' ',
            )
            .trim();
      }

      /*
       * _conv.value가 없는 경우를 대비하여
       * Facebook Purchase 이벤트의 가격도 확인한다.
       *
       * 예:
       * fbq('track', 'Purchase',
       *   {value: 546360 , currency: 'KRW'});
       */
      if (
        !Number.isFinite(
          price,
        ) ||
        price <= 0
      ) {
        const purchasePriceMatch =
          sellerText.match(
            /fbq\(\s*['"]track['"]\s*,\s*['"]Purchase['"][\s\S]*?value\s*:\s*([\d,]+(?:\.\d+)?)/i,
          );

        if (
          purchasePriceMatch
        ) {
          price =
            Number(
              purchasePriceMatch[1]
                .replace(
                  /,/g,
                  '',
                ),
            );
        }
      }
    } catch {
      continue;
    }
  }

  console.log(
    'ENURI_SELLER_PRICE_DEBUG',
    {
      searchKeyword:
        candidate.searchKeyword,
      name:
        candidate.name,
      lowPrice:
        candidate.lowPrice,
      highPrice:
        candidate.highPrice,
      offerCount:
        candidate.offerCount,
      price,
      shippingText,
      url:
        candidate.url,
    },
  );

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    continue;
  }

  const normalizedCandidateName =
    normalize(
      candidate.name,
    );

  const normalizedSearchKeyword =
    normalize(
      candidate.searchKeyword,
    );

  const modelMatched =
    normalizedModel.length > 0 &&
    (
      normalizedCandidateName.includes(
        normalizedModel,
      ) ||
      normalizedSearchKeyword.includes(
        normalizedModel,
      )
    );

  const brandMatched =
    normalizedBrand.length > 0 &&
    normalizedCandidateName.includes(
      normalizedBrand,
    );

  const configurationMatched =
    !normalizedConfiguration ||
    isConfigurationMatch(
      candidate.name,
    );

  if (
    !modelMatched ||
    !configurationMatched
  ) {
    continue;
  }

  const confidenceScore =
    (modelMatched ? 4 : 0) +
    (brandMatched ? 2 : 0) +
    (configurationMatched ? 4 : 0);

  const confidence =
    confidenceScore >= 8
      ? 'high'
      : confidenceScore >= 5
        ? 'medium'
        : 'low';

  return json({
    matched: true,
    source: 'enuri',
    model,
    brand: brand ?? null,
    configuration,
    searchKeyword:
      candidate.searchKeyword,
    catalogNo: null,
    catalogUrl: null,
    productName:
      candidate.name ??
      null,
    option: {
      catalogNo: null,
      value: null,
      label:
        candidate.name ??
        null,
      price,
      shipping:
        shippingText,
      mallCount:
        candidate.offerCount ??
        null,
    },
    searchCandidate: {
      sku:
        candidate.sku ??
        null,
      lowPrice:
        candidate.lowPrice ??
        null,
      highPrice:
        candidate.highPrice ??
        null,
      offerCount:
        candidate.offerCount ??
        null,
      url:
        candidate.url ??
        null,
    },
    candidateCount:
      catalogCandidates.length +
      sellerCandidates.length,
    confidence,
  });
}    /*
     * 3. 카탈로그 상세에서 실제 옵션 확인
     */
    for (
      const candidate of
        catalogCandidates
    ) {
      const catalogNo =
        candidate.sku?.trim();

      if (!catalogNo) {
        continue;
      }

      const catalogUrl =
        `https://price.enuri.com/catalog/${encodeURIComponent(catalogNo)}`;

      const catalogResponse =
        await fetch(
          catalogUrl,
          {
            method: 'GET',
            headers: enuriHeaders(),
          },
        );

      const catalogText =
        await catalogResponse.text();

      if (!catalogResponse.ok) {
        continue;
      }

      const itemsMatch =
        catalogText.match(
          /\{\\"hasUnitPrice\\":false,\\"selectedValue\\":\\"[^"]+\\",\\"items\\":(\[.*?\])\}/s,
        );

      if (!itemsMatch) {
        continue;
      }

      let options: Array<{
        catalogNo?: string | number;
        value?: string | number;
        label?: string;
        price?: number | string;
        mallCount?: number | string;
      }>;

      try {
        const itemsJson =
          itemsMatch[1]
            .replace(
              /\\"/g,
              '"',
            );

        options =
          JSON.parse(
            itemsJson,
          );
      } catch {
        continue;
      }

      /*
       * 4. 정확한 구성의 옵션만 선택
       */
      const matchingOptions =
        options.filter(
          (option) => {
            const label =
              option.label ??
              '';

            const normalizedLabel =
              normalize(label);

            /*
             * 원하는 렌즈 구성
             */
            if (
              !isConfigurationMatch(
                label,
              )
            ) {
              return false;
            }

            /*
             * 중고 제외
             */
            if (
              normalizedLabel.includes(
                '중고',
              )
            ) {
              return false;
            }

           /*
 * 특정 액세서리명에 의존한
 * 상품 구성 제외 규칙은 사용하지 않는다.
 *
 * 번들/사은품/액세서리 여부는 향후
 * 상품 카테고리와 구성 데이터에 기반해
 * 별도 판정한다.
 */

            /*
             * 추가 렌즈 패키지 제외
             */
         // 상품 구성 자체에 대한 별도 카메라 전용 제외 규칙은 사용하지 않는다.

            return true;
          },
        );

      if (
        matchingOptions.length === 0
      ) {
        continue;
      }

      /*
       * 가격이 존재하는 옵션만 사용
       */
      const pricedOptions =
        matchingOptions
          .filter(
            (option) =>
              option.price !==
                undefined &&
              option.price !==
                null &&
              Number(
                option.price,
              ) > 0,
          )
          .sort(
            (a, b) =>
              Number(a.price) -
              Number(b.price),
          );

      if (
        pricedOptions.length === 0
      ) {
        continue;
      }

      const selectedOption =
        pricedOptions[0];

     const normalizedCandidateName =
  normalize(
    candidate.name,
  );

const normalizedSearchKeyword =
  normalize(
    candidate.searchKeyword,
  );

/*
 * 모델 매칭 증거
 *
 * 1. 카탈로그 상품명에 모델번호가 직접 포함되거나
 * 2. 해당 카탈로그를 찾은 검색어에 모델번호가 포함되면
 *
 * 모델이 검색 근거로 확인된 것으로 본다.
 */
const modelMatched =
  normalizedModel.length > 0 &&
  (
    normalizedCandidateName.includes(
      normalizedModel,
    ) ||
    normalizedSearchKeyword.includes(
      normalizedModel,
    )
  );

const brandMatched =
  normalizedBrand.length > 0 &&
  normalizedCandidateName.includes(
    normalizedBrand,
  );

/*
 * configuration은 검색 결과 상품명이 아니라
 * 카탈로그 상세 페이지의 실제 옵션에서 확인한다.
 */
const configurationMatched =
  matchingOptions.length > 0;

/*
 * 신뢰도 점수
 *
 * 모델 검색/상품명 일치  +4
 * 브랜드 일치             +2
 * 상세 옵션 일치          +4
 *
 * 최대 10점.
 *
 * 특정 제품명에 대한 별도 보정은 사용하지 않는다.
 */
const confidenceScore =
  (modelMatched ? 4 : 0) +
  (brandMatched ? 2 : 0) +
  (configurationMatched ? 4 : 0);

console.log('ENURI_MATCH_CONFIDENCE_DEBUG', {
  normalizedModel,
  normalizedBrand,
  normalizedCandidateName,
  normalizedSearchKeyword,
  modelMatched,
  brandMatched,
  configurationMatched,
  confidenceScore,
});

const confidence =
  confidenceScore >= 8
    ? 'high'
    : confidenceScore >= 5
      ? 'medium'
      : 'low';

      return json({
        matched: true,
        source: 'enuri',
        model,
        brand: brand ?? null,
        configuration,
        searchKeyword:
          candidate.searchKeyword,
        catalogNo,
        catalogUrl,
        productName:
          candidate.name ??
          null,
        option: {
          catalogNo:
            selectedOption.catalogNo ??
            null,
          value:
            selectedOption.value ??
            null,
          label:
            selectedOption.label ??
            null,
          price:
            selectedOption.price ??
            null,
          mallCount:
            selectedOption.mallCount ??
            null,
        },
        searchCandidate: {
          sku:
            candidate.sku ??
            null,
          lowPrice:
            candidate.lowPrice ??
            null,
          highPrice:
            candidate.highPrice ??
            null,
          offerCount:
            candidate.offerCount ??
            null,
          url:
            candidate.url ??
            null,
        },
        candidateCount:
          catalogCandidates.length,
        confidence,
      });
    }

    return json({
      matched: false,
      source: 'enuri',
      model,
      brand: brand ?? null,
      configuration,
      searchKeywords,
      candidateCount:
        catalogCandidates.length,
      candidates:
        catalogCandidates
          .slice(0, 10)
          .map(
            (candidate) => ({
              name:
                candidate.name ??
                null,
              sku:
                candidate.sku ??
                null,
              lowPrice:
                candidate.lowPrice ??
                null,
              highPrice:
                candidate.highPrice ??
                null,
              offerCount:
                candidate.offerCount ??
                null,
              url:
                candidate.url ??
                null,
              score:
                candidate.score,
              searchKeyword:
                candidate.searchKeyword,
            }),
          ),
      error:
        'Matching Enuri catalog option not found',
    });
  } catch (error) {
    return json({
      error: 'Enuri match failed',
      detail:
        error instanceof Error
          ? error.message
          : String(error),
    }, 502);
  }
}

return json({ error: 'Not Found' }, 404);
 },
};



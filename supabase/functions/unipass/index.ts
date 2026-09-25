// 관세청 UNI-PASS 화물통관진행정보(API001) 중계 함수
// 인증키는 Supabase 비밀값(UNIPASS_KEY)에 저장되어 브라우저에 노출되지 않습니다.
// 배포: npx supabase functions deploy unipass --no-verify-jwt

const API_URL =
  "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";

// 이 함수를 부를 수 있는 웹페이지 주소(Origin). 경로(/customs-tracker/)는 넣지 않습니다.
// Supabase 비밀값 ALLOWED_ORIGIN 으로 바꿀 수 있고, 여러 개는 쉼표로 구분합니다.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGIN") ?? "https://mykim-app.github.io")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);

// 주소창에서 직접 여는 경우(Origin 없음)는 점검용으로 허용하고,
// 다른 사이트의 페이지에서 부르는 경우는 거부합니다.
const originAllowed = (origin: string | null) => !origin || ALLOWED_ORIGINS.includes(origin);

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
    "Vary": "Origin",
  };
}

// 응답 XML이 단순한 구조라 외부 라이브러리 없이 태그 단위로 읽습니다.
function blocks(xml: string, tag: string): Record<string, string>[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const out: Record<string, string>[] = [];
  for (const m of xml.matchAll(re)) {
    const obj: Record<string, string> = {};
    for (const f of m[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) obj[f[1]] = f[2].trim();
    out.push(obj);
  }
  return out;
}
const text = (xml: string, tag: string) =>
  (xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? "").trim();

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (!originAllowed(origin)) return json({ error: "허용되지 않은 주소에서의 요청입니다." }, 403, origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  const key = Deno.env.get("UNIPASS_KEY");
  if (!key) return json({ error: "서버에 인증키가 설정되지 않았습니다." }, 500, origin);

  const u = new URL(req.url);
  const no = (u.searchParams.get("no") ?? "").trim().replace(/-/g, "");
  let kind = u.searchParams.get("kind") ?? "hblNo";
  const year = (u.searchParams.get("year") ?? "").trim();
  if (!["hblNo", "mblNo", "cargMtNo"].includes(kind)) kind = "hblNo";
  if (!/^[A-Za-z0-9]{4,35}$/.test(no)) return json({ error: "번호 형식이 올바르지 않습니다." }, 400, origin);
  if (kind !== "cargMtNo" && !/^\d{4}$/.test(year)) return json({ error: "B/L 연도를 입력하세요." }, 400, origin);

  const params = new URLSearchParams({ crkyCn: key, [kind]: no });
  if (kind !== "cargMtNo") params.set("blYy", year);

  try {
    const r = await fetch(`${API_URL}?${params}`, { signal: AbortSignal.timeout(15000) });
    const xml = await r.text();
    if (!xml.includes("cargCsclPrgsInfoQryRtnVo")) {
      return json({ error: "관세청 응답을 읽지 못했습니다. 인증키를 확인하세요." }, 502, origin);
    }
    return json({
      notice: text(xml, "ntceInfo"),
      total: text(xml, "tCnt"),
      summaries: blocks(xml, "cargCsclPrgsInfoQryVo"),
      details: blocks(xml, "cargCsclPrgsInfoDtlQryVo"),
    }, 200, origin);
  } catch (e) {
    return json({ error: `관세청 서버에 연결하지 못했습니다: ${e}` }, 502, origin);
  }
});

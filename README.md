# 통관 진행 조회 (GitHub Pages + Supabase)

- 화면 주소: https://mykim-app.github.io/customs-tracker/
- 구조: 브라우저 → GitHub Pages(index.html) → Supabase 함수 unipass(서울 리전) → 관세청 유니패스 API
- 허용 주소(ALLOWED_ORIGIN): https://mykim-app.github.io (함수 코드에 기본값으로 들어 있음)

## 1. 유니패스 인증키 발급
유니패스 로그인 → My 메뉴 → 서비스관리 → OpenAPI 사용관리 → '화물통관진행정보조회' 신청 → 승인 후 인증키 확인

## 2. Supabase 함수 만들기 (대시보드)
1. Supabase 대시보드에서 프로젝트 선택 (MBTI 사이트 프로젝트를 같이 써도 됨)
2. Edge Functions → Secrets 에 추가
   - UNIPASS_KEY = 유니패스 인증키
   - (선택) ALLOWED_ORIGIN = https://mykim-app.github.io
3. Edge Functions → 새 함수 만들기(편집기) → 이름: unipass
4. supabase/functions/unipass/index.ts 내용을 붙여 넣고 배포
5. 함수 설정(Details/Settings)에서 JWT 검증(Verify JWT) 끄기 → 저장

CLI를 쓸 경우:
    npx supabase login
    npx supabase link --project-ref <REF>
    npx supabase secrets set UNIPASS_KEY=<인증키>
    npx supabase functions deploy unipass --no-verify-jwt

## 3. 함수 점검 (브라우저 주소창)
    https://<REF>.supabase.co/functions/v1/unipass?no=<운송장번호>&kind=hblNo&year=2026&forceFunctionRegion=ap-northeast-2
- JSON이 나오면 정상
- "인증키가 설정되지 않았습니다" → Secrets 이름 확인 후 함수 재배포
- 401 오류 → JWT 검증이 켜져 있음
- "관세청 서버에 연결하지 못했습니다" → 서울 리전 접속 문제, 별도 조치 필요

## 4. GitHub Pages 게시
1. index.html 의 FUNCTION_URL 을 https://<REF>.supabase.co/functions/v1/unipass 로 수정
2. GitHub에서 mykim-app/customs-tracker 저장소 생성(Public) → index.html 업로드
   (supabase 폴더와 README.md는 올려도 되고 안 올려도 됨. 인증키는 들어 있지 않음)
3. Settings → Pages → Deploy from a branch → main / (root) → Save
4. 1~2분 뒤 https://mykim-app.github.io/customs-tracker/ 접속

## 참고
- ALLOWED_ORIGIN 은 도메인까지만 적습니다. /customs-tracker/ 같은 경로를 붙이면 차단됩니다.
- 주소창 직접 호출(점검용)은 허용됩니다. 다른 사이트 페이지에서의 호출만 막습니다.
- 조회 건수는 본인 인증키 사용량으로 잡힙니다.

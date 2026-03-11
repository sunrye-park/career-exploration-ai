# Career Exploration AI

AI 기반 진로 탐색 웹앱입니다.

## Local

```bash
npm start
```

필수 환경변수:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (선택, 기본값 `gpt-4.1`)

## Vercel

Vercel 프로젝트 환경변수에 아래 값을 설정합니다.

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (선택)

정적 파일은 루트의 `index.html`에서 서비스되고, API 요청은 `api/generate.js`를 사용합니다.

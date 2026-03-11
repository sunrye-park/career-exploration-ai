const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';

function sendJson(res, statusCode, body) {
  res.status(statusCode).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: '허용되지 않은 요청입니다.' });
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(res, 500, { error: '서버에 OPENAI_API_KEY가 설정되지 않았어요.' });
    return;
  }

  const { prompt, schemaName, schema } = req.body || {};
  if (!prompt || !schemaName || !schema) {
    sendJson(res, 400, { error: '생성 요청 값이 부족해요.' });
    return;
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.9,
      messages: [
        {
          role: 'system',
          content: '너는 진로 탐색 앱의 JSON 생성 엔진이다. 반드시 스키마에 맞는 JSON만 반환한다. 여러 항목을 생성할 때 각 항목의 이름과 내용은 반드시 서로 달라야 한다. 절대 같은 항목을 반복하지 마라.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = data?.error?.message || `HTTP ${upstream.status}`;
    sendJson(res, upstream.status, { error: message, details: data });
    return;
  }

  const raw = data?.choices?.[0]?.message?.content || '';
  if (!raw) {
    sendJson(res, 502, { error: 'OpenAI 응답이 비어있어요.', details: data });
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    sendJson(res, 200, { result: parsed, raw });
  } catch {
    sendJson(res, 502, { error: 'OpenAI 응답 형식 오류', raw, details: data });
  }
}

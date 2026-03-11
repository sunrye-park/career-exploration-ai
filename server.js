import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function handleGenerate(req, res) {
  if (!OPENAI_API_KEY) {
    sendJson(res, 500, { error: '서버에 OPENAI_API_KEY가 설정되지 않았어요.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: '요청 형식이 올바르지 않아요.' });
    return;
  }

  const { prompt, schemaName, schema } = payload || {};

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
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: '너는 진로 탐색 앱의 JSON 생성 엔진이다. 반드시 스키마에 맞는 JSON만 반환한다.'
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

async function handleStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(__dirname, pathname);

  try {
    const data = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: '파일을 찾을 수 없어요.' });
  }
}

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') {
    await handleGenerate(req, res);
    return;
  }

  if (req.method === 'GET') {
    await handleStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: '허용되지 않은 요청입니다.' });
}).listen(PORT, () => {
  console.log(`career_exploration_ai server running on http://localhost:${PORT}`);
});

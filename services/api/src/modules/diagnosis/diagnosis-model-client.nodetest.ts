import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BailianDiagnosisModelClient } from './diagnosis-model-client';
import { DiagnosisAiService } from './diagnosis-ai.service';

test('Bailian client calls deepseek-v4-pro through the OpenAI-compatible endpoint', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(url);
    requestedInit = init;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'provider-request-1',
        model: 'deepseek-v4-pro',
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        choices: [{ message: { content: '{"mappedPainIds":[]}' } }],
      }),
    } as Response;
  }) as typeof fetch;

  const client = new BailianDiagnosisModelClient(
    {
      apiKey: 'test-key',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
      model: 'deepseek-v4-pro',
    },
    fetchImpl
  );

  const completion = await client.completeJson({ system: 'system', user: 'user', maxTokens: 800 });
  const body = JSON.parse(String(requestedInit?.body));

  assert.equal(requestedUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal((requestedInit?.headers as Record<string, string>).Authorization, 'Bearer test-key');
  assert.equal(body.model, 'deepseek-v4-pro');
  assert.equal(body.enable_thinking, false);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(completion.content, '{"mappedPainIds":[]}');
  assert.equal(completion.providerRequestId, 'provider-request-1');
  assert.equal(completion.usage?.totalTokens, 20);
});

test('Bailian client rejects provider errors without exposing the response body', async () => {
  const fetchImpl = (async () =>
    ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'secret' }),
    }) as Response) as typeof fetch;
  const client = new BailianDiagnosisModelClient(
    {
      apiKey: 'bad-key',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'deepseek-v4-pro',
    },
    fetchImpl
  );

  await assert.rejects(
    client.completeJson({ system: 'system', user: 'user', maxTokens: 100 }),
    /HTTP 401/
  );
});

test('Diagnosis AI uses Bailian when its API key is configured', async () => {
  const previousKey = process.env.DIAGNOSIS_AI_API_KEY;
  const previousFetch = global.fetch;
  let requestedBody = '';
  process.env.DIAGNOSIS_AI_API_KEY = 'test-key';
  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestedBody = String(init?.body || '');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"mappedPainIds":[],"discoveredPains":[],"nextQuestion":null,"summary":"test summary"}',
            },
          },
        ],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const result = await new DiagnosisAiService().advise({
      text: 'test input',
      profile: { city: '上海', area: 120, phone: '13800000000', customerName: '测试客户' },
    });
    assert.equal(result.source, 'model');
    assert.equal(result.summary, 'test summary');
    assert.match(result.requestId, /^[0-9a-f-]{36}$/);
    assert.match(requestedBody, /上海/);
    assert.doesNotMatch(requestedBody, /13800000000|测试客户|customerName|phone/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.DIAGNOSIS_AI_API_KEY;
    else process.env.DIAGNOSIS_AI_API_KEY = previousKey;
  }
});

test('Diagnosis AI falls back to rules when Bailian fails', async () => {
  const previousKey = process.env.DIAGNOSIS_AI_API_KEY;
  const previousFetch = global.fetch;
  process.env.DIAGNOSIS_AI_API_KEY = 'test-key';
  global.fetch = (async () => ({ ok: false, status: 503 }) as Response) as typeof fetch;

  try {
    const result = await new DiagnosisAiService().advise({ text: 'test input' });
    assert.equal(result.source, 'rules');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.DIAGNOSIS_AI_API_KEY;
    else process.env.DIAGNOSIS_AI_API_KEY = previousKey;
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiGatewayService } from './ai-gateway.service';

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

test('copy generation uses Hermes center AI stream when requested', async () => {
  const oldBaseUrl = process.env.HERMES_CENTER_AI_BASE_URL;
  const oldProvider = process.env.HERMES_CENTER_AI_PROVIDER;
  const oldAuthHeader = process.env.HERMES_CENTER_AI_AUTH_HEADER;
  const oldAuthToken = process.env.HERMES_CENTER_AI_AUTH_TOKEN;
  const oldFetch = global.fetch;
  let capturedUrl = '';
  let capturedBody: any = null;

  process.env.HERMES_CENTER_AI_BASE_URL = 'https://center-ai.test/';
  process.env.HERMES_CENTER_AI_PROVIDER = 'qwen-max';
  process.env.HERMES_CENTER_AI_AUTH_HEADER = 'authorization';
  process.env.HERMES_CENTER_AI_AUTH_TOKEN = 'Bearer test-token';
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body || '{}'));
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer test-token');
    return sseResponse([
      'data: {"content":"标题：热水器推广文案\\n"}\n\n',
      'data: {"choices":[{"delta":{"content":"正文：围绕真实痛点展开。"}}]}\n\n',
    ]);
  }) as typeof fetch;

  try {
    const service = new AiGatewayService();
    const result = await service.generateDraft({
      provider: 'hermes-center-ai',
      requireRealProvider: true,
      channel: 'xiaohongshu',
      prompt: '写一条推广热水器的文案',
      brand: { name: 'Rhautt Comfort', facts: ['提供热水与舒适系统服务'] },
    });

    assert.equal(capturedUrl, 'https://center-ai.test/api/llm-stream');
    assert.equal(capturedBody.teamProvider, 'qwen-max');
    assert.match(capturedBody.messages[0].content, /完整营销文案草稿/);
    assert.match(capturedBody.messages[1].content, /写一条推广热水器的文案/);
    assert.equal(result.provider, 'hermes-center-ai');
    assert.equal(result.model, 'qwen-max');
    assert.match(result.draft, /标题：热水器推广文案/);
    assert.match(result.draft, /正文：围绕真实痛点展开。/);
  } finally {
    restoreEnv('HERMES_CENTER_AI_BASE_URL', oldBaseUrl);
    restoreEnv('HERMES_CENTER_AI_PROVIDER', oldProvider);
    restoreEnv('HERMES_CENTER_AI_AUTH_HEADER', oldAuthHeader);
    restoreEnv('HERMES_CENTER_AI_AUTH_TOKEN', oldAuthToken);
    global.fetch = oldFetch;
  }
});

test('copy generation does not silently fall back when Hermes is required', async () => {
  const oldBaseUrl = process.env.HERMES_CENTER_AI_BASE_URL;
  delete process.env.HERMES_CENTER_AI_BASE_URL;

  try {
    const service = new AiGatewayService();
    await assert.rejects(
      () => service.generateDraft({
        provider: 'hermes-center-ai',
        requireRealProvider: true,
        channel: 'xiaohongshu',
        prompt: '写一条推广热水器的文案',
      }),
      /HERMES_CENTER_AI_BASE_URL is not configured/,
    );
  } finally {
    restoreEnv('HERMES_CENTER_AI_BASE_URL', oldBaseUrl);
  }
});

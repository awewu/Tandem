import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transcribe } from '@/lib/infra/transcribe';

const aiSettings = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('@/lib/settings/ai-settings', () => ({
  getAiSettings: vi.fn(async () => aiSettings.current),
}));

describe('transcribe', () => {
  beforeEach(() => {
    aiSettings.current = {};
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses DashScope chat completions with input_audio payload', async () => {
    aiSettings.current = {
      sttProvider: 'dashscope',
      sttModel: 'qwen3-asr-flash',
      sttApiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      sttApiKey: 'test-key',
    };
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '转写结果' } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await transcribe(new Blob(['abc'], { type: 'audio/webm' }), 'audio.webm', 'zh');

    expect(result).toEqual({ ok: true, text: '转写结果' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
    const dashScopeCall = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(dashScopeCall[1].body as string);
    expect(body.model).toBe('qwen3-asr-flash');
    expect(body.messages[0].content[0]).toEqual({
      type: 'input_audio',
      input_audio: {
        data: 'data:audio/webm;base64,YWJj',
      },
    });
    expect(body.asr_options).toEqual({ language: 'zh', enable_itn: false });
  });

  it('keeps OpenAI-compatible STT on multipart upload', async () => {
    aiSettings.current = {
      sttProvider: 'openai',
      sttModel: 'whisper-1',
      sttApiUrl: 'https://api.openai.com/v1/audio/transcriptions',
      sttApiKey: 'test-key',
    };
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ text: ' hello ' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await transcribe(new Blob(['abc'], { type: 'audio/webm' }), 'audio.webm', 'zh');

    expect(result).toEqual({ ok: true, text: 'hello' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({ method: 'POST' }),
    );
    const openAiCall = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = openAiCall[1].body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('model')).toBe('whisper-1');
    expect((body as FormData).get('language')).toBe('zh');
  });
});

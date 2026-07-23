export interface DiagnosisModelClientConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export interface DiagnosisModelRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface DiagnosisModelCompletion {
  content: string;
  providerRequestId?: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface BailianChatCompletion {
  id?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export class BailianDiagnosisModelClient {
  constructor(
    private readonly config: DiagnosisModelClientConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async completeJson(request: DiagnosisModelRequest): Promise<DiagnosisModelCompletion> {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    const response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        max_tokens: request.maxTokens,
        enable_thinking: false,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
    });

    if (!response.ok) {
      throw new Error(`Bailian request failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as BailianChatCompletion;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('empty Bailian model response');
    return {
      content,
      providerRequestId: payload.id,
      model: payload.model,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
    };
  }
}

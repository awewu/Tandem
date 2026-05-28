// 直接验证 DeepSeek API 是否真接通
const apiKey = process.env.DEEPSEEK_API_KEY;
const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

if (!apiKey) {
  console.error('❌ DEEPSEEK_API_KEY not set');
  process.exit(1);
}

console.log(`▶ Testing ${model} at ${baseUrl}`);
console.log(`  API key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);

const start = Date.now();
const r = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model,
    messages: [
      { role: 'system', content: '你是 Tandem 的 AI 分身。' },
      { role: 'user', content: '用一句话证明你是真实的大模型，并报出你的型号。' },
    ],
    max_tokens: 100,
  }),
});

const j = await r.json();
const elapsed = Date.now() - start;

console.log(`\n✓ STATUS: ${r.status}`);
console.log(`✓ ELAPSED: ${elapsed}ms`);
if (j.choices?.[0]?.message?.content) {
  console.log(`\n📤 LLM REPLY:\n  ${j.choices[0].message.content}`);
  console.log(`\n📊 USAGE: ${JSON.stringify(j.usage)}`);
  console.log('\n✅ DeepSeek API 接通正常');
} else {
  console.error('❌ LLM 返回失败:', JSON.stringify(j, null, 2));
  process.exit(2);
}

import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    let payload = '';
    try {
      const json = await req.json();
      payload = typeof json === 'string' ? json : JSON.stringify(json);
    } catch {
      payload = await req.text();
    }

    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    let rawBaseUrl = (process.env.OPENAI_BASE_URL || 'https://api.siliconflow.cn/v1').trim();
    const model = (process.env.OPENAI_MODEL || 'deepseek-ai/DeepSeek-V3').trim();

    // 自动补全 URL 协议，防止 Invalid URL 异常
    if (!rawBaseUrl.startsWith('http://') && !rawBaseUrl.startsWith('https://')) {
      rawBaseUrl = `https://${rawBaseUrl}`;
    }
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const apiUrl = `${baseUrl}/chat/completions`;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: '未配置 OPENAI_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `你是一位精通倪海厦《天纪》体系的紫微斗数命理大师。
请针对用户提供的命盘信息、宫位吉凶星曜、四化格局进行详细、生动且深刻的推理解读。
直接输出命理解读正文，结构清晰，语言通俗。`;

    // 向上游发起请求
    const upstreamRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请帮我解读以下紫微斗数命盘：\n\n${payload}` },
        ],
        stream: true,
      }),
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      const errText = await upstreamRes.text();
      return new Response(errText, { status: upstreamRes.status });
    }

    // 原生 SSE 流透传
    return new Response(upstreamRes.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || '未知错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

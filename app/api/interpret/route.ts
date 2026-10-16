import { NextRequest } from 'next/server';

export const runtime = 'edge'; // 必须使用 edge，解除 Vercel 超时限制并支持流式直通

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
    const model = process.env.OPENAI_MODEL || 'deepseek-ai/DeepSeek-V3';

    if (!apiKey) {
      return new Response('未配置 OPENAI_API_KEY', { status: 500 });
    }

    const systemPrompt = `你是一位精通倪海厦《天纪》体系的紫微斗数命理大师。
请结合用户提供的命盘信息、宫位吉凶星曜、四化格局进行深入、专业且通俗的推理解读。
请直接输出解读正文，排版清晰易读。`;

    const userMessage = typeof body === 'string' ? body : JSON.stringify(body, null, 2);

    // 请求硅基流动，开启流式 (stream: true)
    const upstreamRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请结合以下命盘信息解读：\n\n${userMessage}` },
        ],
        stream: true,
      }),
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      const errText = await upstreamRes.text();
      return new Response(`大模型响应异常: ${errText}`, { status: upstreamRes.status });
    }

    // 将 OpenAI 格式的 SSE 数据流清洗为前端所需的逐字纯文本流
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') return;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const deltaContent = json.choices?.[0]?.delta?.content || '';
              if (deltaContent) {
                controller.enqueue(encoder.encode(deltaContent));
              }
            } catch (e) {
              // 忽略残缺的数据包
            }
          }
        }
      },
    });

    return new Response(upstreamRes.body.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(`服务异常: ${err.message}`, { status: 500 });
  }
}

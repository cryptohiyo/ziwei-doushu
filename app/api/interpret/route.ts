import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
    const model = process.env.OPENAI_MODEL || 'deepseek-ai/DeepSeek-V3';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: '未配置 OPENAI_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 提取前端传入的命盘及问题
    const promptData = typeof body === 'string' ? body : JSON.stringify(body);

    const systemPrompt = `你是一位精通倪海厦《天纪》紫微斗数的命理大师。
请针对用户提供的紫微斗数命盘数据、宫位吉凶星曜、四化格局进行详细、生动且深刻的推理解读。
直接输出命理解读正文，条理分明，不要说无关的客套话。`;

    // 向上游硅基流动发起请求
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
          { role: 'user', content: `请帮我解读以下紫微斗数命盘：\n\n${promptData}` },
        ],
        stream: true,
      }),
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      const errText = await upstreamRes.text();
      return new Response(errText, { status: upstreamRes.status });
    }

    // 将大模型的 SSE 原生流无损直透给前端浏览器
    return new Response(upstreamRes.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

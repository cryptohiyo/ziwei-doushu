import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // 支持极速流式响应

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
    const model = process.env.OPENAI_MODEL || 'deepseek-ai/DeepSeek-V3';

    if (!apiKey) {
      return NextResponse.json(
        { error: '未检测到 OPENAI_API_KEY，请在 Vercel 环境变量中配置。' },
        { status: 500 }
      );
    }

    // 组装 Prompt 提示词
    const systemPrompt = `你是一位精通倪海厦《天纪》紫微斗数的命理大师。
请结合用户提供的紫微斗数命盘数据、宫位、主星、四化及神煞，进行专业、温和且有启发性的命理解读。
解读要求：
1. 语言通俗易懂，契合传统命理精髓，避免绝对化和恐吓性断语；
2. 重点分析用户的性格特质、事业财运趋势、情感建议以及运势调和指引。`;

    const userMessage = typeof body === 'string' ? body : JSON.stringify(body, null, 2);

    // 请求硅基流动大模型接口
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下是我的紫微斗数命盘信息，请为我进行深度解读：\n\n${userMessage}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `大模型请求异常: ${errText}` }, { status: response.status });
    }

    // 将大模型的流式结果直接转发给前端网页
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '服务器内部错误' }, { status: 500 });
  }
}

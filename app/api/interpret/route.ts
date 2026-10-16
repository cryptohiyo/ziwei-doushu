import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
    const model = process.env.OPENAI_MODEL || 'deepseek-ai/DeepSeek-V3';

    if (!apiKey) {
      return NextResponse.json({ 
        content: '未检测到 API Key，请检查 Vercel 环境变量配置。',
        text: '未检测到 API Key，请检查 Vercel 环境变量配置。' 
      }, { status: 500 });
    }

    // 组装 Prompt
    const systemPrompt = `你是一位精通倪海厦《天纪》体系的紫微斗数命理大师。
请根据用户提供的命盘信息、宫位星曜、四化格局进行专业通俗的解读。
请直接输出解读正文，不要输出多余的开场白或客套话。`;

    const userMessage = typeof body === 'string' ? body : JSON.stringify(body, null, 2);

    // 请求硅基流动大模型
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
          { role: 'user', content: `请结合以下命盘信息进行深度推理解读：\n\n${userMessage}` },
        ],
        stream: false, // 改为非流式，一次性返回完整结果，兼容性最好
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ 
        content: `大模型请求异常: ${errText}`,
        text: `大模型请求异常: ${errText}` 
      }, { status: 200 });
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || '未能生成解读内容';

    // 同时兼顾 content、text、message 等各种常见字段，确保前端能拿到内容
    return NextResponse.json({
      content: resultText,
      text: resultText,
      data: resultText,
      message: resultText,
      result: resultText,
    });
  } catch (error: any) {
    return NextResponse.json({ 
      content: `服务端异常: ${error.message}`,
      text: `服务端异常: ${error.message}` 
    }, { status: 500 });
  }
}

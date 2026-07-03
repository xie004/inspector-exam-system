import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// 校验是否为管理员
function checkAdmin(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload || payload.role !== 'ADMIN') {
    return null;
  }
  return payload;
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    let { baseUrl, apiKey } = body;

    // 获取当前保存的配置，用作回退
    const dbConfig = await db.aiConfig.findUnique({
      where: { id: 'default' },
    });

    // 智能选择配置：如果前端没有传递，或者传递的是掩码，则回退到数据库已存配置
    const finalBaseUrl = (baseUrl && baseUrl.trim() !== '') ? baseUrl.trim() : (dbConfig?.baseUrl || '');
    let finalApiKey = (apiKey && apiKey.trim() !== '') ? apiKey.trim() : (dbConfig?.apiKey || '');

    if (finalApiKey && (finalApiKey.includes('••') || finalApiKey === '••••••••')) {
      finalApiKey = dbConfig?.apiKey || '';
    }

    if (!finalBaseUrl) {
      return NextResponse.json({ error: '缺少 API Base URL 配置' }, { status: 400 });
    }

    // 格式化 Base URL，确保末尾没有多余斜杠，但保留 /v1（若用户没写，标准 OpenAI 会需要）
    let targetUrl = finalBaseUrl.replace(/\/+$/, '');
    const modelsUrl = `${targetUrl}/models`;

    console.log('正在请求模型列表:', modelsUrl);

    // 发起网络请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时限制

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (finalApiKey) {
      headers['Authorization'] = `Bearer ${finalApiKey}`;
    }

    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `HTTP Error ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.error?.message || errData.message || errorMsg;
        } catch (e) {
          // 无法解析为 JSON，保持原样
        }
        return NextResponse.json(
          { error: `连接大模型服务商失败: ${errorMsg} (状态码: ${response.status})` },
          { status: 400 }
        );
      }

      const data = await response.json();

      // 标准 OpenAI 响应结构为 { object: 'list', data: [ { id: 'xxx', ... } ] }
      // 部分兼容性不佳的国内端点可能返回数组，在此做健壮性兼容
      let modelsList: any[] = [];
      if (data && Array.isArray(data.data)) {
        modelsList = data.data;
      } else if (Array.isArray(data)) {
        modelsList = data;
      } else {
        return NextResponse.json(
          { error: '接口返回了非标准的模型列表格式，请核对大模型 API Base URL 是否正确。' },
          { status: 400 }
        );
      }

      // 提取模型 ID 并排序
      const modelNames = modelsList
        .map((m: any) => m.id || m.name || m)
        .filter((name: any) => typeof name === 'string')
        .sort((a: string, b: string) => a.localeCompare(b));

      if (modelNames.length === 0) {
        return NextResponse.json({ error: '成功连接，但未获取到任何可用模型名称。' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        models: modelNames,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.error('Fetch Models Error:', fetchErr);
      
      let friendlyMessage = '网络请求失败';
      if (fetchErr.name === 'AbortError') {
        friendlyMessage = '连接大模型服务器超时（10秒限时），请检查 API Base URL 能否在本地网络正常访问。';
      } else if (fetchErr.code === 'ENOTFOUND' || fetchErr.message?.includes('getaddrinfo')) {
        friendlyMessage = '域名无法解析，请检查 API Base URL 拼写是否正确或是否有网。';
      } else {
        friendlyMessage = `连接失败: ${fetchErr.message || '未知网络错误'}`;
      }

      return NextResponse.json({ error: friendlyMessage }, { status: 400 });
    }
  } catch (error) {
    console.error('获取模型列表内部错误:', error);
    return NextResponse.json({ error: '服务器内部错误，模型列表拉取失败' }, { status: 500 });
  }
}

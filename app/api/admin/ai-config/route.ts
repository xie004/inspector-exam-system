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

export async function GET(req: NextRequest) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    let config = await db.aiConfig.findUnique({
      where: { id: 'default' },
    });

    // 如果不存在默认配置，则自动初始化一个
    if (!config) {
      config = await db.aiConfig.create({
        data: {
          id: 'default',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          modelName: 'gpt-4o',
        },
      });
    }

    // 工业级脱敏处理 API Key，保护隐私
    const maskKey = (key: string | null | undefined): string => {
      if (!key) return '';
      const len = key.length;
      if (len > 8) {
        return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
      }
      return '••••••••';
    };

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        // Text Model
        baseUrl: config.baseUrl,
        apiKey: maskKey(config.apiKey),
        hasKey: !!config.apiKey,
        modelName: config.modelName,
        // Vision Model
        visionBaseUrl: config.visionBaseUrl || '',
        visionApiKey: maskKey(config.visionApiKey),
        hasVisionKey: !!config.visionApiKey,
        visionModelName: config.visionModelName || '',
        // Embedding Model
        embeddingBaseUrl: config.embeddingBaseUrl || '',
        embeddingApiKey: maskKey(config.embeddingApiKey),
        hasEmbeddingKey: !!config.embeddingApiKey,
        embeddingModelName: config.embeddingModelName || '',
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('获取 AI 配置失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取配置失败' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const body = await req.json();
    const {
      baseUrl, apiKey, modelName,
      visionBaseUrl, visionApiKey, visionModelName,
      embeddingBaseUrl, embeddingApiKey, embeddingModelName
    } = body;

    if (!baseUrl || baseUrl.trim() === '') {
      return NextResponse.json({ error: '基础文本模型 API Base URL 不能为空' }, { status: 400 });
    }
    if (!modelName || modelName.trim() === '') {
      return NextResponse.json({ error: '基础文本模型名称不能为空' }, { status: 400 });
    }

    // 获取当前数据库中的配置
    const currentConfig = await db.aiConfig.findUnique({
      where: { id: 'default' },
    });

    const getFinalKey = (inputKey: string | null | undefined, currentKey: string | null | undefined): string => {
      if (!inputKey || inputKey.trim() === '') return '';
      if (inputKey.includes('••') || inputKey === '••••••••') {
        return currentKey || '';
      }
      return inputKey.trim();
    };

    const finalApiKey = getFinalKey(apiKey, currentConfig?.apiKey);
    const finalVisionApiKey = getFinalKey(visionApiKey, currentConfig?.visionApiKey);
    const finalEmbeddingApiKey = getFinalKey(embeddingApiKey, currentConfig?.embeddingApiKey);

    const updated = await db.aiConfig.upsert({
      where: { id: 'default' },
      update: {
        baseUrl: baseUrl.trim(),
        apiKey: finalApiKey,
        modelName: modelName.trim(),
        visionBaseUrl: visionBaseUrl ? visionBaseUrl.trim() : null,
        visionApiKey: finalVisionApiKey ? finalVisionApiKey : null,
        visionModelName: visionModelName ? visionModelName.trim() : null,
        embeddingBaseUrl: embeddingBaseUrl ? embeddingBaseUrl.trim() : null,
        embeddingApiKey: finalEmbeddingApiKey ? finalEmbeddingApiKey : null,
        embeddingModelName: embeddingModelName ? embeddingModelName.trim() : null,
      },
      create: {
        id: 'default',
        baseUrl: baseUrl.trim(),
        apiKey: finalApiKey,
        modelName: modelName.trim(),
        visionBaseUrl: visionBaseUrl ? visionBaseUrl.trim() : null,
        visionApiKey: finalVisionApiKey ? finalVisionApiKey : null,
        visionModelName: visionModelName ? visionModelName.trim() : null,
        embeddingBaseUrl: embeddingBaseUrl ? embeddingBaseUrl.trim() : null,
        embeddingApiKey: finalEmbeddingApiKey ? finalEmbeddingApiKey : null,
        embeddingModelName: embeddingModelName ? embeddingModelName.trim() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'AI 配置更新成功',
      config: {
        id: updated.id,
        baseUrl: updated.baseUrl,
        modelName: updated.modelName,
        hasKey: !!updated.apiKey,
      },
    });
  } catch (error) {
    console.error('更新 AI 配置失败:', error);
    return NextResponse.json({ error: '服务器内部错误，更新配置失败' }, { status: 500 });
  }
}

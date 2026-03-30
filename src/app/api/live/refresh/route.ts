/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { refreshLiveChannels } from '@/lib/live';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    const username = authInfo?.username;
    const config = await getConfig();
    if (!config) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    }

    if (username !== process.env.USERNAME) {
      const userInfo = await db.getUserInfoV2(username || '');
      if (!userInfo || userInfo.role !== 'admin' || userInfo.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const sourceKey = body?.sourceKey as string | undefined;

    if (!sourceKey) {
      return NextResponse.json({ error: '缺少直播源参数' }, { status: 400 });
    }

    const liveSource = (config?.LiveConfig || []).find(source => source.key === sourceKey);
    if (!liveSource) {
      return NextResponse.json({ error: '直播源不存在' }, { status: 404 });
    }

    const channelNumber = await refreshLiveChannels(liveSource);
    liveSource.channelNumber = channelNumber;
    await db.saveAdminConfig(config);

    return NextResponse.json({
      success: true,
      channelNumber,
      message: '直播订阅刷新成功',
    });
  } catch (error) {
    console.error('刷新直播订阅失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '刷新失败' },
      { status: 500 }
    );
  }
}

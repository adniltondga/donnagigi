import { type NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Criar token de teste
    const integration = await prisma.mLIntegration.create({
      data: {
        sellerID: '267571726',
        accessToken: 'TEST_TOKEN_MOCK', // Token fake para mock
        refreshToken: 'TEST_REFRESH',
        expiresAt: new Date(Date.now() + 86400000) // 24h
      }
    });

    return NextResponse.json({
      message: 'Token criado para testes',
      integration
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

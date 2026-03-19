import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DEBUG: Teste 0 - Verificar Token no Banco
 * GET /api/ml/debug/token-info
 * 
 * Retorna informações do token armazenado (sem fazer fetch externo)
 */
export async function GET() {
  try {
    const integration = await prisma.mLIntegration.findFirst();
    
    if (!integration) {
      return NextResponse.json({ 
        error: 'Sem token no banco',
        status: 'NOT_FOUND'
      }, { status: 401 });
    }

    const now = new Date();
    const isExpired = integration.expiresAt < now;

    return NextResponse.json({
      success: true,
      token: {
        accessToken: integration.accessToken.substring(0, 40) + '...',
        sellerID: integration.sellerID,
        expiresAt: integration.expiresAt,
        isExpired: isExpired,
        hoursLeft: Math.round((integration.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

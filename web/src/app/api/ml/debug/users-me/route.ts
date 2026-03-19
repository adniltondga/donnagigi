import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import https from 'https';

export const dynamic = 'force-dynamic';

function httpsGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    }).on('error', reject);
  });
}

/**
 * DEBUG: Teste 1 - Validar Token
 * GET /api/ml/debug/users-me
 * 
 * Conforme doc:
 * GET https://api.mercadolivre.com/users/me?access_token=TOKEN
 */
export async function GET() {
  try {
    const integration = await prisma.mLIntegration.findFirst();
    
    if (!integration) {
      return NextResponse.json({ error: 'Sem token no banco' }, { status: 401 });
    }

    const url = `https://api.mercadolivre.com/users/me?access_token=${integration.accessToken}`;
    
    console.log('[DEBUG] Chamando:', url.substring(0, 80) + '...');
    
    const response = await httpsGet(url);

    return NextResponse.json({
      status: response.status,
      data: response.body
    });

  } catch (error: any) {
    console.error('[ERROR]', error);
    return NextResponse.json(
      { 
        error: error.message,
      },
      { status: 500 }
    );
  }
}

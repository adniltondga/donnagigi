import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DEBUG MOCK: Teste 1 - Validar Token (com dados simulados)
 * GET /api/ml/debug/users-me-mock
 * 
 * Simula resposta de:
 * GET https://api.mercadolivre.com/users/me?access_token=TOKEN
 * 
 * Resposta esperada:
 * {
 *   "id": 267571726,
 *   "nickname": "DONNAGIGI",
 *   "registration_status": "confirmed",
 *   "account_type": "business"
 * }
 */
export async function GET() {
  try {
    const integration = await prisma.mLIntegration.findFirst();
    
    if (!integration) {
      return NextResponse.json({ error: 'Sem token no banco' }, { status: 401 });
    }

    // ✅ MOCK: Simular resposta de /users/me
    const mockUserData = {
      id: integration.sellerID,
      nickname: 'DONNAGIGI',
      registration_status: 'confirmed',
      account_type: 'business',
      first_name: 'Donna',
      last_name: 'Gigi',
      country_id: 'BR',
      state: 'SP',
      city: 'São Paulo'
    };

    return NextResponse.json({
      success: true,
      endpoint: '/users/me',
      status: 200,
      data: mockUserData,
      format: {
        id: 'Seller ID',
        nickname: 'Seller nickname',
        registration_status: 'Account status',
        account_type: 'business ou individual'
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

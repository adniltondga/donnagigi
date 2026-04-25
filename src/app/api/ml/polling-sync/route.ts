/**
 * Polling Automático - Sincroniza todos os produtos periodicamente
 * 
 * Este endpoint pode ser chamado por:
 * - EasyCron (easycron.com)
 * - GitHub Actions
 * - CloudFront Lambda
 * - Ou qualquer cron job externo
 * 
 * Exemplos:
 * - https://easycron.com/docs
 * - POST https://seu-dominio.com/api/ml/polling-sync?token=SECRET_TOKEN
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncAllMLProducts } from '@/lib/auto-sync-ml'
import { forEachMLTenant } from '@/lib/ml'

export const dynamic = 'force-dynamic'

// Token secreto para validar requisições
const POLLING_SECRET = process.env.ML_POLLING_SECRET || 'change-me-in-env'

export async function POST(request: NextRequest) {
  try {
    // Validar token
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token !== POLLING_SECRET) {
      console.warn('[POLLING] Tentativa com token inválido')
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    console.log('[POLLING] iniciando sincronização automática multi-tenant...')

    // Sincronizar produtos de todos os tenants com integração ML
    const perTenantResults: Array<{ tenantId: string; result: unknown }> = []
    const summary = await forEachMLTenant(async (integration, tenantId) => {
      const result = await syncAllMLProducts(
        integration.accessToken,
        integration.sellerID,
        tenantId,
      )
      perTenantResults.push({ tenantId, result })
    })

    console.log('[POLLING] Resultado da sincronização:', summary)

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      sync_result: summary,
      per_tenant: perTenantResults,
      next_run: 'Configure seu cron job para próxima execução',
      instructions: {
        recommended_interval: '15 minutos',
        example_crons: [
          {
            service: 'EasyCron',
            url: `https://seu-dominio.com/api/ml/polling-sync?token=${POLLING_SECRET}`,
            frequency: 'Every 15 minutes',
          },
          {
            service: 'GitHub Actions',
            file: '.github/workflows/ml-sync.yml',
            frequency: '*/15 * * * *',
          },
        ],
      },
    })
  } catch (error) {
    console.error('[POLLING] Erro na sincronização:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ml/polling-sync
 * Teste manual da sincronização
 * Útil para debug
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (token !== POLLING_SECRET) {
      return NextResponse.json(
        {
          error: 'Token inválido',
          hint: 'Use ?token=SEU_TOKEN_SECRETO',
          example: `/api/ml/polling-sync?token=${POLLING_SECRET}`,
        },
        { status: 401 }
      )
    }

    // Executar sincronização (redirecionar para POST)
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ml/polling-sync?token=${token}`,
      { method: 'POST' }
    )

    return response
  } catch (error) {
    console.error('[POLLING-GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao testar polling' },
      { status: 500 }
    )
  }
}

/**
 * 📋 INSTRUÇÕES DE SETUP
 * 
 * 1️⃣ Definir variável de ambiente:
 *    ML_POLLING_SECRET=seu-token-super-secreto
 * 
 * 2️⃣ Usar EasyCron.com:
 *    - Ir para https://www.easycron.com
 *    - "Add Cron Job"
 *    - URL: https://seu-dominio.com/api/ml/polling-sync?token=seu-token-super-secreto
 *    - Frequência: Every 15 minutes
 * 
 * 3️⃣ Ou usar GitHub Actions:
 *    - Criar .github/workflows/ml-sync.yml
 *    - Ver exemplo em docs/ML_AUTO_SYNC.md
 */

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * PARTE 4G: Dashboard HTML de login
 * GET /api/ml/dashboard
 * 
 * Página interativa com botão de login e instruções
 */

export async function GET(_request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  // Buscar status
  let autenticado = false
  let sellerID = null

  try {
    const statusRes = await fetch(`${baseUrl}/api/ml/status`)
    const status = await statusRes.json()
    autenticado = status.autenticado
    sellerID = status.seller_id
  } catch (e) {
    console.error("Erro ao buscar status:", e)
  }

  // Buscar link de login
  let loginUrl = ""
  try {
    const loginRes = await fetch(`${baseUrl}/api/ml/oauth/login`)
    const loginData = await loginRes.json()
    loginUrl = loginData.links?.fazer_login || ""
  } catch (e) {
    console.error("Erro ao buscar login URL:", e)
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sincronizar com Mercado Livre</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 600px;
          width: 100%;
          padding: 40px;
        }
        
        h1 {
          color: #333;
          margin-bottom: 10px;
          font-size: 28px;
        }
        
        .subtitle {
          color: #666;
          margin-bottom: 30px;
          font-size: 14px;
        }
        
        .status-card {
          background: #f5f5f5;
          border-left: 4px solid ${autenticado ? '#10b981' : '#f59e0b'};
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 10px;
          background: ${autenticado ? '#d1fae5' : '#fef3c7'};
          color: ${autenticado ? '#065f46' : '#92400e'};
        }
        
        .status-text {
          color: #333;
          font-size: 14px;
          line-height: 1.6;
        }
        
        .seller-info {
          background: #f0f9ff;
          padding: 12px;
          border-radius: 6px;
          margin-top: 10px;
          font-size: 13px;
          color: #0369a1;
        }
        
        .button-group {
          display: flex;
          gap: 12px;
          margin-bottom: 30px;
        }
        
        .btn {
          flex: 1;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          text-align: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .btn-primary {
          background: #667eea;
          color: white;
        }
        
        .btn-primary:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .btn-secondary {
          background: #e5e7eb;
          color: #333;
        }
        
        .btn-secondary:hover {
          background: #d1d5db;
        }
        
        .steps {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .steps h3 {
          color: #333;
          font-size: 14px;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .step {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 13px;
          color: #555;
          line-height: 1.5;
        }
        
        .step-number {
          min-width: 24px;
          height: 24px;
          background: #667eea;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          flex-shrink: 0;
        }
        
        .endpoints {
          background: #f3f4f6;
          padding: 12px;
          border-radius: 6px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.6;
          overflow-x: auto;
          margin-bottom: 15px;
        }
        
        code {
          background: #e5e7eb;
          padding: 2px 6px;
          border-radius: 3px;
          color: #1f2937;
        }
        
        .tip {
          background: #ecfdf5;
          border-left: 3px solid #10b981;
          padding: 12px;
          border-radius: 6px;
          font-size: 12px;
          color: #065f46;
          margin-bottom: 10px;
        }
        
        .link-button {
          display: inline-block;
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
          margin-right: 15px;
        }
        
        .link-button:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Mercado Livre Sync</h1>
        <p class="subtitle">Sincronize seus produtos com seu catálogo</p>
        
        <div class="status-card">
          <span class="status-badge">${autenticado ? '✅ AUTENTICADO' : '⏳ NÃO AUTENTICADO'}</span>
          <div class="status-text">
            ${autenticado 
              ? `Você está conectado ao Mercado Livre! Seu ID: <strong>${sellerID}</strong>`
              : 'Você não está autenticado. Faça login para sincronizar seus produtos.'
            }
          </div>
          ${autenticado ? '<div class="seller-info">Token expira em 6 horas. Faça login novamente se expirar.</div>' : ''}
        </div>
        
        <div class="button-group">
          ${!autenticado ? `
            <a href="${loginUrl}" class="btn btn-primary">
              🔐 FAZER LOGIN NO ML
            </a>
          ` : ''}
          <a href="/api/ml/status" class="btn btn-secondary">
            📊 Ver Status
          </a>
          <a href="/api/ml/lista-reais" class="btn btn-secondary">
            📦 Listar Produtos
          </a>
        </div>
        
        <div class="steps">
          <h3>📋 Próximos passos</h3>
          ${autenticado ? `
            <div class="step">
              <span class="step-number">1</span>
              <div>
                <strong>Listar seus produtos</strong><br>
                Clique em "Listar Produtos" acima ou acesse<br>
                <code>GET /api/ml/lista-reais</code>
              </div>
            </div>
            <div class="step">
              <span class="step-number">2</span>
              <div>
                <strong>Importar no seu sistema</strong><br>
                Use o array de resposta em<br>
                <code>POST /api/ml/import-batch</code>
              </div>
            </div>
            <div class="step">
              <span class="step-number">3</span>
              <div>
                <strong>Pronto!</strong><br>
                Seus produtos estão sincronizados em<br>
                <code>GET /api/products</code>
              </div>
            </div>
          ` : `
            <div class="step">
              <span class="step-number">1</span>
              <div>
                <strong>Clique em "Fazer Login"</strong><br>
                Você será redirecionado ao Mercado Livre
              </div>
            </div>
            <div class="step">
              <span class="step-number">2</span>
              <div>
                <strong>Autorize o acesso</strong><br>
                Permita que o sistema acesse seus produtos
              </div>
            </div>
            <div class="step">
              <span class="step-number">3</span>
              <div>
                <strong>Será redirecionado</strong><br>
                Seu token será salvo automaticamente
              </div>
            </div>
          `}
        </div>
        
        <div class="tip">
          💡 <strong>Dica:</strong> ${autenticado 
            ? 'Você pode agora listar e importar seus produtos do Mercado Livre!'
            : 'Use o mesmo navegador durante o login para manter a sessão.'}
        </div>
        
        <div style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
          <a href="/api/ml/guia" class="link-button">📚 Guia Completo</a>
          <a href="/api/ml/status" class="link-button">🔍 Ver Status JSON</a>
        </div>
      </div>
    </body>
    </html>
  `

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  })
}

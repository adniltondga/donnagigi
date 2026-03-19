import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * ENDPOINT: Mapear atributos de variações
 * GET /api/ml/map-attributes?processo=test ou batch
 * 
 * Fluxo:
 * 1. Buscar todas as ProductVariant sem colorId/modelId
 * 2. Extrair atributo do cod (ex: COL-PR = Color-Preto)
 * 3. Criar ou buscar DeviceColor/DeviceModel
 * 4. Linkar ProductVariant → DeviceColor/DeviceModel
 * 5. Retornar resumo
 */

interface AttributoExtraido {
  type: 'color' | 'model' | 'size' | 'other';
  value: string;
}

/**
 * Extrair atributo do código
 * Exemplo: "MLB-COL-PR" → { type: 'color', value: 'Preto' }
 */
function extrairAtributo(cod: string): AttributoExtraido {
  const parts = cod.split('-');
  
  if (parts.length >= 2) {
    const attrType = parts[1].toUpperCase();
    const attrValue = parts.slice(2).join('-');

    // Mapear abreviações para tipos
    if (attrType === 'COL') {
      return { type: 'color', value: decodificarCor(attrValue) };
    } else if (attrType === 'MOD') {
      return { type: 'model', value: decodificarModelo(attrValue) };
    } else if (attrType === 'TAM') {
      return { type: 'size', value: decodificarTamanho(attrValue) };
    }
  }

  return { type: 'other', value: cod };
}

/**
 * Decodificar abreviação de cor
 * PR → Preto, BR → Branco, AZ → Azul, etc
 */
function decodificarCor(abrev: string): string {
  const cores: { [key: string]: string } = {
    PR: 'Preto',
    BR: 'Branco',
    AZ: 'Azul',
    VR: 'Verde',
    VM: 'Vermelho',
    AM: 'Amarelo',
    RO: 'Rosa',
    OR: 'Ouro',
    PR: 'Prata',
    CI: 'Cinza'
  };
  return cores[abrev] || abrev;
}

function decodificarModelo(abrev: string): string {
  const modelos: { [key: string]: string } = {
    IP: 'iPhone',
    SA: 'Samsung',
    MI: 'Xiaomi'
  };
  return modelos[abrev] || abrev;
}

function decodificarTamanho(abrev: string): string {
  const tamanhos: { [key: string]: string } = {
    P: 'Pequeno',
    M: 'Médio',
    G: 'Grande',
    XG: 'Extra Grande'
  };
  return tamanhos[abrev] || abrev;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const processo = searchParams.get('processo') || 'test';

    console.log(`\n🎨 Mapeando atributos (${processo})\n`);

    // Buscar variantes sem cor/modelo mapeado
    const variantes = await prisma.productVariant.findMany({
      where: {
        OR: [
          { colorId: null },
          { modelId: null }
        ]
      },
      include: {
        product: true,
        color: true,
        model: true
      },
      take: processo === 'test' ? 5 : 1000
    });

    console.log(`📦 Variantes para processar: ${variantes.length}`);

    const resultados = {
      total: variantes.length,
      mapeadas: 0,
      erros: 0,
      detalhes: [] as any[]
    };

    // Processar cada variante
    for (const variante of variantes) {
      try {
        // Extrair atributo do cod
        const atributo = extrairAtributo(variante.cod);

        let colorId = variante.colorId;
        let modelId = variante.modelId;

        // Se for cor
        if (atributo.type === 'color' && !colorId) {
          let cor = await prisma.deviceColor.findUnique({
            where: { name: atributo.value }
          });

          if (!cor) {
            cor = await prisma.deviceColor.create({
              data: {
                name: atributo.value,
                hexColor: '#000000' // Padrão
              }
            });
            console.log(`   ✨ Criada cor: ${atributo.value}`);
          }

          colorId = cor.id;
        }

        // Se for modelo
        if (atributo.type === 'model' && !modelId) {
          let modelo = await prisma.deviceModel.findUnique({
            where: { name: atributo.value }
          });

          if (!modelo) {
            modelo = await prisma.deviceModel.create({
              data: {
                name: atributo.value,
                description: ''
              }
            });
            console.log(`   ✨ Criado modelo: ${atributo.value}`);
          }

          modelId = modelo.id;
        }

        // Atualizar variante com IDs
        if (colorId !== variante.colorId || modelId !== variante.modelId) {
          await prisma.productVariant.update({
            where: { id: variante.id },
            data: {
              colorId: colorId,
              modelId: modelId,
              updatedAt: new Date()
            }
          });

          resultados.mapeadas++;
          resultados.detalhes.push({
            cod: variante.cod,
            atributo: `${atributo.type}/${atributo.value}`,
            statusCor: colorId ? '✅' : '❌',
            statusModelo: modelId ? '✅' : '❌'
          });
        }
      } catch (erro: any) {
        resultados.erros++;
        resultados.detalhes.push({
          cod: variante.cod,
          erro: erro.message
        });
      }
    }

    console.log(`\n✅ Mapeamento completo\n`);

    return NextResponse.json({
      sucesso: true,
      processo: processo,
      resumo: {
        total: resultados.total,
        mapeadas: resultados.mapeadas,
        erros: resultados.erros,
        taxa: resultados.total > 0 
          ? `${((resultados.mapeadas / resultados.total) * 100).toFixed(1)}%`
          : '0%'
      },
      primeiros_5: resultados.detalhes.slice(0, 5),
      proximos_passos: [
        processo === 'test' 
          ? 'Rodar com ?processo=batch para fazer em massa'
          : 'Verificar resultados no banco',
        'Próximo: Adicionar imagens por cor'
      ]
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateVariantCost } from '@/lib/costCalculation';

// POST - Registrar venda
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { variantId, quantity, salePrice, marketplace, saleDate } = body;

    // Validação
    if (!variantId || !quantity || !salePrice || !marketplace) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios: variantId, quantity, salePrice, marketplace' },
        { status: 400 }
      );
    }

    if (quantity <= 0 || salePrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'Quantidade e preço devem ser maiores que 0' },
        { status: 400 }
      );
    }

    if (!['ml', 'shopee'].includes(marketplace)) {
      return NextResponse.json(
        { success: false, error: 'Marketplace deve ser "ml" ou "shopee"' },
        { status: 400 }
      );
    }

    // Buscar variação e produto
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant) {
      return NextResponse.json(
        { success: false, error: 'Variação não encontrada' },
        { status: 404 }
      );
    }

    // Calcular custos
    const unitCost = calculateVariantCost(variant, variant.product, marketplace);
    const totalCost = unitCost * quantity;
    const totalRevenue = salePrice * quantity;
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    // Criar venda
    const sale = await prisma.sale.create({
      data: {
        variantId,
        quantity,
        salePrice,
        marketplace,
        totalCost,
        totalRevenue,
        profit,
        profitMargin,
        saleDate: saleDate ? new Date(saleDate) : new Date(),
      },
    });

    return NextResponse.json({ success: true, data: sale }, { status: 201 });
  } catch (error) {
    console.error('POST /api/sales error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao registrar venda' },
      { status: 500 }
    );
  }
}

// GET - Listar vendas com filtros
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const marketplace = searchParams.get('marketplace');
    const variantId = searchParams.get('variantId');

    // Validar paginação
    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {};

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) {
        where.saleDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.saleDate.lte = new Date(endDate);
      }
    }

    if (marketplace && marketplace !== 'all') {
      where.marketplace = marketplace;
    }

    if (variantId) {
      where.variantId = variantId;
    }

    // Buscar vendas
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          variant: {
            include: { product: true, model: true, color: true },
          },
        },
        orderBy: { saleDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    // Calcular resumo
    const summary = await prisma.sale.aggregate({
      where,
      _sum: {
        totalRevenue: true,
        totalCost: true,
        profit: true,
        quantity: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: sales,
      summary: {
        totalRevenue: summary._sum.totalRevenue || 0,
        totalCost: summary._sum.totalCost || 0,
        totalProfit: summary._sum.profit || 0,
        totalQuantity: summary._sum.quantity || 0,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/sales error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao listar vendas' },
      { status: 500 }
    );
  }
}

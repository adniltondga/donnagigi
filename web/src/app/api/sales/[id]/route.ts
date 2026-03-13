import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateVariantCost } from '@/lib/costCalculation';

// PUT - Editar venda
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { quantity, salePrice, marketplace, saleDate } = body;

    // Buscar venda
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { variant: { include: { product: true } } },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, error: 'Venda não encontrada' },
        { status: 404 }
      );
    }

    // Validar campos
    if (quantity && quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'Quantidade deve ser maior que 0' },
        { status: 400 }
      );
    }

    if (salePrice && salePrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'Preço deve ser maior que 0' },
        { status: 400 }
      );
    }

    if (marketplace && !['ml', 'shopee'].includes(marketplace)) {
      return NextResponse.json(
        { success: false, error: 'Marketplace deve ser "ml" ou "shopee"' },
        { status: 400 }
      );
    }

    // Usar valores atuais se não fornecidos
    const newQuantity = quantity ?? sale.quantity;
    const newSalePrice = salePrice ?? sale.salePrice;
    const newMarketplace = marketplace ?? sale.marketplace;

    // Recalcular custos
    const unitCost = calculateVariantCost(
      sale.variant,
      sale.variant.product,
      newMarketplace as 'ml' | 'shopee'
    );
    const totalCost = unitCost * newQuantity;
    const totalRevenue = newSalePrice * newQuantity;
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    // Atualizar venda
    const updatedSale = await prisma.sale.update({
      where: { id },
      data: {
        quantity: newQuantity,
        salePrice: newSalePrice,
        marketplace: newMarketplace,
        saleDate: saleDate ? new Date(saleDate) : sale.saleDate,
        totalCost,
        totalRevenue,
        profit,
        profitMargin,
      },
      include: {
        variant: {
          include: { product: true, model: true, color: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: updatedSale });
  } catch (error) {
    console.error('PUT /api/sales/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar venda' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar venda
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Verificar se venda existe
    const sale = await prisma.sale.findUnique({
      where: { id },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, error: 'Venda não encontrada' },
        { status: 404 }
      );
    }

    // Deletar venda
    await prisma.sale.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Venda deletada com sucesso' });
  } catch (error) {
    console.error('DELETE /api/sales/[id] error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar venda' },
      { status: 500 }
    );
  }
}

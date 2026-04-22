import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: params.id },
      include: { supplier: true },
    });

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(bill);
  } catch (error) {
    console.error('Error fetching bill:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bill' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { description, amount, dueDate, category, supplierId, notes, productCost, productId, status, type } = body;

    // Se productId foi fornecido, buscar os custos do produto
    let finalProductCost = productCost;
    if (productId && !productCost) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { productCost: true },
      });
      if (product) {
        if (!productCost && product.productCost) {
          finalProductCost = product.productCost;
        }
      }
    }

    const updateData = {
      ...(description && { description }),
      ...(amount && { amount: parseFloat(amount) }),
      ...(dueDate && { dueDate: new Date(dueDate) }),
      ...(category && { category }),
      ...(status && { status }),
      ...(type && { type }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(productId !== undefined && { productId: productId || null }),
      ...(productCost !== undefined && { productCost: finalProductCost !== null && finalProductCost !== undefined ? parseFloat(finalProductCost.toString()) : null }),
    };

    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: updateData,
      include: { supplier: true, product: true },
    });

    // Se a bill é uma venda ML e o usuário informou productCost,
    // salva em MLProductCost e propaga para outras vendas do mesmo
    // anúncio que ainda estão sem custo.
    let propagadas = 0;
    let mlListingId: string | null = null;

    if (
      bill.category === 'venda' &&
      bill.type === 'receivable' &&
      finalProductCost !== null &&
      finalProductCost !== undefined
    ) {
      // Casa description (formato novo ou antigo) e também notes
      const re = /MLB\d{6,}/i;
      const listingId =
        bill.description.match(re)?.[0]?.toUpperCase() ||
        bill.notes?.match(re)?.[0]?.toUpperCase() ||
        null;

      if (listingId) {
        mlListingId = listingId;
        const tMatchNew = /Venda ML - (.+?)\s*\[Produto ML:/.exec(bill.description);
        const tMatchOld = /Venda ML - (.+)$/.exec(bill.description);
        const title = (tMatchNew?.[1] || tMatchOld?.[1] || '').trim() || null;
        const costNum = Number(finalProductCost);

        const { getDefaultTenantId } = await import('@/lib/tenant');
        const tenantIdForCost = await getDefaultTenantId();
        await prisma.mLProductCost.upsert({
          where: { mlListingId: listingId },
          create: { mlListingId: listingId, productCost: costNum, title, tenantId: tenantIdForCost },
          update: { productCost: costNum, ...(title ? { title } : {}) },
        });

        const res = await prisma.bill.updateMany({
          where: {
            id: { not: bill.id },
            type: 'receivable',
            category: 'venda',
            productCost: null,
            OR: [
              { description: { contains: listingId } },
              { notes: { contains: listingId } },
            ],
          },
          data: { productCost: costNum },
        });
        propagadas = res.count;
      }
    }

    return NextResponse.json({ ...bill, mlListingId, propagadas });
  } catch (error) {
    console.error('Error updating bill:', error);
    return NextResponse.json(
      { error: 'Failed to update bill' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bill = await prisma.bill.delete({
      where: { id: params.id },
    });

    return NextResponse.json(bill);
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json(
      { error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}

import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { AuthError, authErrorResponse, requireRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await getTenantIdOrDefault();
    const bill = await prisma.bill.findFirst({
      where: { id: params.id, tenantId },
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
    await requireRole(['OWNER', 'ADMIN']);
    const body = await req.json();
    const { description, amount, dueDate, category, supplierId, notes, productCost, productId, status, type } = body;

    const tenantId = await getTenantIdOrDefault();

    // Verifica ownership: só atualiza se a bill pertencer ao tenant logado
    const existing = await prisma.bill.findFirst({
      where: { id: params.id, tenantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Se productId foi fornecido, buscar os custos do produto
    let finalProductCost = productCost;
    if (productId && !productCost) {
      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
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

        await prisma.mLProductCost.upsert({
          where: { mlListingId: listingId },
          create: { mlListingId: listingId, productCost: costNum, title, tenantId },
          update: { productCost: costNum, ...(title ? { title } : {}) },
        });

        const res = await prisma.bill.updateMany({
          where: {
            id: { not: bill.id },
            tenantId,
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
    if (error instanceof AuthError) return authErrorResponse(error);
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
    await requireRole(['OWNER', 'ADMIN']);
    const tenantId = await getTenantIdOrDefault();
    const res = await prisma.bill.deleteMany({
      where: { id: params.id, tenantId },
    });

    if (res.count === 0) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: res.count });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error deleting bill:', error);
    return NextResponse.json(
      { error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}

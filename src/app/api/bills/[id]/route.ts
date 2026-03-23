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
    const { description, amount, dueDate, category, supplierId, notes, productCost, deliveryCost, productId } = body;

    // Se productId foi fornecido, buscar os custos do produto
    let finalProductCost = productCost;
    let finalDeliveryCost = deliveryCost;
    if (productId && (!productCost || !deliveryCost)) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { productCost: true, deliveryCost: true },
      });
      if (product) {
        if (!productCost && product.productCost) {
          finalProductCost = product.productCost;
        }
        if (!deliveryCost && product.deliveryCost) {
          finalDeliveryCost = product.deliveryCost;
        }
      }
    }

    const updateData = {
      ...(description && { description }),
      ...(amount && { amount: parseFloat(amount) }),
      ...(dueDate && { dueDate: new Date(dueDate) }),
      ...(category && { category }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(productId !== undefined && { productId: productId || null }),
      ...(productCost !== undefined && { productCost: finalProductCost !== null && finalProductCost !== undefined ? parseFloat(finalProductCost.toString()) : null }),
      ...(deliveryCost !== undefined && { deliveryCost: finalDeliveryCost !== null && finalDeliveryCost !== undefined ? parseFloat(finalDeliveryCost.toString()) : null }),
    };

    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: updateData,
      include: { supplier: true, product: true },
    });

    return NextResponse.json(bill);
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

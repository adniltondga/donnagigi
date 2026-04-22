import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.bill.findUnique({
      where: { id: params.id },
      select: { paidDate: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Só preenche paidDate se estiver vazio — bills de venda ML já nascem com
    // paidDate = data_closed do pedido, e não devem ser sobrescritas.
    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: {
        status: 'paid',
        ...(existing.paidDate ? {} : { paidDate: new Date() }),
      },
      include: { supplier: true },
    });

    return NextResponse.json(bill);
  } catch (error) {
    console.error('Error marking bill as paid:', error);
    return NextResponse.json(
      { error: 'Failed to mark bill as paid' },
      { status: 500 }
    );
  }
}

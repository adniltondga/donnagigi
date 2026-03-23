import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: {
        status: 'paid',
        paidDate: new Date(),
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

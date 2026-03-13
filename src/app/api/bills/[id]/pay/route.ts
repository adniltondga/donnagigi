import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if bill exists
    const bill = await prisma.bill.findUnique({
      where: { id: params.id },
    });

    if (!bill) {
      return NextResponse.json(
        { success: false, error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Guard: cannot mark as paid if already paid or cancelled
    if (bill.status === 'paid' || bill.status === 'cancelled') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot mark bill as paid when status is ${bill.status}`,
        },
        { status: 400 }
      );
    }

    const updatedBill = await prisma.bill.update({
      where: { id: params.id },
      data: {
        paidDate: new Date(),
        status: 'paid',
      },
      include: { supplier: true },
    });

    return NextResponse.json({ success: true, data: updatedBill });
  } catch (error) {
    console.error('Error marking bill as paid:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark bill as paid' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: params.id },
      include: { supplier: true },
    });

    if (!bill) {
      return NextResponse.json(
        { success: false, error: 'Bill not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: bill });
  } catch (error) {
    console.error('Error fetching bill:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bill' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if bill exists
    const existing = await prisma.bill.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Bill not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      type,
      description,
      amount,
      dueDate,
      paidDate,
      status,
      category,
      supplierId,
      notes,
    } = body;

    // If status is explicitly set to "cancelled", don't recalculate
    let newStatus = status;
    if (!status || status !== 'cancelled') {
      // Auto-recalculate status if not explicitly cancelled
      const dueDateObj = dueDate ? new Date(dueDate) : existing.dueDate;
      const now = new Date();

      if (paidDate) {
        newStatus = 'paid';
      } else if (dueDateObj < now) {
        newStatus = 'overdue';
      } else {
        newStatus = 'pending';
      }
    }

    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: {
        type: type !== undefined ? type : undefined,
        description: description !== undefined ? description : undefined,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        dueDate: dueDate !== undefined ? new Date(dueDate) : undefined,
        paidDate: paidDate !== undefined ? (paidDate ? new Date(paidDate) : null) : undefined,
        status: newStatus,
        category: category !== undefined ? category : undefined,
        supplierId: supplierId !== undefined ? supplierId : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
      include: { supplier: true },
    });

    return NextResponse.json({ success: true, data: bill });
  } catch (error) {
    console.error('Error updating bill:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bill' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await prisma.bill.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}

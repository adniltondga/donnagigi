import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
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
    const { description, amount, dueDate, category, supplierId, notes } = body;

    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: {
        ...(description && { description }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(category && { category }),
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: { supplier: true },
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
  req: NextRequest,
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

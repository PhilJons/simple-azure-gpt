import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Using the singleton instance

// GET /api/chats - Load all chats
export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      orderBy: {
        updatedAt: 'desc', // Or createdAt, depending on desired order
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });
    return NextResponse.json(chats);
  } catch (error) {
    console.error('Failed to fetch chats:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

// POST /api/chats - Create a new chat
export async function POST(request: Request) {
  try {
    const { title, titleGenerated = false } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required for a new chat' }, { status: 400 });
    }
    
    const newChat = await prisma.chat.create({
      data: {
        title: title,
        titleGenerated: titleGenerated,
        // messages will be empty initially, added via a different endpoint or update
      },
    });
    return NextResponse.json(newChat, { status: 201 });
  } catch (error) {
    console.error('Failed to create chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
} 
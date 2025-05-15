import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma, Chat, ChatMessage } from '@/lib/generated/prisma'; // Corrected import path for Prisma types

// Define a more specific type for the new message part of the request body
interface NewMessageInput {
  role: string; // Should be 'user', 'assistant', or 'system'
  content: string;
  timestamp: number; // Client will send number, convert to Date on server
}

// Define a type for the messages array if sent for full replacement
// This should match the structure client sends, which might be based on ChatContext's ChatMessage
interface ClientChatMessage {
  id?: string; // id might not be present for new messages if client generates them before DB
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  // chat specific fields like chatId will be set by server
}

interface ChatPutRequestBody {
  title?: string;
  messages?: ClientChatMessage[]; // For replacing all messages
  newMessage?: NewMessageInput;    // For adding a single new message
  titleGenerated?: boolean;
}

// GET /api/chats/[chatId] - Load a specific chat
export async function GET(request: NextRequest, context: { params: Promise<{ chatId: string }> }) {
  try {
    const params = await context.params; // Await the params Promise
    const chatId = params.chatId;
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    const chatForClient = {
      ...chat,
      messages: chat.messages.map((msg: ChatMessage) => ({
        ...msg,
        timestamp: msg.timestamp.getTime(),
      })),
    };
    return NextResponse.json(chatForClient);
  } catch (error) {
    // If awaiting params fails, or chatId is not found, log generic error
    console.error(`Failed to process GET request for chat:`, error);
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}

// PUT /api/chats/[chatId] - Update a chat (e.g., title, messages, titleGenerated)
export async function PUT(request: NextRequest, context: { params: Promise<{ chatId: string }> }) {
  // Log attempt before awaiting params, in case awaiting params itself is an issue.
  console.log(`[/api/chats/[chatId]] PUT request received, awaiting params...`);
  try {
    const params = await context.params; // Await the params Promise
    const chatId = params.chatId;
    console.log(`[/api/chats/[chatId]] PUT request for chatId: ${chatId}`);
    const body = await request.json() as ChatPutRequestBody;
    console.log(`[/api/chats/[chatId]] Request body for chat ${chatId}:`, body);
    const { title, messages: newMessagesArray, newMessage, titleGenerated } = body;

    const updateDataForChatModel: Prisma.ChatUpdateInput = {};
    if (title !== undefined) {
      console.log(`[/api/chats/[chatId]] Updating title for ${chatId} to: "${title}", titleGenerated: ${titleGenerated}`);
      updateDataForChatModel.title = title;
    }
    if (titleGenerated !== undefined) {
      updateDataForChatModel.titleGenerated = titleGenerated;
    }
    if (newMessage || newMessagesArray) {
      console.log(`[/api/chats/[chatId]] Updating messages for ${chatId}. New single message: ${!!newMessage}, New messages array: ${!!newMessagesArray}`);
      updateDataForChatModel.updatedAt = new Date();
    }

    let chatModifiedDueToMessages = false;

    if (newMessage) {
      await prisma.chatMessage.create({
        data: {
          chat: { connect: { id: chatId } }, 
          role: newMessage.role,
          content: newMessage.content,
          timestamp: new Date(newMessage.timestamp),
        },
      });
      chatModifiedDueToMessages = true;
    } else if (newMessagesArray) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.chatMessage.deleteMany({ where: { chatId: chatId } }); 
        await tx.chatMessage.createMany({
          data: newMessagesArray.map((msg: ClientChatMessage) => ({
            chatId: chatId, 
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
          })),
        });
      });
      chatModifiedDueToMessages = true;
    }
    
    let chatDetailsUpdated = false;
    if (updateDataForChatModel.title !== undefined || updateDataForChatModel.titleGenerated !== undefined) {
        chatDetailsUpdated = true;
    }

    if (chatDetailsUpdated || chatModifiedDueToMessages) {
      if ((newMessage || newMessagesArray) && !updateDataForChatModel.updatedAt) {
         updateDataForChatModel.updatedAt = new Date(); 
      }
      console.log(`[/api/chats/[chatId]] Updating chat ${chatId} in DB with data:`, updateDataForChatModel);
      await prisma.chat.update({
        where: { id: chatId }, 
        data: updateDataForChatModel,
      });
      console.log(`[/api/chats/[chatId]] Chat ${chatId} updated in DB.`);
    }

    const finalChatState = await prisma.chat.findUnique({
      where: { id: chatId }, 
      include: { messages: { orderBy: { timestamp: 'asc' } } },
    });

    if (finalChatState) {
      const chatForClient = {
        ...finalChatState,
        messages: finalChatState.messages.map((msg: ChatMessage) => ({
          ...msg,
          timestamp: msg.timestamp.getTime(),
        })),
      };
      return NextResponse.json(chatForClient);
    }
    
    return NextResponse.json({ error: 'Failed to retrieve chat after update' }, { status: 404 });

  } catch (error) {
    console.error(`Failed to process PUT request for chat:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update chat';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE /api/chats/[chatId] - Delete a chat
export async function DELETE(request: NextRequest, context: { params: Promise<{ chatId: string }> }) {
    try {
        const params = await context.params; // Await the params Promise
        const chatId = params.chatId;
        await prisma.chat.delete({
            where: { id: chatId }, 
        });
        return NextResponse.json({ message: `Chat ${chatId} deleted successfully` }, { status: 200 });
    } catch (error) {
        console.error(`Failed to process DELETE request for chat:`, error);
        if ((error as any).code === 'P2025') { 
            return NextResponse.json({ error: 'Chat not found for deletion' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
    }
} 
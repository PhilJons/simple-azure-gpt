'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  title: string;
  updatedAt?: string | number;
  createdAt?: string | number;
  messages: ChatMessage[];
  titleGenerated?: boolean;
  timestamp?: number;
}

interface ChatContextType {
  currentChatId: string | undefined;
  setCurrentChatId: (chatId: string | undefined) => void;
  chats: Chat[];
  loadChat: (chatId: string) => Chat | undefined;
  updateChatMessages: (chatId: string, messages: ChatMessage[]) => Promise<void>;
  createNewChat: (title?: string) => Promise<Chat | null>;
  updateChatTitle: (chatId: string, newTitle: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  isLoadingChats: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  const fetchChats = useCallback(async () => {
    setIsLoadingChats(true);
    try {
      const response = await fetch('/api/chats');
      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }
      let data: Chat[] = await response.json();
      data = data.map(chat => ({
        ...chat,
        timestamp: chat.updatedAt ? new Date(chat.updatedAt).getTime() : Date.now(),
        messages: (chat.messages || []).map(msg => ({
            ...msg,
            timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : Number(msg.timestamp),
        }))
      }));      
      setChats(data);
    } catch (error) {
      console.error("Failed to load chats from API:", error);
      setChats([]);
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const loadChat = useCallback((chatId: string): Chat | undefined => {
    console.log("[ChatContext] loadChat called for:", chatId, "Current chats count in loadChat scope:", chats.length);
    return chats.find(chat => chat.id === chatId);
  }, [chats]);

  const updateChatMessages = useCallback(async (chatId: string, newMessages: ChatMessage[]) => {
    console.log(`[ChatContext] updateChatMessages called for chat ID: ${chatId} with ${newMessages.length} messages. First message content (if any):`, newMessages[0]?.content);
    setChats(prevChats => {
        const optimisticChats = prevChats.map(chat =>
            chat.id === chatId ? { ...chat, messages: newMessages, timestamp: Date.now(), updatedAt: Date.now().toString() } : chat
        );
        console.log(`[ChatContext] Optimistically updated chats for ${chatId}. Chat messages count (optimistic):`, optimisticChats.find(c=>c.id===chatId)?.messages.length);
        return optimisticChats;
    });

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }), 
      });
      console.log(`[ChatContext] PUT /api/chats/${chatId} for messages update, server response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ChatContext] Failed to update chat messages on server. Status: ${response.status}, Text: ${errorText}`);
        fetchChats();
        throw new Error('Failed to update chat messages on server');
      }
      const updatedChatFromServer: Chat = await response.json();
      console.log(`[ChatContext] Received updated chat from server (after messages update for ${chatId}):`, JSON.stringify(updatedChatFromServer, null, 2));
      
      setChats(prevChats => {
        const newChatState = prevChats.map(c => 
          c.id === chatId ? {
            ...updatedChatFromServer, 
            timestamp: updatedChatFromServer.updatedAt ? new Date(updatedChatFromServer.updatedAt).getTime() : Date.now(),
            messages: (updatedChatFromServer.messages || []).map(msg => ({...msg, timestamp: Number(msg.timestamp)}))
          } : c
        );
        console.log(`[ChatContext] Synced chat ${chatId} with server. New messages count:`, newChatState.find(c=>c.id===chatId)?.messages.length);
        return newChatState;
      });
    } catch (error) {
      console.error(`[ChatContext] Error in updateChatMessages catch block for ${chatId}:`, error);
      fetchChats(); 
    }
  }, [chats, fetchChats]);
  
  const createNewChat = useCallback(async (title: string = `New Chat`): Promise<Chat | null> => {
    console.log("[ChatContext] createNewChat called with title:", title);
    try {
      const initialTitle = title || `New Chat ${chats.length + 1}`;
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: initialTitle, titleGenerated: false }),
      });
      console.log(`[ChatContext] POST /api/chats for new chat, server response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ChatContext] Failed to create new chat on server. Status: ${response.status}, Text: ${errorText}`);
        throw new Error('Failed to create new chat on server');
      }
      const newChatFromServer: Chat = await response.json();
      console.log("[ChatContext] Received new chat from server:", newChatFromServer);
      
      const chatForClient: Chat = {
        ...newChatFromServer,
        timestamp: newChatFromServer.updatedAt ? new Date(newChatFromServer.updatedAt).getTime() : Date.now(),
        messages: (newChatFromServer.messages || []).map(msg => ({...msg, timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : Number(msg.timestamp)}))
      };
      console.log("[ChatContext] Mapped new chat for client state:", chatForClient);

      setChats(prevChats => {
        const updatedChats = [chatForClient, ...prevChats].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        console.log("[ChatContext] Updated chats array after adding new chat (before setting state):", updatedChats);
        return updatedChats;
      });
      setCurrentChatId(chatForClient.id);
      console.log("[ChatContext] CurrentChatId set to:", chatForClient.id);
      return chatForClient;
    } catch (error) {
      console.error("[ChatContext] Error in createNewChat catch block:", error);
      return null;
    }
  }, [chats]);

  const updateChatTitle = useCallback(async (chatId: string, newTitle: string) => {
    console.log(`[ChatContext] updateChatTitle called for chat ID: ${chatId} with new title: "${newTitle}"`);
    setChats(prevChats =>
      prevChats.map(chat =>
        chat.id === chatId ? { ...chat, title: newTitle, titleGenerated: true, timestamp: Date.now(), updatedAt: Date.now().toString() } : chat
      )
    );
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, titleGenerated: true }),
      });
      console.log(`[ChatContext] PUT /api/chats/${chatId} for title update, server response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ChatContext] Failed to update chat title on server. Status: ${response.status}, Text: ${errorText}`);
        fetchChats();
        throw new Error('Failed to update chat title on server');
      }
      const updatedChatFromServer: Chat = await response.json();
      console.log("[ChatContext] Received updated chat from server after title update:", updatedChatFromServer);
      setChats(prevChats => prevChats.map(c => c.id === chatId ? {
        ...updatedChatFromServer,
        timestamp: updatedChatFromServer.updatedAt ? new Date(updatedChatFromServer.updatedAt).getTime() : Date.now(),
        messages: (updatedChatFromServer.messages || []).map(msg => ({...msg, timestamp: Number(msg.timestamp)}))
      } : c));
    } catch (error) {
      console.error("[ChatContext] Error in updateChatTitle catch block:", error);
      fetchChats();
    }
  }, [fetchChats]);

  const deleteChat = useCallback(async (chatId: string) => {
    const previousChats = chats;
    setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      const remainingChats = previousChats.filter(chat => chat.id !== chatId && chat.id !== currentChatId );
      setCurrentChatId(remainingChats.length > 0 ? remainingChats.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0))[0].id : undefined);
    }
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setChats(previousChats);
        throw new Error('Failed to delete chat on server');
      }
    } catch (error) {
      console.error("Failed to delete chat on server:", error);
      setChats(previousChats); 
    }
  }, [chats, currentChatId]);

  return (
    <ChatContext.Provider value={{
      currentChatId, 
      setCurrentChatId,
      chats, 
      loadChat, 
      updateChatMessages, 
      createNewChat, 
      updateChatTitle, 
      deleteChat,
      isLoadingChats
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 
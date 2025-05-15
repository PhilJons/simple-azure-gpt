'use client';

import React, { useState, useEffect } from 'react';
import { useChat, Chat } from '@/contexts/ChatContext';

const ChatHistorySidebar: React.FC = () => {
  const { currentChatId, setCurrentChatId, chats, createNewChat, deleteChat: deleteChatFromContext, isLoadingChats } = useChat();

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  const handleCreateNewChat = async () => {
    const newChat = await createNewChat();
    if (newChat) {
      setCurrentChatId(newChat.id);
    }
  };

  const handleDeleteChat = async (chatIdToDelete: string) => {
    await deleteChatFromContext(chatIdToDelete);
  };

  if (isLoadingChats) {
    return <div className="p-4 text-muted-foreground">Loading chats...</div>;
  }

  // Log the chats array as seen by the sidebar before rendering
  console.log("[ChatHistorySidebar] Rendering with chats:", chats, "Current Chat ID:", currentChatId);

  return (
    <div className="w-64 h-full p-4 space-y-4 overflow-y-auto border-r border-border bg-background">
      <button
        onClick={handleCreateNewChat}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded mb-4 transition-colors"
      >
        New Chat
      </button>
      {(chats?.length || 0) === 0 && !isLoadingChats && (
        <p className="text-sm text-muted-foreground text-center">No chats yet. Start a new one!</p>
      )}
      <ul className="space-y-1">
        {(chats || []).map((chat) => (
          <li key={chat.id} 
              className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors
                          ${currentChatId === chat.id ? 'bg-muted font-semibold text-primary' : 'hover:bg-muted/50 text-foreground/80'}`}
              onClick={() => handleSelectChat(chat.id)}
          >
            <div className="flex-grow truncate">
              <h3 className="truncate text-sm">{chat.title || 'Untitled Chat'}</h3>
              {chat.timestamp && (
                <p className="text-xs text-muted-foreground">
                  {new Date(chat.timestamp).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteChat(chat.id);
                }}
                className="ml-2 text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-destructive/10"
                aria-label="Delete chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12.56 0c1.153 0 2.24.03 3.22.077m7.084.312A48.666 48.666 0 0 1 12 5.25c0 .414.038.814.108 1.21M12 9.75L12 5.25m0 0l-2.014.385M12 5.25c-1.32 0-2.605.068-3.828.196M6.404 6.344A48.507 48.507 0 0 1 12 5.25m6.396 1.094A48.507 48.507 0 0 0 12 5.25M12 5.25 12 9.75m0 0h3.996M12 9.75H8.004M12 9.75a.75.75 0 0 1-.75-.75V5.25a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-.75-.75h-.75Z" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatHistorySidebar; 
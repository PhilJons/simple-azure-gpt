'use client';

import React, { useState, useRef, useEffect, KeyboardEvent, DragEvent } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Paperclip, X } from 'lucide-react';
import { useChat, ChatMessage, Chat } from '@/contexts/ChatContext';

interface ChatFile {
  id: string;
  name: string;
  type: string;
  content: string;
}

interface ChatInterfaceProps {
  selectedModel: string;
}

const MAX_TEXTAREA_ROWS = 8;
const APPROX_LINE_HEIGHT_PX = 20;
const APPROX_TOKEN_LIMIT_CHARS = 700000;

export function ChatInterface({ selectedModel }: ChatInterfaceProps) {
  const { currentChatId, loadChat, updateChatMessages, createNewChat, updateChatTitle } = useChat();

  useEffect(() => {
    console.log("[ChatInterface] Context currentChatId changed to:", currentChatId);
  }, [currentChatId]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<ChatFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const viewportScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayedMessages: ChatMessage[] = currentChatId ? loadChat(currentChatId)?.messages || [] : [];

  console.log("[ChatInterface] Calculating displayedMessages. currentChatId:", currentChatId, "Number of messages:", displayedMessages.length);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = MAX_TEXTAREA_ROWS * APPROX_LINE_HEIGHT_PX;
      textareaRef.current.style.height = scrollHeight > maxHeight ? `${maxHeight}px` : `${scrollHeight}px`;
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [input]);

  const processFiles = (files: FileList) => {
    const fileArray = Array.from(files);
    const allowedTypes = ['text/plain', 'text/csv', 'application/json'];
    const newChatFiles: ChatFile[] = [];
    fileArray.forEach(file => {
      if (allowedTypes.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileContent = e.target?.result as string;
          newChatFiles.push({
            id: `${file.name}-${Date.now()}`,
            name: file.name,
            type: file.type,
            content: fileContent,
          });
          if (newChatFiles.length === fileArray.filter(f => allowedTypes.includes(f.type)).length) {
            setAttachedFiles(prev => [...prev, ...newChatFiles]);
          }
        };
        reader.onerror = () => console.error(`Error reading file: ${file.name}`);
        reader.readAsText(file);
      } else {
        console.warn(`File type ${file.type} not allowed for ${file.name}`);
      }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
  };

  const handleSend = async () => {
    console.log("[ChatInterface] handleSend called. Initial context currentChatId:", currentChatId);
    if (!input.trim() && attachedFiles.length === 0) return;

    let activeChatId = currentChatId;
    let isNewChat = false;
    let newChatObjectForTitleGen: Chat | null = null;

    if (!activeChatId) {
      setIsLoading(true);
      const newChat = await createNewChat();
      if (!newChat) {
        console.error("[ChatInterface] Failed to create a new chat via context.");
        alert("Error: Could not create a new chat. Please try sending your message again.");
        setIsLoading(false);
        return;
      }
      activeChatId = newChat.id;
      isNewChat = true;
      newChatObjectForTitleGen = newChat;
    }

    let messageContent = input;
    if (attachedFiles.length > 0) {
      const attachmentsText = attachedFiles.map(file =>
        `--- Attachment: ${file.name} (${file.type}) ---\n${file.content}\n--- End Attachment: ${file.name} ---`
      ).join('\n\n');
      messageContent = input.trim() ? `${input}\n\n${attachmentsText}` : attachmentsText;
    }

    if (messageContent.length > APPROX_TOKEN_LIMIT_CHARS) {
      if (!window.confirm(`Warning: Long message. Send anyway?`)) return;
    }

    const initialMessages = loadChat(activeChatId)?.messages || [];
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: messageContent.trim(),
      timestamp: Date.now()
    };

    const messagesWithUser = [...initialMessages, newUserMessage];
    await updateChatMessages(activeChatId, messagesWithUser);

    setInput('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }
    setIsLoading(true);

    const messagesForApi = messagesWithUser.map(({ role, content }) => ({ role, content }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesForApi, model: selectedModel }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `API error: ${response.statusText}` }));
        throw new Error(errorData.error || `API error: ${response.statusText}`);
      }

      const data = await response.json();
      const assistantApiResponse = data.message as { role: 'assistant'; content: string };

      if (assistantApiResponse) {
        const newAssistantMessage: ChatMessage = {
          role: 'assistant',
          content: assistantApiResponse.content,
          timestamp: Date.now(),
        };
        await updateChatMessages(activeChatId, [...messagesWithUser, newAssistantMessage]);

        const chatDetailsForTitleCheck = isNewChat ? newChatObjectForTitleGen : loadChat(activeChatId);
        
        console.log("[ChatInterface] DEBUG Values before title generation check:", {
          activeChatId,
          isNewChat,
          currentChatDetails: chatDetailsForTitleCheck,
          titleGenerated: chatDetailsForTitleCheck?.titleGenerated,
          userMsgContent: newUserMessage?.content,
          assistantMsgContent: newAssistantMessage?.content
        });

        if (activeChatId && isNewChat && chatDetailsForTitleCheck && !chatDetailsForTitleCheck.titleGenerated) {
          if (newUserMessage.content && newAssistantMessage.content) {
            console.log("[ChatInterface] Attempting to generate title for new chat:", activeChatId);
            try {
              const titleResponse = await fetch('/api/generate-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  firstUserMessageContent: newUserMessage.content,
                  firstAssistantMessageContent: newAssistantMessage.content,
                  model: selectedModel,
                }),
              });
              if (titleResponse.ok) {
                const { title: newTitle } = await titleResponse.json();
                console.log("[ChatInterface] Received title from /api/generate-title:", newTitle);
                if (newTitle) {
                  console.log("[ChatInterface] Calling updateChatTitle context for chat:", activeChatId, "New title:", newTitle);
                  await updateChatTitle(activeChatId, newTitle);
                } else {
                  console.log("[ChatInterface] Generated title was empty or null.");
                }
              } else {
                const errorText = await titleResponse.text();
                console.error("[ChatInterface] Failed to generate chat title. API response NOT OK:", titleResponse.status, errorText);
              }
            } catch (titleError) {
              console.error("[ChatInterface] Error calling title generation API:", titleError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch chat response:", error);
      const systemErrorMessage: ChatMessage = {
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      await updateChatMessages(activeChatId, [...messagesWithUser, systemErrorMessage]);
    }
    setIsLoading(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const scrollToBottom = () => {
    if (viewportScrollRef.current) {
      viewportScrollRef.current.scrollTo({ top: viewportScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayedMessages]);

  useEffect(() => {
    console.log("[ChatInterface] useEffect reacting to currentChatId change. New context currentChatId:", currentChatId);
    if (!currentChatId) {
      console.log("[ChatInterface] currentChatId is now falsy. Clearing input and attachments.");
      setInput('');
      setAttachedFiles([]);
    } else {
      console.log("[ChatInterface] currentChatId is now truthy:", currentChatId, "Not clearing input.");
      // Potentially, if a chat is selected, we might want to focus the input or scroll.
      // For now, just logging.
    }
  }, [currentChatId]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      processFiles(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-0">
      <ScrollArea className="flex-1 p-4 min-h-0">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {currentChatId && displayedMessages.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-full pt-10">
                <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          )}
          {!currentChatId && !isLoading && (
            <div className="flex items-center justify-center h-full pt-10">
                <p className="text-muted-foreground">Select a chat, or type a message to start a new one.</p>
            </div>
          )}
          {displayedMessages.map((msg, index) => (
            <Card
              key={`${msg.timestamp}-${index}-${msg.role}`}
              className={`max-w-[85%] p-3 ${msg.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              <CardContent className="p-0 text-sm whitespace-pre-wrap break-words">
                {msg.content}
              </CardContent>
            </Card>
          ))}
          {isLoading && (
             <Card className="max-w-[85%] p-3 bg-muted mx-auto">
                 <CardContent className="p-0 text-sm italic">Thinking...</CardContent>
             </Card>
          )}
        </div>
      </ScrollArea>

      <div className="px-4 pb-4 pt-2 w-full mx-auto max-w-3xl">
        <div 
          className={`p-4 bg-card border border-border rounded-lg shadow-lg space-y-2 ${isDraggingOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-1 bg-muted p-1.5 rounded-md text-xs text-muted-foreground">
                  <span>{file.name}</span>
                  <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={() => removeAttachedFile(file.id)} disabled={isLoading}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-end space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0"
            >
              <Paperclip className="size-5" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={currentChatId ? "Type your message or drop files here..." : "Type to start a new chat or select one..."}
              className="flex-1 resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
              rows={1}
              disabled={isLoading}
              style={{ maxHeight: `${MAX_TEXTAREA_ROWS * APPROX_LINE_HEIGHT_PX}px` }}
            />
            <Button type="submit" disabled={isLoading || (!input.trim() && attachedFiles.length === 0)} className="shrink-0">
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </form>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".txt,.csv,.json,text/plain,text/csv,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
} 
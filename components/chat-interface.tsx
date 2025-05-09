'use client';

import React, { useState, useRef, useEffect, KeyboardEvent, DragEvent } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Paperclip, X } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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
const APPROX_TOKEN_LIMIT_CHARS = 700000; // Approx 700k chars as a rough proxy for ~1M tokens

export function ChatInterface({ selectedModel }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<ChatFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const viewportScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = MAX_TEXTAREA_ROWS * APPROX_LINE_HEIGHT_PX;

      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.height = `${scrollHeight}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [input]);

  const processFiles = (files: FileList) => {
    const fileArray = Array.from(files);
    const allowedTypes = ['text/plain', 'text/csv', 'application/json'];
    const newChatFiles: ChatFile[] = [];
    let filesProcessed = 0;

    if (fileArray.length === 0) return;

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
          filesProcessed++;
          if (filesProcessed === fileArray.filter(f => allowedTypes.includes(f.type)).length) {
            setAttachedFiles(prev => [...prev, ...newChatFiles]);
          }
        };
        reader.onerror = () => {
          console.error(`Error reading file: ${file.name}`);
          filesProcessed++;
           if (filesProcessed === fileArray.filter(f => allowedTypes.includes(f.type)).length) {
            setAttachedFiles(prev => [...prev, ...newChatFiles]);
          }
        };
        reader.readAsText(file);
      } else {
        console.warn(`File type ${file.type} not allowed for ${file.name}`);
      }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    let messageContent = input;
    let totalCharCount = input.length;

    let attachmentsText = "";
    if (attachedFiles.length > 0) {
      attachmentsText = attachedFiles.map(file => {
        const fileEntry = `--- Attachment: ${file.name} (${file.type}) ---\n${file.content}\n--- End Attachment: ${file.name} ---`;
        totalCharCount += fileEntry.length;
        return fileEntry;
      }).join('\n\n');
      messageContent = input.trim() ? `${input}\n\n${attachmentsText}` : attachmentsText;
    }

    if (totalCharCount > APPROX_TOKEN_LIMIT_CHARS) {
      const proceed = window.confirm(
        `Warning: Your message (including attachments) is very long (approx. ${totalCharCount.toLocaleString()} characters). \nThis might exceed the model\'s context limit and cause an error. \nDo you want to try sending it anyway?`
      );
      if (!proceed) {
        return; // User chose not to send
      }
    }

    const newUserMessage: Message = { role: 'user', content: messageContent.trim() };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInput('');
    setAttachedFiles([]);
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; 
        textareaRef.current.style.overflowY = 'hidden';
    }
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `API error: ${response.statusText}` }));
        throw new Error(errorData.error || `API error: ${response.statusText}`);
      }

      const data = await response.json();
      const assistantMessage = data.message as Message;

      if (assistantMessage) {
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      }
    } catch (error) {
      console.error("Failed to fetch chat response:", error);
      setMessages((prevMessages) => [...prevMessages, { role: 'system', content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}` }]);
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
  }, [messages]);

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
    <div className="w-full h-full flex flex-col bg-card rounded-lg shadow">
      <ScrollArea className="flex-1 p-4 min-h-0" viewportRef={viewportScrollRef}>
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <Card
              key={index}
              className={`max-w-[75%] p-3 ${msg.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              <CardContent className="p-0 text-sm whitespace-pre-wrap break-words">
                {msg.content}
              </CardContent>
            </Card>
          ))}
          {isLoading && (
             <Card className="max-w-[75%] p-3 bg-muted">
                 <CardContent className="p-0 text-sm italic">Thinking...</CardContent>
             </Card>
          )}
        </div>
      </ScrollArea>

      <div 
        className={`border-t p-4 bg-background rounded-b-lg space-y-2 ${isDraggingOver ? 'border-primary ring-2 ring-primary ring-offset-2' : ''}`}
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
            placeholder="Type your message or drop files here..."
            className="flex-1 resize-none"
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
  );
} 
'use client';

import React, { useState } from 'react';
import { Header } from '@/components/header';
import { ChatInterface } from '@/components/chat-interface'; // Import the chat interface

export default function Home() {
  const [selectedModel, setSelectedModel] = useState('gpt-4.1'); // Default model updated

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header 
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />

      {/* Main Content Area - Pass selectedModel to ChatInterface */}
      <main className="flex-1 flex flex-col items-center overflow-hidden p-4">
        {/* Centered Chat Interface Container */}
        <div className="w-full max-w-4xl h-full flex flex-col">
           <ChatInterface selectedModel={selectedModel} /> 
        </div>
      </main>
    </div>
  );
}

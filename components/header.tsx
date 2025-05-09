'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function Header({ selectedModel, onModelChange }: HeaderProps) {
  return (
    <header className="w-full p-4 bg-card border-b shadow-sm flex justify-between items-center">
      <h1 className="text-xl font-semibold text-card-foreground">AI Chat</h1>
      <div className="w-[200px]">
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger className="w-full bg-background focus:ring-primary">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="gpt-4.1">Azure GPT-4.1</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </header>
  );
} 
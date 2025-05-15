'use client';

import React from 'react'; // Removed useState as model is handled by layout
// import { Header } from '@/components/header'; // Header is now in layout
import { ChatInterface } from '@/components/chat-interface';

// Making the Home component accept generic props to try and pass the build.
// selectedModel will be passed by RootLayout via React.cloneElement.
export default function Home(props: any) {
  // const [selectedModel, setSelectedModel] = useState('gpt-4.1'); // State now in RootLayout

  return (
    // The main flex structure is handled by RootLayout.
    // This component just needs to render the ChatInterface.
    // The ChatInterface will take up the space allocated by RootLayout's <main> tag.
    <ChatInterface selectedModel={props.selectedModel} />
  );
}

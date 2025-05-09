import { NextResponse } from 'next/server';
import { azure } from '@ai-sdk/azure';
import { generateText, CoreMessage } from 'ai';

// The azure provider from @ai-sdk/azure will look for environment variables:
// AZURE_OPENAI_API_KEY for the API key
// AZURE_OPENAI_ENDPOINT for the endpoint
// The deployment name is passed as an argument to azure()

export async function POST(req: Request) {
  try {
    const { messages, model: deploymentNameFromRequest } = await req.json();

    if (!messages || !deploymentNameFromRequest) {
      return NextResponse.json({ error: 'Missing messages or Azure deployment name (model) in request' }, { status: 400 });
    }

    // Basic check if primary env vars seem to be missing, the SDK will do more robust checks.
    if (!process.env.AZURE_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
        return NextResponse.json({ error: 'Azure OpenAI API key or endpoint not configured in environment variables (AZURE_API_KEY, AZURE_OPENAI_ENDPOINT)' }, { status: 500 });
    }

    const { text, finishReason, usage } = await generateText({
      model: azure(deploymentNameFromRequest), // deploymentNameFromRequest should be your AZURE_OPENAI_DEPLOYMENT_NAME
      system: "You are a helpful AI assistant. Please be concise and friendly.", // Add your system prompt here
      messages: messages as CoreMessage[],
      temperature: 0.7, // Adjust temperature here (e.g., 0.2 for more deterministic, 0.9 for more creative)
      // You can also add other parameters like maxTokens, topP, etc., if supported by the model and SDK:
      maxTokens: 32768, // Set a practical limit for chat response length
      // topP: 0.9,
    });

    const responseMessage = { role: 'assistant' as const, content: text };

    if (!text) {
        return NextResponse.json({ error: 'No response content from Azure OpenAI' }, { status: 500 });
    }
    
    return NextResponse.json({ message: responseMessage });

  } catch (error) {
    console.error('Full error object from Azure OpenAI API call:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage, details: error }, { status: 500 });
  }
} 
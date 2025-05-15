import { NextResponse } from 'next/server';
import { azure } from '@ai-sdk/azure';
import { generateText, CoreMessage } from 'ai';

export async function POST(req: Request) {
  console.log("[/api/generate-title] Received request to generate title.");
  try {
    const { firstUserMessageContent, firstAssistantMessageContent, model: deploymentNameFromRequest } = await req.json();
    console.log("[/api/generate-title] Request body:", { firstUserMessageContent, firstAssistantMessageContent, deploymentNameFromRequest });

    if (!firstUserMessageContent || !firstAssistantMessageContent || !deploymentNameFromRequest) {
      console.error("[/api/generate-title] Missing message content or model in request.");
      return NextResponse.json({ error: 'Missing message content or Azure deployment name (model) in request' }, { status: 400 });
    }

    if (!process.env.AZURE_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
      console.error("[/api/generate-title] Azure OpenAI API key or endpoint not configured.");
      return NextResponse.json({ error: 'Azure OpenAI API key or endpoint not configured' }, { status: 500 });
    }

    const systemPromptForTitle = "Based on the following two messages, generate a very short and concise title (3-5 words) for this new chat session. The title should capture the main topic or question. Do not include any prefixes like 'Title:'. Just return the title itself.";

    const messagesForTitleGeneration: CoreMessage[] = [
      { role: 'user', content: firstUserMessageContent },
      { role: 'assistant', content: firstAssistantMessageContent },
    ];
    console.log("[/api/generate-title] Messages for AI title generation:", messagesForTitleGeneration);

    const { text: generatedTitle } = await generateText({
      model: azure(deploymentNameFromRequest),
      system: systemPromptForTitle,
      messages: messagesForTitleGeneration,
      temperature: 0.3, // Lower temperature for more factual/less creative titles
      maxTokens: 20,    // Titles should be short
      topP: 0.9,
    });
    console.log("[/api/generate-title] AI generated title raw output:", generatedTitle);

    if (!generatedTitle) {
      console.error("[/api/generate-title] Failed to generate title from Azure OpenAI (empty result).");
      return NextResponse.json({ error: 'Failed to generate title from Azure OpenAI' }, { status: 500 });
    }

    const finalTitle = generatedTitle.trim();
    console.log("[/api/generate-title] Final trimmed title:", finalTitle);
    return NextResponse.json({ title: finalTitle });

  } catch (error) {
    console.error('[/api/generate-title] Error generating chat title:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 
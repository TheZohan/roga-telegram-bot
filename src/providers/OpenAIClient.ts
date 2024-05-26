import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
  });

export async function getOpenAISystemMessageResponse(systemMessage: string, userMessage: string): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
    ];
    const completionRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model: process.env.OPENAI_MODEL || "gpt-4.0-turbo",
        messages,
        max_tokens: 150, // Limit the response length
    };

    try {
        const chatCompletion = await openai.chat.completions.create(completionRequest);
        const responseChoices = chatCompletion.choices;
        console.log("responseChoices:", responseChoices);
        return responseChoices[0].message.content?.toString() || "I don't know what to say...";
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        return "I'm experiencing some difficulties right now. Please try again later.";
    }
}

export async function getOpenAIResponse(content: string, role: 'system' | 'user'): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
        { role, content},
    ];
    const completionRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model: process.env.OPENAI_MODEL || "gpt-4.0",
        messages,
        max_tokens: 150, // Limit the response length
    };

    try {
        const chatCompletion = await openai.chat.completions.create(completionRequest);
        const responseChoices = chatCompletion.choices;
        console.log("OpenAI Response: ", responseChoices);
        return responseChoices[0].message.content?.toString() || "I don't know what to say...";
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        return "I'm experiencing some difficulties right now. Please try again later.";
    }
}

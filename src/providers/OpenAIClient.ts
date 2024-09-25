import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionRole } from 'openai/resources';
import { LLMProvider } from './LlmProvider';
import { Message, StandardRoles } from '../user/UserProfile';
import logger from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export class OpenAIClient implements LLMProvider {
  async sendMessage(systemMessage: string, userMessage: string, messageHistory: Message[]): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ];
    const history = this.formatMessageHistory(messageHistory);
    const messagesToSend = [...messages, ...history];
    logger.debug('SEND', messagesToSend);
    const completionRequest: OpenAI.Chat.ChatCompletionCreateParams = {
      model: process.env.OPENAI_MODEL || 'GPT-4o',
      messages: messagesToSend,
      max_tokens: 150, // Limit the response length
    };

    try {
      const chatCompletion = await openai.chat.completions.create(completionRequest);
      const responseChoices = chatCompletion.choices;
      logger.debug('Response:', responseChoices);
      return responseChoices[0].message.content?.toString() || "I don't know what to say...";
    } catch (error) {
      logger.error('Error calling OpenAI:', error);
      throw error;
    }
  }

  private formatMessageHistory(messageHistory: Message[]) {
    return messageHistory.map((message: Message) => {
      let role: ChatCompletionRole = 'user';
      switch (message.role) {
        case StandardRoles.system:
          role = 'system';
          break;
        case StandardRoles.assistant:
          role = 'assistant';
          break;
        default:
          role = 'user';
      }
      const chatMessages: ChatCompletionMessageParam = { role, content: message.message };
      return chatMessages;
    });
  }
}

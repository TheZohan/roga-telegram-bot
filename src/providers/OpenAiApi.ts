import { LLMProvider } from './LlmProvider';
import { ChatCompletionMessageParam, ChatCompletionRole } from 'openai/resources';
import OpenAI from 'openai';
import logger from '../utils/logger';
import { Message, StandardRoles } from '../user/UserProfile';

export default class OpenAIApi implements LLMProvider {
  private openai: OpenAI;
  private aImodel: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    this.aImodel = process.env.OPENAI_MODEL || 'gpt-4o';
    logger.info('Using Open AI model: ' + this.aImodel);
  }

  private readonly API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
  async sendMessage(systemMessage: string, userMessage: string, messageHistory: Message[]): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ];
    const history = this.formatMessageHistory(messageHistory);
    const messagesToSend = [...messages, ...history];
    logger.debug('SEND', messagesToSend);
    const completionRequest: OpenAI.Chat.ChatCompletionCreateParams = {
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: messagesToSend,
      max_tokens: 150, // Limit the response length
    };
    try {
      const chatCompletion = await this.openai.chat.completions.create(completionRequest);
      const responseChoices = chatCompletion.choices;
      logger.debug('Response:', responseChoices);
      return responseChoices[0].message.content?.toString() || "I don't know what to say...";
    } catch (error) {
      logger.error('Error calling OpenAI:', error);
      throw error;
    }
  }

  formatMessageHistory(messageHistory: Message[]): ChatCompletionMessageParam[] {
    return messageHistory.map((message: Message) => {
      let role: ChatCompletionRole;
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
      const chatMessage: ChatCompletionMessageParam = { role, content: message.message };
      return chatMessage;
    });
  }
}

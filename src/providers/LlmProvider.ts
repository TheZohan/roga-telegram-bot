import { Message } from '../user/UserProfile';

export interface LLMProvider {
  sendMessage(systemMessage: string, userMessage: string, messageHistory: Message[]): Promise<string>;
}

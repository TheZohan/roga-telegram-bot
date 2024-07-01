import { Message } from '../user/UserProfile';

export interface LLMProvider {
  sendMessage(
    systemMessage: string,
    userMessage: string,
    chatHistory?: Message[],
  ): Promise<string>;
}

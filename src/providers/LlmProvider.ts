import { Message } from '../user/UserProfile';

export default interface LLMProvider {
  sendMessage(systemMessage: string, userMessage: string, messageHistory: Message[]): Promise<string>;
}
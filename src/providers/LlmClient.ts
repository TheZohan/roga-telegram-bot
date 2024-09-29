import LLMProvider from './LlmProvider';
import OpenAIApi from './OpenAiApi';
import { Message } from '../user/UserProfile';


export default class LlmClient {
  LlmProviderType = process.env.LLM_PROVIDER_TYPE || 'openai';
  LlmProviderKey = process.env.LLM_API_KEY || '';
  LlmProvider: LLMProvider = this.createLLmProvider(this.LlmProviderType);
  async sendMessage(systemMessage: string, userMessage: string, messageHistory: Message[]): Promise<string> {
    return this.LlmProvider.sendMessage(systemMessage, userMessage, messageHistory);
  }
  private createLLmProvider(providerType: string): LLMProvider {
    return new OpenAIApi();
  }
}
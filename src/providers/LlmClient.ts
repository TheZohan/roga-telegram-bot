import { LLMProvider } from './LlmProvider';
import logger from '../utils/logger';
import CohereApi from './CohereApi';
import OpenAIApi from './OpenAiApi';
import { Message } from '../user/UserProfile';


export class LlmClient implements LLMProvider {
  LlmProviderType = process.env.LLM_PROVIDER_TYPE || 'openai';
  LlmProviderKey = process.env.LLM_API_KEY || '';
  LlmProvider: LLMProvider = this.createLLmProvider(this.LlmProviderType);
  async sendMessage(systemMessage: string, userMessage: string, messageHistory: Message[]): Promise<string> {
    return this.LlmProvider.sendMessage(systemMessage, userMessage, messageHistory);
  }
  private createLLmProvider(providerType: string): LLMProvider {
    if (providerType === 'cohere'){ 
      logger.info('Using Cohere API');
      return new CohereApi();
    }
    logger.info('Using OpenAI API');
    return new OpenAIApi();
  }
}


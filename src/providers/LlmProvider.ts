import { Message } from '../user/UserProfile';
import logger from '../utils/logger';
import OpenAIApi from './OpenAiApi';

export interface LLMProvider {
  sendMessage(systemMessage: string, userMessage: string, messageHistory: Message[]): Promise<string>;
}
export const getLLMClient = (): LLMProvider => {
  switch (process.env.LLM_PROVIDER) {
    default:
      logger.info('Using OpenAI as the LLM provider');
      return new OpenAIApi();
  }
};

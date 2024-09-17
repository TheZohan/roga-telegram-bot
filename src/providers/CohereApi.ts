import { LLMProvider } from './LlmProvider';
import { Message } from '../user/UserProfile';
import logger from '../utils/logger';
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.LLM_API_KEY!,
});

export default class CohereApi implements LLMProvider {
  private readonly LLM_MODEL = process.env.LLM_MODEL || 'command'; 
  private readonly configuration = {
    temperature: 0.7,
    k: 10, // 0 to 500, AKA top_k
    p: 0.5, // AKA top_p
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    prompt_truncation: 'AUTO', // Options are "OFF", "AUTO_PRESERVE_ORDER" or "AUTO"
    citation_quality: 'accurate', //  # O
    model: this.LLM_MODEL,
  };
  public async sendMessage(systemMessage: string, userMessage: string, chatHistory: Message[]): Promise<string> {
    try{
      const res = await cohere.chat({
        chatHistory: chatHistory,
        preamble: userMessage == '' ? userMessage : systemMessage,
        message: userMessage == '' ? systemMessage : userMessage,
        maxTokens: 150, // Adjust as needed
        ...this.configuration,
      });
      return res.text;
    } catch (error) {
      logger.error('Error calling Cohere:', error);
      return "I'm experiencing some difficulties right now. Please try again later.";
    }
  }
}

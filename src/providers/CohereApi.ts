import axios from 'axios';
import { LLMProvider } from './LlmProvider';
import { Message } from '../user/UserProfile';

export default class CohereApi implements LLMProvider {
  private readonly CHAT_API_ENDPOINT = 'https://api.cohere.com/v1/chat';
  private readonly API_KEY = process.env.COHERE_API_KEY; // Replace with your OpenAI API key
  private readonly configuration = {
    temperature: 0.7,
    k: 10, // 0 to 500, AKA top_k
    p: 0.5, // AKA top_p
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    prompt_truncation: null, // Options are "OFF", "AUTO_PRESERVE_ORDER" or "AUTO"
    citation_quality: 'accurate', //  # O
  };

  public async sendMessage(
    systemMessage: string,
    userMessage: string,
    chatHistory: Message[],
  ): Promise<string> {
    try {
      const response = await axios.post(
        this.CHAT_API_ENDPOINT,
        {
          message: userMessage,
          model: process.env.COHERE_MODEL,
          preamble: systemMessage,
          chat_history: chatHistory,
          max_tokens: 400, // Adjust as needed
        },
        {
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data && response.data.text) {
        return response.data.text;
      } else {
        throw new Error('No response from Cohere API');
      }
    } catch (error) {
      console.error('Error communicating with Cohere API:', error);
      throw error;
    }
  }
}

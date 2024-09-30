import LLMProvider from './LlmProvider';
import OpenAIApi from './OpenAiApi';
import { Message } from '../user/UserProfile';


export default class LlmClient {
  constructor(){
    switch (process.env.LLM_PROVIDER) {
      default:
        return new OpenAIApi();
    }
  }
}
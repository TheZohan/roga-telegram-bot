import { LLMProvider } from '../src/providers/LlmProvider';

interface StringToStringObject {
  [key: string]: string;
}
export class LlmClientMock implements LLMProvider {
  responses: StringToStringObject = {};
  sendMessage(systemMessage: string, userMessage: string): Promise<string> {
    console.log('send Messge :' + createInput(systemMessage, userMessage));
    return Promise.resolve(this.responses[createInput(systemMessage, userMessage)]);
  }
  setResponse(input: string, output: string) {
    console.log('set Response:' + input);
    this.responses[input] = output;
  }
}

export const createInput = (SystemMessage: string, userMessage: string): string => {
  return SystemMessage + '__' + userMessage;
};

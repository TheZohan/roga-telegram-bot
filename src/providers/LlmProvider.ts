export interface LLMProvider {
    sendMessage(systemMessage: string, userMessage: string): Promise<string>;
}

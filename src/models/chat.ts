
import { ChatOpenAI } from "langchain/chat_models";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { Tool } from "langchain/tools";
import { ChainValues } from "langchain/dist/schema";

const openAIApiKey = process.env.OPENAI_API_KEY!;

const params = {
  verbose: true,
  temperature: 1,
  openAIApiKey,
  modelName: process.env.OPENAI_MODEL ?? "gpt-4",
  maxConcurrency: 1,
  maxTokens: 1000,
  maxRetries: 5,
};

export class Model {
  public tools: Tool[] = [];
  public chain: ConversationChain;
  public openai: OpenAIApi;

  constructor() {
    const configuration = new Configuration({
      apiKey: openAIApiKey,
    });

    this.openai = new OpenAIApi(configuration);
    const model = new ChatOpenAI(params, configuration);

    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `You are a spritual mentor named Roga.
        If the user doesn't know what to do, ask him or her about their day. Try to understand their challanges. 
        Ask for as many details as possible about the user's status and situation.
        Be empathetic about how the user feels in his situation.
        If the user asks a question responsd in a short message portraying a short summary of the answer 
        preferably ending in a question and not a saying.
        Avoid giving advice as much as you can. Try to get the user to come up with the answer by providing hints according to 
        his or her experience. `
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    this.chain = new ConversationChain({
      memory: new BufferMemory({ returnMessages: true }),
      prompt: chatPrompt,
      llm: model,
    });
  }

  public async call(input: string) {
    const response: ChainValues = await this.chain.call({ input });
    console.log("Output: " + response.response);
    return response.response;
  }
}

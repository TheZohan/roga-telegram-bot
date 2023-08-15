import { AgentExecutor, Tool, initializeAgentExecutor } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models";
import { BufferMemory } from "langchain/memory";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { googleTool } from "./tools/google";
import { PromptTemplate } from "langchain/prompts";
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
  public tools: Tool[];
  public executor?: AgentExecutor;
  public openai: OpenAIApi;
  public model: ChatOpenAI;

  constructor() {
    const configuration = new Configuration({
      apiKey: openAIApiKey,
    });

    // this.tools = [googleTool];
    this.tools = [];
    this.openai = new OpenAIApi(configuration);
    this.model = new ChatOpenAI(params, configuration);
  }

  public async call(input: string) {
    if (!this.executor) {
      this.executor = await initializeAgentExecutor(
        this.tools,
        this.model,
        "chat-conversational-react-description",
        true
      );
      this.executor.memory = new BufferMemory({
        returnMessages: true,
        memoryKey: "chat_history",
        inputKey: "input",
      });
    }

    try {
      const response: ChainValues = await this.executor!.call({ input });
      console.log("Model response: " + response.out);
      return response.output;
    } catch(error) {
      console.log(error);
    }
  }
}

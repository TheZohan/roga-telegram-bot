import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { BufferWindowMemory } from "langchain/memory";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { googleTool } from "./tools/google";
import { PromptTemplate } from "langchain/prompts";
import { ChainValues } from "langchain/dist/schema";
import { Tool } from "langchain/tools";

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
      this.executor = await initializeAgentExecutorWithOptions(
        this.tools,
        this.model,
        {
          agentType: "chat-conversational-react-description",
          verbose: true,
        }
      );
      this.executor.memory = new BufferWindowMemory({
        k: 5,
        returnMessages: true,
        memoryKey: "chat_history",
        inputKey: "input",
      });
    }
    const response: ChainValues = await this.executor!.call({ input });
    console.log("Model response: " + response.out);
    return response.output;
  }
}

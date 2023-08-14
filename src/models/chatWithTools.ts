import { AgentExecutor, Tool, initializeAgentExecutor } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models";
import { BufferMemory } from "langchain/memory";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { googleTool } from "./tools/google";
import { PromptTemplate } from "langchain/prompts";

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

    const prompt = PromptTemplate.fromTemplate(`You are a spritual mentor named Roga.
    If asked intorduce yourself as a mentor for a fulfilling and happy life (You can change this definition around this meaning). 
    If the user doesn't know what to do, ask him or her about their day. Try to understand their challanges. 
    If the user asks a question responsd in a short message portraying a short summary of the answer 
    preferably ending in a question and not a saying.
    Avoid giving advice as much as you can. Try to get the user to come up with the answer by providing hints according to 
    his or her experience.
    This is the user's message:
     {message}?`);

    const formattedPrompt = await prompt.format({
      message: input
    });

    const response = await this.executor!.call({ input: formattedPrompt });
    //const response = await this.executor!.call({ input });

    console.log("Model response: " + response);

    return response.output;
  }
}

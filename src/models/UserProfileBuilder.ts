
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
import { UserProfile } from "../user/UserProfile";

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

export class UserAnalyzer {
  public tools: Tool[] = [];
  public chain: ConversationChain;
  public openai: OpenAIApi;
  private userProfile: UserProfile;

  constructor(userProfile: UserProfile) {
    
    const configuration = new Configuration({
      apiKey: openAIApiKey,
    });

    this.openai = new OpenAIApi(configuration);
    const model = new ChatOpenAI(params, configuration);
    this.userProfile = userProfile;

    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `Extract any characteristics and information about the user from the input
        and add it to the userProfile JSON object.
        Return only the JSON as response.`
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    this.chain = new ConversationChain({
      memory: new BufferMemory({ returnMessages: true }),
      prompt: chatPrompt,
      llm: model,
      verbose: true
    });
  }

  public async analyze(input: string) {
    const updatedUserProfile: ChainValues = await this.chain.call({input: {userInput: input, userProfile: this.userProfile}});
    this.userProfile = updatedUserProfile.response;
    return this.userProfile;
  }
}

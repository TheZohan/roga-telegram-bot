import { mock } from 'ts-jest-mocker';
import { MessageHandler } from '../src/models/MessageHandler';
import { RatingSelector } from '../src/TelegramBot/ratingSelector';
import { UserStore } from '../src/user/UserStore';
import { Language, UserContext, UserProfile } from '../src/user/UserProfile';
import * as PromptsLoader from '../src/prompts/PromptsLoader';
import { getPrompt } from '../src/prompts/PromptsLoader';
import { OpenAIMock, createInput } from './OpenAiMock';
import { MemoryUserStore } from '../src/user/MemoryUserStore';
interface Responses {
  userMessage: string;
  botMessage: string;
  inContext: boolean;
  summery: string;
}

const openAIClientMock: OpenAIMock = new OpenAIMock();
jest.mock('../src/providers/OpenAIClient', () => {
  return {
    OpenAIClient: jest.fn().mockImplementation(() => {
      return openAIClientMock;
    }),
  };
});

const originalGetPrompt = PromptsLoader.getPrompt;
jest.spyOn(PromptsLoader, 'getPrompt').mockImplementation((promptName, data) => {
  delete data.userProfile;
  delete data.randomTeacher;
  delete data.answerLength;
  return originalGetPrompt(promptName, data);
});

const setResponses = async (responses: Responses, user: UserProfile) => {
  const isMessageInChatContext = getPrompt('isMessageInChatContext', {});
  openAIClientMock.setResponse(
    createInput(isMessageInChatContext, responses.userMessage),
    responses.inContext ? 'yes' : 'no',
  );

  const notInContext = getPrompt('informTheUserThatTheMessageIsNotInContext', {
    lastMessage: responses.userMessage,
  });
  openAIClientMock.setResponse(createInput(notInContext, responses.userMessage), responses.botMessage);

  const combinedText = `${user.conversationSummary} User: ${responses.userMessage} Bot: ${responses.botMessage}`;
  const summeryPrompt = getPrompt('enhanceSummary', {
    combinedText: combinedText,
  });

  openAIClientMock.setResponse(createInput(summeryPrompt, responses.userMessage), responses.summery);

  if (responses.inContext) {
    openAIClientMock.setResponse(
      createInput(getPrompt('respondToUser', {}), responses.userMessage),
      responses.botMessage,
    );
  }
};

// create message handler
const ratingSelector = mock<RatingSelector>();
const userStore: UserStore = new MemoryUserStore();
const messageHandler = new MessageHandler(userStore, ratingSelector);

// Example test using the mocked provider
describe('basic tests', () => {
  let responses: Responses;
  const userProfile: UserProfile = {
    id: 'yogev',
    is_bot: false,
    username: 'yogev',
    personalDetails: {},
    conversationSummary: '',
    messageHistory: [],
    language: Language.enUS,
    satisfactionLevel: [],
    lastTimeAskedForSatisfactionLevel: new Date(),
  };
  userStore.saveUser(userProfile);
  const userCtx: UserContext = {
    firstName: 'yogev',
    lastName: 'yogev',
    username: 'yogev',
  };
  afterEach(() => {
    userStore.clearMessageHistory('yogev');
  });
  it('Should greet the user and how ask how he is, recived : Hi', async () => {
    responses = {
      userMessage: 'Hi',
      botMessage: 'Hello! How can I help you today?',
      inContext: true,
      summery: 'The user said hi and I responded with hello how can I help you today',
    };
    setResponses(responses, userProfile);
    expect(messageHandler.handleMessage('yogev', responses.userMessage, userCtx)).resolves.toBe(responses.botMessage);
  });

  it('Should replay that the message not in context, recived : Write me a function in c ', async () => {
    responses = {
      userMessage: 'Write me a function in c',
      botMessage: 'not in context',
      inContext: false,
      summery: 'the user wanted a function in c that is not related to the converstion',
    };
    setResponses(responses, userProfile);
    expect(messageHandler.handleMessage('yogev', responses.userMessage, userCtx)).resolves.toBe(responses.botMessage);
  });
});

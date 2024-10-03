import { mock } from 'ts-jest-mocker';
import { RatingSelector } from '../src/TelegramBot/ratingSelector';
import { UserStore } from '../src/user/UserStore';
import { Language, PersonalDetails, UserProfile } from '../src/user/UserProfile';
import * as PromptsLoader from '../src/prompts/PromptsLoader';
import { getPrompt } from '../src/prompts/PromptsLoader';
import { LlmClientMock, createInput } from './LlmClientMock';
import { MemoryUserStore } from '../src/user/MemoryUserStore';
import { MessageHandler } from '../src/models/MessageHandler';
import * as LLMProvider from '../src/providers/LlmProvider';

interface Responses {
  userMessage: string;
  botMessage: string;
  inContext: boolean;
  summery: string;
  personalDetails?: PersonalDetails;
}

const LlmClient: LlmClientMock = new LlmClientMock();
jest.spyOn(LLMProvider, 'getLLMClient').mockImplementation(() => {
  console.log('getLLMClient');
  return LlmClient;
});

// Mock getPrompt with partial implementation
const originalGetPrompt = PromptsLoader.getPrompt;
jest.spyOn(PromptsLoader, 'getPrompt').mockImplementation((promptName, data) => {
  delete data.userProfile;
  delete data.randomTeacher;
  return originalGetPrompt(promptName, data);
});

const setResponses = async (responses: Responses, user: UserProfile) => {
  const combinedText = `${user.conversationSummary} User: ${responses.userMessage} Bot: ${responses.botMessage}`;
  const summeryPrompt = getPrompt('enhanceSummary', {
    combinedText: combinedText,
  });

  LlmClient.setResponse(createInput(summeryPrompt, responses.userMessage), responses.summery);

  const personalDetails = getPrompt('getDetails', {});
  LlmClient.setResponse(
    createInput(personalDetails, responses.userMessage),
    '"' + JSON.stringify(responses.personalDetails + '"'),
  );

  LlmClient.setResponse(
    createInput(getPrompt('respondToUser', {}), responses.userMessage),
    responses.botMessage,
  );
};

// Create the mocked ratingSelector and user store
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
    personalDetails: {
      firstName: 'yogev',
      lastName: 'yogev',
      age: 25,
      maritalStatus: 'single',
      location: 'Tel Aviv',
    },
    conversationSummary: '',
    language: Language.enUS,
    satisfactionLevel: [],
    lastTimeAskedForSatisfactionLevel: new Date(),
  };
  
  userStore.saveUser(userProfile);

  afterEach(() => {
    jest.clearAllMocks();
    userStore.clearMessageHistory('yogev');
  });

  it('Should greet the user and ask how he is when receiving: Hi', async () => {
    responses = {
      userMessage: 'Hi',
      botMessage: 'Hello! How can I help you today?',
      inContext: true,
      summery: 'The user said hi and I responded with hello how can I help you today',
      personalDetails: userProfile.personalDetails,
    };

    await setResponses(responses, userProfile);

    // Act & Assert
    await expect(messageHandler.handleMessage('yogev', responses.userMessage))
      .resolves.toBe(responses.botMessage);
  });
});

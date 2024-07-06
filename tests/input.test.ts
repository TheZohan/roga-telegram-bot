import { mock } from 'ts-jest-mocker';
import {
  MessageHandler,
  RespondToUserData,
} from '../src/models/MessageHandler';
import { RatingSelector } from '../src/TelegramBot/ratingSelector';
import { UserStore } from '../src/user/UserStore';
import {
  UserContext,
  UserProfile,
  StandardRoles,
} from '../src/user/UserProfile';

import { getPrompt } from '../src/prompts/PromptsLoader';
import { OpenAIMock, createInput } from './OpenAiMock';
import { UserStoreMock } from './UserStoreMock';

interface Responses {
  userMessage: string;
  botMessage: string;
  inContext: boolean;
  summery: string;
}
let responses: Responses;
let userProfile: UserProfile;
const originalUpdateMessageHistory = MessageHandler.updateMessageHistory;
const handleMessegeMock = jest
  .spyOn(MessageHandler, 'updateMessageHistory')
  .mockImplementation(
    (profile: UserProfile, role: StandardRoles, newMessage: string) => {
      console.log('mocked sucssefuly');
      originalUpdateMessageHistory(profile, role, newMessage, userStore);
      setContextResponeses(responses, userCtx);
    },
  );
const originalgetResponedToUserData = MessageHandler.getRespondToUserData;
const getRespondToUserDataMock = jest
  .spyOn(MessageHandler, 'getRespondToUserData')
  .mockImplementation((string: string): RespondToUserData => {
    console.log('get data mocked succesfully');
    const data = originalgetResponedToUserData(string);
    setResponsesToUser(responses, userCtx, data, userProfile);
    return data;
  });
export interface StringToStringObject {
  [key: string]: string;
}

const openAIClientMock: OpenAIMock = new OpenAIMock();
jest.mock('../src/providers/OpenAICLient', () => {
  return {
    OpenAIClient: jest.fn().mockImplementation(() => {
      return openAIClientMock;
    }),
  };
});

const ratingSelector = mock<RatingSelector>();

const userStore: UserStore = new UserStoreMock();

const messageHandler = new MessageHandler(userStore, ratingSelector);
const userCtx: UserContext = {
  firstName: 'yogev',
  lastName: 'yogev',
  username: 'yogev',
};
const setContextResponeses = async (
  respones: Responses,
  userCtx: UserContext,
) => {
  let user = await userStore.getUser(userCtx.username);
  console.log(user);
  user = MessageHandler.updatePersonalDetailes(userCtx, user);
  console.log(user);
  const userString = JSON.stringify(user);
  const isMessageInChatContext = getPrompt('isMessageInChatContext', {
    userProfile: userString,
  });
  console.log(isMessageInChatContext);
  openAIClientMock.setResponse(
    createInput(isMessageInChatContext, respones.userMessage),
    respones.inContext ? 'yes' : 'no',
  );

  if (!respones.inContext) {
    const notInContext = getPrompt(
      'informTheUserThatTheMessageIsNotInContext',
      { userProfile: userString, lastMessage: respones.userMessage },
    );
    openAIClientMock.setResponse(
      createInput(notInContext, respones.userMessage),
      respones.botMessage,
    );
    console.log('respose set');
  }
  const combinedText = `${userProfile.conversationSummary} User: ${responses.userMessage} Bot: ${responses.botMessage}`;
  const summeryPrompt = getPrompt('enhanceSummary', {
    combinedText: combinedText,
    userProfile: JSON.stringify(userProfile),
  });
  openAIClientMock.setResponse(
    createInput(summeryPrompt, responses.userMessage),
    responses.summery,
  );
};
const setResponsesToUser = async (
  responses: Responses,
  userCtx: UserContext,
  resToUserData: RespondToUserData,
  userProfile: UserProfile,
) => {
  const responedToUserPrompt = getPrompt('respondToUser', resToUserData);
  openAIClientMock.setResponse(
    createInput(responedToUserPrompt, responses.userMessage),
    responses.botMessage,
  );
};

// Example test using the mocked provider
describe('basic tests', () => {
  beforeEach(() => {
    userProfile = {
      id: 'yogev',
      is_bot: false,
      username: 'yogev',
      personalDetails: {},
      conversationSummary: 'yogev',
      messageHistory: [],
      language: 'en-US',
      satisfactionLevel: [],
    };
    userStore.saveUser(userProfile);
  });
  afterEach(() => {
    (userStore as UserStoreMock).removeUser('yogev');
  });
  it('basic in context input', async () => {
    responses = {
      userMessage: 'Hi',
      botMessage: 'Hi yogev how was your day ?',
      inContext: true,
      summery: 'yogev greeted me with hello, I asked how was his day.',
    };
    userStore.saveUser(userProfile);
    expect(
      messageHandler.handleMessage('yogev', responses.userMessage, userCtx),
    ).resolves.toBe(responses.botMessage);
  });
  it('not in context', async () => {
    responses = {
      userMessage: 'write me a function in c',
      botMessage: 'not in context',
      inContext: false,
      summery: 'the user wanted a function in c not related to the convo',
    };
    userStore.saveUser(userProfile);
    expect(
      messageHandler.handleMessage('yogev', responses.userMessage, userCtx),
    ).resolves.toBe(responses.botMessage);
  });
});

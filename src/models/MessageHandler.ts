import { OpenAIClient } from '../providers/OpenAIClient';
import { LLMProvider } from '../providers/LlmProvider';
import {
  UserContext,
  UserProfile,
  Message,
  StandardRoles,
  Language,
  UserData,
} from '../user/UserProfile';
import { getPrompt } from '../prompts/PromptsLoader';
import { gzipSync } from 'zlib';
import { UserStore } from '../user/UserStore';
import { v4 as uuidv4 } from 'uuid';
import { RatingSelector } from '../TelegramBot/ratingSelector';
import { createSatisfactionLevelSelector } from './SatisfactioLevelSelector';
import moment from 'moment';
import { profile } from 'console';

const MESSAGES_HISTORY_LENGTH = 20;

export interface MessageData {
  userProfile: string;
  randomTeacher: string;
  answerLength: number;
}
export class MessageHandler {
  userStore: UserStore;
  ratingSelector: RatingSelector;
  openAIClient: LLMProvider;

  constructor(userStore: UserStore, ratingSelector: RatingSelector) {
    this.userStore = userStore;
    this.ratingSelector = ratingSelector;
    this.openAIClient = new OpenAIClient();
    //this.openAIClient = new CohereApi();
  }

  greetTheUser = async (userId: string): Promise<string> => {
    const userData: UserData = await this.userStore.getUserData(userId);
    const userProfileString = this.compressMessage(JSON.stringify(userData));
    const defaultLanguage: keyof typeof Language = process.env.LANGUAGE! as keyof typeof Language;
    const language: string = Language[defaultLanguage];
    console.log('Language', language);
    const systemMessage = getPrompt('greeting', {
      langauge: language,
      userProfile: userProfileString,
    });
    const response = await this.openAIClient.sendMessage(systemMessage, '');
    this.updateMessageHistory(userData, StandardRoles.assistant, response);
    this.userStore.saveUser(userData.profile);
    return response;
  };

  handleMessage = async (
    userId: string,
    userMessage: string,
    ctx?: UserContext,
  ): Promise<string> => {
    console.log('Handling message', userMessage, 'for user', userId);
    const UserData = await this.userStore.getUserData(userId);
    UserData.profile = {
      ...UserData.profile,
      username: userId,
    };
    if (ctx) {
      UserData.profile.personalDetails = {
        firstName: ctx.firstName,
        lastName: ctx.lastName,
      };
    }
    this.updateMessageHistory(UserData, StandardRoles.user, userMessage);
    console.log('messege handler');
    // updateDetails(userProfile, ctx, userMessage, StandardRoles.user);

    // Stage 1: Check if message is in the context of spiritual journey or personal growth.
    const isMessageInContext = await this.isMessageInChatContext(
      UserData.profile,
      userMessage,
    );
    if (!isMessageInContext) {
      return this.informTheUserThatTheMessageIsNotInContext(
        UserData.profile,
        userMessage,
      );
    }
    let botReply: string;
    const nextAction = await this.decideOnNextAction(UserData.profile, userMessage);
    console.log('nextAction:', nextAction);
    switch (nextAction) {
      case '[CheckSatisfactionLevel]':
        await createSatisfactionLevelSelector(
          this,
          userMessage,
          this.userStore,
          this.ratingSelector,
        );
        UserData.profile.lastTimeAskedForSatisfactionLevel = new Date();
        this.userStore.saveUser(UserData.profile);
        botReply = '';
        break;
      default:
        botReply = await this.respondToUser(UserData.profile, userMessage);
        this.updateMessageHistory(
         UserData,
          StandardRoles.assistant,
          botReply,
        );
        this.enhanceSummary(UserData.profile, userMessage, botReply);
    }
    return botReply;
  };

  decideOnNextAction = async (
    userProfile: UserProfile,
    lastUserMessage: string,
  ): Promise<string> => {
    const userProfileString = JSON.stringify(userProfile);
    const now = new Date();
    let timeDifference = moment.duration(1000);
    if (userProfile.lastTimeAskedForSatisfactionLevel) {
      timeDifference = moment.duration(
        now.getTime() -
          new Date(userProfile.lastTimeAskedForSatisfactionLevel).getTime(),
      );
    }
    console.log('TD', timeDifference.asHours());
    const systemMessage = getPrompt('decideOnNextAction', {
      lastUserMessage,
      lastTimeAskedForSatisfactionLevel: timeDifference.asHours(),
      userProfile: userProfileString,
    });
    const botResponse: string = await this.openAIClient.sendMessage(
      systemMessage,
      '',
    );
    return botResponse;
  };

  isMessageInChatContext = async (
    userProfile: UserProfile,
    message: string,
  ): Promise<boolean> => {
    const userProfileString = JSON.stringify(userProfile);
    const systemMessage = getPrompt('isMessageInChatContext', {
      userProfile: userProfileString,
    });
    const botResponse: string = await this.openAIClient.sendMessage(
      systemMessage,
      message,
    );

    const yesRegex = /\byes\b/i; // \b ensures word boundaries, i makes it case-insensitive
    const noRegex = /\bno\b/i; // \b ensures word boundaries, i makes it case-insensitive
    let result: boolean = true;
    if (yesRegex.test(botResponse)) {
      result = true;
    } else if (noRegex.test(botResponse)) {
      result = false;
    } else {
      console.log('The bot did not return yes or no!');
    }
    console.log(result);
    console.log('isMessageInChatContext:', result);
    return result;
  };

  informTheUserThatTheMessageIsNotInContext = async (
    userProfile: UserProfile,
    message: string,
  ): Promise<string> => {
    const userProfileString = JSON.stringify(userProfile);
    const systemMessage = getPrompt(
      'informTheUserThatTheMessageIsNotInContext',
      { userProfile: userProfileString, lastMessage: message },
    );
    const botResponse: string = await this.openAIClient.sendMessage(
      systemMessage,
      message,
    );
    return botResponse;
  };

  reccomendNextAction = async (userProfile: UserProfile): Promise<string> => {
    const userProfileString = JSON.stringify(userProfile);
    const systemMessage = getPrompt('ReccomendNextAction', {
      userProfile: userProfileString,
    });
    const botResponse: string = await this.openAIClient.sendMessage(
      systemMessage,
      '',
    );
    return botResponse;
  };

  getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  respondToUser = async (
    userProfile: UserProfile,
    message: string,
  ): Promise<string> => {
    // Forward the message to OpenAI and get a response
    const userProfileString = JSON.stringify(userProfile);
    const teachers = [
      'Eckhart Tolle',
      'Thich Nhat Hanh',
      'Ram Dass',
      'Deepak Chopra',
      'Paramahansa Yogananda',
      'Jiddu Krishnamurti',
      'Mooji',
      'Osho',
      'Pema Chödrön',
      'Adyashanti',
      'Byron Katie',
      'Sadhguru',
      'Rumi',
      'Nisargadatta Maharaj',
      'Laozi',
    ];
    const randomTeacher = teachers[Math.floor(Math.random() * teachers.length)];
    const answerLength = this.getRandomNumber(200, 400);
    const systemMessage = getPrompt('respondToUser', {
      userProfile: userProfileString,
      randomTeacher: randomTeacher,
      answerLength: answerLength,
    });
    console.log(userProfile);
    console.log(await this.userStore.getUser(userProfile.id));
    return await this.openAIClient.sendMessage(
      systemMessage,
      message,
    );
  };

  enhanceSummary = async (
    profile: UserProfile,
    userMessage: string,
    botResponse: string,
  ) => {
    const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${botResponse}`;
    const systemMessage = getPrompt('enhanceSummary', {
      combinedText: combinedText,
    });
    profile.conversationSummary = await this.openAIClient.sendMessage(
      systemMessage,
      '',
    );
    this.userStore.saveUser(profile);
  };

  updateMessageHistory = (
    UserData: UserData,
    role: StandardRoles,
    newMessage: string,
  ): void => {
    const message: Message = {
      id: uuidv4(),
      userId: UserData.profile.id,
      role: role,
      timestamp: new Date(),
      message: newMessage,
    };
    UserData.messages.push(message);
    if (UserData.messages.length > MESSAGES_HISTORY_LENGTH) {
      UserData.messages.shift();
    }

    this.userStore.addMessage(message);
  };
  compressMessage = (input: string): string => {
    try {
      // Convert the input string to a buffer using UTF-8 encoding
      const buffer = Buffer.from(input, 'utf-8');
      const compressed = gzipSync(buffer);
      // Convert the compressed buffer to a base64-encoded string
      const compressedBase64 = compressed.toString('base64');
      return compressedBase64;
    } catch (error) {
      return input;
    }
  };
}

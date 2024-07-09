import { OpenAIClient } from '../providers/OpenAIClient';
import { LLMProvider } from '../providers/LlmProvider';
import {
  UserContext,
  UserProfile,
  Message,
  StandardRoles,
  Language,
} from '../user/UserProfile';
import { getPrompt } from '../prompts/PromptsLoader';
import { gzipSync } from 'zlib';
import { UserStore } from '../user/UserStore';
import { v4 as uuidv4 } from 'uuid';
import { RatingSelector } from '../TelegramBot/ratingSelector';
import {
  createSatisfactionLevelSelector,
  shouldAskForSatisfactionLevel,
} from './SatisfactioLevelSelector';
import CohereApi from '../providers/CohereApi';

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
    const userProfile: UserProfile = await this.userStore.getUser(userId);
    const userProfileString = this.compressMessage(JSON.stringify(userProfile));
    const defaultLanguage: keyof typeof Language = process.env
      .LANGUAGE! as keyof typeof Language;
    const language: string = Language[defaultLanguage];
    console.log('Language', language);
    const systemMessage = getPrompt('greeting', {
      langauge: language,
      userProfile: userProfileString,
    });
    const response = await this.openAIClient.sendMessage(systemMessage, '');
    this.updateMessageHistory(userProfile, StandardRoles.assistant, response);
    this.userStore.saveUser(userProfile);
    return response;
  };

  handleMessage = async (
    userId: string,
    userMessage: string,
    ctx?: UserContext,
  ): Promise<string> => {
    let userProfile = await this.userStore.getUser(userId);
    userProfile = {
      ...userProfile,
      username: userId,
    };
    if (ctx) {
      userProfile.personalDetails = {
        firstName: ctx.firstName,
        lastName: ctx.lastName,
      };
    }
    this.updateMessageHistory(userProfile, StandardRoles.user, userMessage);
    console.log('messege handler');
    // updateDetails(userProfile, ctx, userMessage, StandardRoles.user);

    // Stage 1: Check if message is in the context of spiritual journey or personal growth.
    const isMessageInContext = await this.isMessageInChatContext(
      userProfile,
      userMessage,
    );
    if (!isMessageInContext) {
      return this.informTheUserThatTheMessageIsNotInContext(
        userProfile,
        userMessage,
      );
    }
    let botReply: string;
    if (shouldAskForSatisfactionLevel(userProfile)) {
      await createSatisfactionLevelSelector(
        this,
        this.userStore,
        this.ratingSelector,
      );
      userProfile.lastTimeAskedForSatisfactionLevel = new Date();
      this.userStore.saveUser(userProfile);
      botReply = '';
    } else {
      botReply = await this.respondToUser(userProfile, userMessage);
      this.updateMessageHistory(userProfile, StandardRoles.assistant, botReply);
      this.enhanceSummary(userProfile, userMessage, botReply);
    }
    return botReply;
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
      userProfile.messageHistory,
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
      userProfile.messageHistory,
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
    profile: UserProfile,
    role: StandardRoles,
    newMessage: string,
  ): void => {
    const message: Message = {
      id: uuidv4(),
      userId: profile.id,
      role: role,
      timestamp: new Date(),
      message: newMessage,
    };
    profile.messageHistory.push(message);
    if (profile.messageHistory.length > MESSAGES_HISTORY_LENGTH) {
      profile.messageHistory.shift();
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

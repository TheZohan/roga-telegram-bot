import { OpenAIClient } from '../providers/OpenAIClient';
import { LLMProvider } from '../providers/LlmProvider';
import {
  UserContext,
  UserProfile,
  Message,
  StandardRoles,
  Language,
  PersonalDetails,
} from '../user/UserProfile';
import { getPrompt } from '../prompts/PromptsLoader';
import { gzipSync } from 'zlib';
import { UserStore } from '../user/UserStore';
import { v4 as uuidv4 } from 'uuid';
import { RatingSelector } from '../TelegramBot/ratingSelector';
import { createSatisfactionLevelSelector } from './SatisfactioLevelSelector';
import moment from 'moment';

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
    const defaultLanguage: keyof typeof Language = process.env.LANGUAGE! as keyof typeof Language;
    const language: string = Language[defaultLanguage];

    const askForTheirNameString =
      userProfile.personalDetails.firstName == undefined ? 'you have to ask for the users name' : '';
    console.log('Language', language);
    const systemMessage = getPrompt('greeting', {
      langauge: language,
      userProfile: userProfileString,
      askForTheirName: askForTheirNameString,
    });
    const response = await this.openAIClient.sendMessage(systemMessage, '');
    this.updateMessageHistory(userProfile, StandardRoles.assistant, response);
    this.userStore.saveUser(userProfile);
    return response;
  };

  handleMessage = async (
    userId: string,
    userMessage: string,
  ): Promise<string> => {
    console.log('Handling message', userMessage, 'for user', userId);
    let userProfile = await this.userStore.getUser(userId);
    userProfile = {
      ...userProfile,
      username: userId,
    };
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
    const nextAction = await this.decideOnNextAction(userProfile, userMessage);
    console.log('nextAction:', nextAction);
    switch (nextAction) {
      case '[CheckSatisfactionLevel]':
        await createSatisfactionLevelSelector(
          this,
          userMessage,
          this.userStore,
          this.ratingSelector,
        );
        userProfile.lastTimeAskedForSatisfactionLevel = new Date();
        this.userStore.saveUser(userProfile);
        botReply = '';
        break;
      default:
        botReply = await this.respondToUser(userProfile, userMessage);
        this.updateMessageHistory(
          userProfile,
          StandardRoles.assistant,
          botReply,
        );
        this.enhanceSummary(userProfile, userMessage, botReply);
        this.getDetailsFromMessage(userProfile, userMessage)
    }
    return botReply;
  };
  getDetailsFromMessage = async (userProfile: UserProfile, message: string) => {
    const userProfileString = JSON.stringify(userProfile);
    const getDetailsFromMessagePrompt = getPrompt('getDetails', {
      userProfile: userProfileString,
    });
    const res = await this.openAIClient.sendMessage(getDetailsFromMessagePrompt, message, []);
    res.substring(1, res.length - 1);
    console.log('res:', res);
    let personalDetails;
    try {
      userProfile.personalDetails = JSON.parse(res);
      this.userStore.saveUser(userProfile);
    } catch (error) {
      console.log("can't parse message");
    }
    console.log('res:', personalDetails);
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
      userProfile.messageHistory,
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

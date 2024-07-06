import { OpenAIClient } from '../providers/OpenAIClient';
import { LLMProvider } from '../providers/LlmProvider';
import {
  UserContext,
  UserProfile,
  PersonalDetails,
  Message,
  StandardRoles,
} from '../user/UserProfile';
import { getPrompt } from '../prompts/PromptsLoader';
import { gzipSync } from 'zlib';
import { UserStore } from '../user/UserStore';
import { v4 as uuidv4 } from 'uuid';
import { RatingSelector } from '../TelegramBot/ratingSelector';
import { createSatisfactionLevelSelector } from './SatisfactioLevelSelector';
import CohereApi from '../providers/CohereApi';

const MESSAGES_HISTORY_LENGTH = 20;
// const updateDetails = (
//   userProfile: UserProfile,
//   ctx: UserContext,
//   userMessage: string,
//   role: string,
// ) => {
//   const personalDetails: PersonalDetails = {
//     firstName: ctx.firstName,
//     lastName: ctx.lastName,
//   };
//   userProfile = {
//     ...userProfile,
//     personalDetails: personalDetails,
//     username: ctx.username,
//   };
// };
// const updateMessageHistory = (
//   profile: UserProfile,
//   role: StandardRoles,
//   newMessage: string,
//   userStore: UserStore,
// ): void => {
//   const message: Message = {
//     id: uuidv4(),
//     userId: profile.id,
//     role: role,
//     timestamp: new Date(),
//     message: newMessage,
//   };
//   profile.messageHistory.push(message);
//   if (profile.messageHistory.length > MESSAGES_HISTORY_LENGTH) {
//     profile.messageHistory.shift();
//   }
//   userStore.addMessage(message);
// };

// export { updateDetails, updateMessageHistory };
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
  handleMessage = async (
    userId: string,
    userMessage: string,
    ctx: UserContext,
  ): Promise<string> => {
    let userProfile = await this.userStore.getUser(userId);
    userProfile = MessageHandler.updatePersonalDetailes(ctx, userProfile);
    await MessageHandler.updateMessageHistory(
      userProfile,
      StandardRoles.user,
      userMessage,
      this.userStore,
    );
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

    //await createSatisfactionLevelSelector(this.userStore, this.ratingSelector);
    const botReply = await this.respondToUser(userProfile, userMessage);

    MessageHandler.updateMessageHistory(
      userProfile,
      StandardRoles.assistant,
      botReply,
      this.userStore,
    );
    this.enhanceSummary(userProfile, userMessage, botReply);
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

  static getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  respondToUser = async (
    userProfile: UserProfile,
    message: string,
  ): Promise<string> => {
    // Forward the message to OpenAI and get a response
    const userProfileString = JSON.stringify(userProfile);
    // const teachers = [
    //   'Eckhart Tolle',
    //   'Thich Nhat Hanh',
    //   'Ram Dass',
    //   'Deepak Chopra',
    //   'Paramahansa Yogananda',
    //   'Jiddu Krishnamurti',
    //   'Mooji',
    //   'Osho',
    //   'Pema Chödrön',
    //   'Adyashanti',
    //   'Byron Katie',
    //   'Sadhguru',
    //   'Rumi',
    //   'Nisargadatta Maharaj',
    //   'Laozi',
    // ];
    // const randomTeacher = teachers[Math.floor(Math.random() * teachers.length)];
    // const answerLength = this.getRandomNumber(200, 400);
    const systemMessage = getPrompt(
      'respondToUser',
      MessageHandler.getMessageData(userProfileString),
    );
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

  static updateMessageHistory = (
    profile: UserProfile,
    role: StandardRoles,
    newMessage: string,
    userStore: UserStore,
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

    userStore.addMessage(message);
  };
  static updatePersonalDetailes = (
    userCtx: UserContext,
    userProfile: UserProfile,
  ): UserProfile => {
    const personalDetails: PersonalDetails = {
      firstName: userCtx.firstName,
      lastName: userCtx.lastName,
    };
    return {
      ...userProfile,
      personalDetails: personalDetails,
      username: userCtx.username,
    };
  };
  static getMessageData = (userProfile: string): MessageData => {
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
    return {
      randomTeacher: teachers[Math.floor(Math.random() * teachers.length)],
      answerLength: MessageHandler.getRandomNumber(200, 400),
      userProfile: userProfile,
    };
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

import { OpenAIClient } from '../providers/OpenAIClient';
import { LLMProvider } from '../providers/LlmProvider';
import { UserProfile, Message, StandardRoles, Language, UserData } from '../user/UserProfile';
import { getPrompt } from '../prompts/PromptsLoader';
import { UserStore } from '../user/UserStore';
import { v4 as uuidv4 } from 'uuid';
import { RatingSelector } from '../TelegramBot/ratingSelector';
import { createSatisfactionLevelSelector } from './SatisfactioLevelSelector';
import moment from 'moment';
import logger from '../utils/logger';

const MESSAGES_HISTORY_LENGTH = 20;

type SectionContent = Record<string, unknown>;

export interface MessageData {
  userProfile: string;
  randomTeacher: string;
  answerLength: number;
}
export class MessageHandler {
  userStore: UserStore;
  ratingSelector?: RatingSelector;
  openAIClient: LLMProvider;

  constructor(userStore: UserStore, ratingSelector?: RatingSelector) {
    this.userStore = userStore;
    this.ratingSelector = ratingSelector;
    this.openAIClient = new OpenAIClient();
    //this.openAIClient = new CohereApi();
  }

  greetTheUser = async (userId: string): Promise<string> => {
    const userData: UserData = await this.userStore.getUserData(userId);
    const userProfileString = JSON.stringify(userData.profile);
    const defaultLanguage: keyof typeof Language = process.env.LANGUAGE! as keyof typeof Language;
    const language: string = Language[defaultLanguage];
    logger.debug('language', language);
    const askForTheirNameString =
      userData.profile.personalDetails.firstName == undefined ? 'you have to ask for the users name' : '';
    const systemMessage = getPrompt('greeting', {
      langauge: language,
      userProfile: userProfileString,
      askForTheirName: askForTheirNameString,
    });
    const response = await this.openAIClient.sendMessage(systemMessage, '', userData.messages);
    this.updateMessageHistory(userData, StandardRoles.assistant, response);
    this.userStore.saveUser(userData.profile);
    return response;
  };

  handleMessage = async (userId: string, userMessage: string): Promise<string> => {
    logger.debug('Handling message', userMessage, 'for user', userId);
    const userData = await this.userStore.getUserData(userId);
    userData.profile = {
      ...userData.profile,
      username: userId,
    };
    this.updateMessageHistory(userData, StandardRoles.user, userMessage);
    // Stage 1: Check if message is in the context of spiritual journey or personal growth.
    const isMessageInContext = await this.isMessageInChatContext(userData, userMessage);
    if (!isMessageInContext) {
      logger.info('The message', userMessage, 'is not in the context of the chat');
      return this.informTheUserThatTheMessageIsNotInContext(userData, userMessage);
    }
    let botReply: string;
    const nextAction = await this.decideOnNextAction(userData, userMessage);
    logger.debug('nextAction:', nextAction);
    switch (nextAction) {
      case '[CheckSatisfactionLevel]':
        await createSatisfactionLevelSelector(this, userMessage, this.userStore, this.ratingSelector!);
        userData.profile.lastTimeAskedForSatisfactionLevel = new Date();
        this.userStore.saveUser(userData.profile);
        botReply = '';
        break;
      default:
        botReply = await this.respondToUser(userData, userMessage);
        this.updateMessageHistory(userData, StandardRoles.assistant, botReply);
        this.enhanceSummary(userData.profile, userMessage, botReply);
        this.getDetailsFromMessage(userData.profile, userMessage);
    }
    return botReply;
  };
  getDetailsFromMessage = async (userProfile: UserProfile, message: string) => {
    const userProfileString = JSON.stringify(userProfile);
    const getDetailsFromMessagePrompt = getPrompt('getDetails', {
      userProfile: userProfileString,
    });
    const res = await this.openAIClient.sendMessage(getDetailsFromMessagePrompt, message, []);
    try {
      userProfile.personalDetails = this.parseMarkdownToJson(res);
      this.userStore.saveUser(userProfile);
    } catch (error) {
      console.log("can't parse message");
    }
  };

  decideOnNextAction = async (userData: UserData, lastUserMessage: string): Promise<string> => {
    const userProfile = userData.profile;
    const userProfileString = JSON.stringify(userData.profile);
    const now = new Date();
    let timeDifference = moment.duration(1000);
    if (userProfile.lastTimeAskedForSatisfactionLevel) {
      timeDifference = moment.duration(
        now.getTime() - new Date(userProfile.lastTimeAskedForSatisfactionLevel).getTime(),
      );
    }
    const systemMessage = getPrompt('decideOnNextAction', {
      lastUserMessage,
      lastTimeAskedForSatisfactionLevel: timeDifference.asHours(),
      userProfile: userProfileString,
    });
    const botResponse: string = await this.openAIClient.sendMessage(systemMessage, '', userData.messages);
    return botResponse;
  };

  isMessageInChatContext = async (userData: UserData, message: string): Promise<boolean> => {
    const userProfileString = JSON.stringify(userData.profile);
    const systemMessage = getPrompt('isMessageInChatContext', {
      userProfile: userProfileString,
    });
    const botResponse: string = await this.openAIClient.sendMessage(systemMessage, message, userData.messages);

    let result: boolean = true;
    if (botResponse == '1') {
      result = true;
    } else if (botResponse == '0') {
      result = false;
    } else {
      logger.error('The bot did not return 1 or 0!');
    }
    return result;
  };

  informTheUserThatTheMessageIsNotInContext = async (userData: UserData, message: string): Promise<string> => {
    const userProfileString = JSON.stringify(userData.profile);
    const systemMessage = getPrompt('informTheUserThatTheMessageIsNotInContext', {
      userProfile: userProfileString,
      lastMessage: message,
    });
    const botResponse: string = await this.openAIClient.sendMessage(systemMessage, message, userData.messages);
    return botResponse;
  };

  getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  respondToUser = async (userData: UserData, message: string): Promise<string> => {
    // Forward the message to OpenAI and get a response
    const userProfileString = JSON.stringify(userData.profile);
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
    return await this.openAIClient.sendMessage(systemMessage, message, userData.messages);
  };

  enhanceSummary = async (profile: UserProfile, userMessage: string, botResponse: string) => {
    const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${botResponse}`;
    const systemMessage = getPrompt('enhanceSummary', {
      combinedText: combinedText,
    });
    profile.conversationSummary = await this.openAIClient.sendMessage(systemMessage, '', []);
    this.userStore.saveUser(profile);
  };

  updateMessageHistory = (UserData: UserData, role: StandardRoles, newMessage: string): void => {
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

  parseMarkdownToJson = (mdContent: string): Record<string, SectionContent> => {
    const lines = mdContent.split('\n');
    const result: Record<string, SectionContent> = {};
    let currentSection: string | null = null;
    let currentArray: string[] | null = null;

    lines.forEach((line) => {
      line = line.trim();

      if (line.startsWith('# ')) {
        // Main section, start new JSON object
        currentSection = this.camelCase(line.slice(2).trim());
        result[currentSection] = {};
      } else if (line.startsWith('## ')) {
        // Subsection, start a new array
        const subKey = this.camelCase(line.slice(3).trim());
        currentArray = [];
        result[currentSection as string][subKey] = currentArray;
      } else if (line.startsWith('- ') && currentArray) {
        // Item in an array
        currentArray.push(line.slice(2).trim());
      } else if (line.startsWith('**') && line.includes(':')) {
        // Single attribute
        const [keyPart, value] = line.split(':').map((s) => s.trim());
        const key = this.camelCase(keyPart.replace(/\*\*/g, '')); // Remove ** from keys and convert to camelCase
        result[currentSection as string][key] = value;
      }
    });

    return result;
  };

  camelCase = (input: string): string => {
    return input.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) =>
      index === 0 ? match.toLowerCase() : match.toUpperCase().replace(/\s+/g, ''),
    );
  };
}

import { OpenAIClient } from '../providers/OpenAIClient';
import { LLMProvider } from '../providers/LlmProvider';
import { UserProfile, Message, StandardRoles, Language, UserData } from '../user/UserProfile';
import { getPrompt } from '../prompts/PromptsLoader';
import { UserStore } from '../user/UserStore';
import { v4 as uuidv4 } from 'uuid';
import { RatingSelector } from '../TelegramBot/ratingSelector';
import logger from '../utils/logger';

const MESSAGES_HISTORY_LENGTH = 20;

type SectionContent = Record<string, unknown>;

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
    try {
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
    } catch (error) {
      logger.error('Error greeting the user:', error);
      throw error;
    }
  };

  handleMessage = async (userId: string, userMessage: string): Promise<string> => {
    try {
      logger.debug('Handling message', userMessage, 'for user', userId);
      const userData = await this.userStore.getUserData(userId);
      userData.profile = {
        ...userData.profile,
        username: userId,
      };
      this.updateMessageHistory(userData, StandardRoles.user, userMessage);
      const botReply = await this.respondToUser(userData, userMessage);
      this.updateMessageHistory(userData, StandardRoles.assistant, botReply);
      this.enhanceSummary(userData.profile, userMessage, botReply);
      this.getDetailsFromMessage(userData.profile, userMessage);
      return botReply;
    } catch (error) {
      logger.error('Error handling message:', error);
      throw error; // Re-throw the error to be handled by the calling function
    }
  };

  getDetailsFromMessage = async (userProfile: UserProfile, message: string) => {
    try {
      const userProfileString = JSON.stringify(userProfile);
      const getDetailsFromMessagePrompt = getPrompt('getDetails', {
        userProfile: userProfileString,
      });
      const res = await this.openAIClient.sendMessage(getDetailsFromMessagePrompt, message, []);
      try {
        userProfile.personalDetails = this.parseMarkdownToJson(res);
        this.userStore.saveUser(userProfile);
      } catch (error) {
        logger.error("Can't parse message:", error);
        throw error; // Re-throw the error to be handled by the calling function
      }
    } catch (error) {
      logger.error("Can't parse message:", error);
      throw error; // Re-throw the error to be handled by the calling function
    }
  };

  getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  respondToUser = async (userData: UserData, message: string): Promise<string> => {
    try {
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
      const systemMessage = getPrompt('respondToUser', {
        userProfile: userProfileString,
        randomTeacher: randomTeacher,
      });
      return await this.openAIClient.sendMessage(systemMessage, message, userData.messages);
    } catch (error) {
      logger.error('Error responding to user:', error);
      throw error; // Re-throw the error to be handled by the calling function
    }
  };

  public async createScheduledMessage(userId: string): Promise<string> {
    try {
      const userData: UserData = await this.userStore.getUserData(userId);
      const userProfileString = JSON.stringify(userData.profile);

      const systemMessage = getPrompt('createScheduledMessage', {
        userProfile: userProfileString,
        currentTime: new Date().toISOString(),
      });

      const response = await this.openAIClient.sendMessage(systemMessage, '', userData.messages);
      this.updateMessageHistory(userData, StandardRoles.assistant, response);
      this.userStore.saveUser(userData.profile);

      return response;
    } catch (error) {
      logger.error('Error creating scheduled message:', error);
      throw error; // Re-throw the error to be handled by the calling function
    }
  }

  enhanceSummary = async (profile: UserProfile, userMessage: string, botResponse: string) => {
    try {
      const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${botResponse}`;
      const systemMessage = getPrompt('enhanceSummary', {
        combinedText: combinedText,
      });
      profile.conversationSummary = await this.openAIClient.sendMessage(systemMessage, '', []);
      this.userStore.saveUser(profile);
    } catch (error) {
      logger.error('Error enhancing summary:', error);
      throw error; // Re-throw the error to be handled by the calling function
    }
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

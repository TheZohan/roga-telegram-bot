import { OpenAIClient } from '../providers/OpenAIClient';
import { LLMProvider } from '../providers/LlmProvider';
import { UserProfile, Message, StandardRoles, Language, UserData } from '../user/UserProfile';
import { getPrompt } from '../prompts/PromptsLoader';
import { UserStore } from '../user/UserStore';
import { v4 as uuidv4 } from 'uuid';
import { RatingSelector } from '../TelegramBot/ratingSelector';
import logger from '../utils/logger';


const MESSAGES_HISTORY_LENGTH = 20;
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
    const botReply = await this.respondToUser(userData, userMessage);
    this.updateMessageHistory(userData, StandardRoles.assistant, botReply);
    this.processConversation(userData.profile, userMessage, botReply);
    return botReply;
  };

  processConversation = async (profile: UserProfile, userMessage: string, BotMessage: string) => {
    const personalDetailsStrinfied = JSON.stringify(profile.personalDetails);
    const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${BotMessage}`;
    const processConversationPrompt = getPrompt('processConversation', {
      personalDetails: personalDetailsStrinfied,
      combinedText: combinedText,
    });
    const res = await this.openAIClient.sendMessage(processConversationPrompt, '', []);
    let changed = false;
    try{
      const responses: Map<string, string> = this.parseMultiResponse(res);
      if (responses.has('SUMMARY') && responses.get('SUMMARY') !== '') {
        profile.conversationSummary = responses.get('SUMMARY')!;
        changed = true;
      }
      if (responses.has('PERSONAL DETAILS') && responses.get('PERSONAL DETAILS') !== '') {
        const newPersonalDetails = this.parsePersonalDeatils(responses.get('PERSONAL DETAILS')!);
        profile.personalDetails = { ...newPersonalDetails };
        changed = true;
      }
    } catch (error) {
      logger.error("Can't parse message");
    }
    if (changed) this.userStore.saveUser(profile);
    console.log('userData', profile);

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
    const systemMessage = getPrompt('respondToUser', {
      userProfile: userProfileString,
      randomTeacher: randomTeacher,
    });
    return await this.openAIClient.sendMessage(systemMessage, message, userData.messages);
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

  parsePersonalDeatils = (mdContent: string): Record<string, any> => {
    const lines = mdContent.split('\n');
    const result: Record<string, any> = {};
    let currentArray: string[] | null = null;

    lines.forEach((line) => {
      line = line.trim();

      if (line.startsWith('# ')) {
        // Main section, use the section as a prefix for keys
        currentArray = null;
      } else if (line.startsWith('## ')) {
        // Subsection, start a new array with a specific key
        const subKey = this.camelCase(line.slice(3).trim());
        currentArray = [];
        result[subKey] = currentArray;
      } else if (line.startsWith('- ') && currentArray) {
        // Item in an array
        currentArray.push(line.slice(2).trim());
      } else if (line.startsWith('**') && line.includes(':')) {
        // Single attribute
        const [keyPart, value] = line.split(':').map((s) => s.trim());
        const key = this.camelCase(keyPart.replace(/\*\*/g, '')); // Remove ** from keys and convert to camelCase
        result[key] = value;
      }
    });
    return result
  }

  camelCase = (input: string): string => {
    return input.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) =>
      index === 0 ? match.toLowerCase() : match.toUpperCase().replace(/\s+/g, ''),
    );
  }

  parseMultiResponse(input: string): Map<string, string> {
    const sectionsMap = new Map<string, string>();
    const lines = input.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Check if the line starts with '###', indicating a new section
      if (trimmedLine.startsWith('###')) {
        if (currentSection) {
          // Save the current section in uppercase and its trimmed content
          sectionsMap.set(currentSection.toUpperCase(), currentContent.join('\n').trim());
          currentContent = []; // Reset content for the next section
        }
        currentSection = trimmedLine
          .replace('###', '') 
          .replace(':', '') 
          .replace(/\*\*/g, '') 
          .trim(); 
      } else if (trimmedLine !== '') {
        // If not a new section and not an empty line, add the line to the current content
        currentContent.push(trimmedLine);
      }
    }
    // Add the last section and its content to the map
    if (currentSection) {
      sectionsMap.set(currentSection.toUpperCase(), currentContent.join('\n').trim());
    }
    return sectionsMap;
  }

}
import { UserProfile, Message, StandardRoles, Language, UserData } from '../user/UserProfile';
import { getPrompt } from '../prompts/PromptsLoader';
import { UserStore } from '../user/UserStore';
import { v4 as uuidv4 } from 'uuid';
import { RatingSelector } from '../TelegramBot/ratingSelector';
import logger from '../utils/logger';
import { LLMProvider, getLLMClient } from '../providers/LlmProvider';
import { StepManager, Step } from './StepManager'; // Add this import

const MESSAGES_HISTORY_LENGTH = 20;

type SectionContent = Record<string, unknown>;

export class MessageHandler {
  userStore: UserStore;
  ratingSelector?: RatingSelector;
  llmClient: LLMProvider;
  stepManager: StepManager;

  constructor(userStore: UserStore, ratingSelector?: RatingSelector) {
    this.userStore = userStore;
    this.ratingSelector = ratingSelector;
    this.llmClient = getLLMClient();
    this.stepManager = new StepManager();
  }

  greetTheUser = async (userId: string): Promise<string> => {
    const userData: UserData = await this.userStore.getUserData(userId);
    const userProfileString = JSON.stringify(userData.profile);
    const defaultLanguage: keyof typeof Language = process.env.LANGUAGE! as keyof typeof Language;
    const language: string = Language[defaultLanguage];
    logger.debug(`language: ${language}`);
    const systemMessage = getPrompt('greeting', {
      langauge: language,
      userProfile: userProfileString,
    });
    const response = await this.llmClient.sendMessage(systemMessage, '', userData.messages);
    this.updateMessageHistory(userData, StandardRoles.assistant, response);
    return response;
  };

  handleMessage = async (userId: string, userMessage: string): Promise<string> => {
    try {
      logger.debug(`Handling message: ${userMessage}. User: ${userId}`);
      const userData = await this.userStore.getUserData(userId);
      this.updateMessageHistory(userData, StandardRoles.user, userMessage);
      const currentStep = this.stepManager.getCurrentStep();
      logger.debug(`User: ${userId}. Current step: ${currentStep.id}`);
      const botReply = await this.executeCurrentStep(currentStep, userData, userMessage);
      this.updateMessageHistory(userData, StandardRoles.assistant, botReply);
      this.processConversation(userData.profile, userMessage, botReply);
      this.checkAndAdvanceStep(userData, userMessage, botReply, currentStep);
      return botReply;
    } catch (error) {
      logger.error(`Error handling message: ${error}`);
      throw error; // Re-throw the error to be handled by the calling function
    }
  };

  processConversation = async (profile: UserProfile, userMessage: string, BotMessage: string) => {
    logger.debug(`processConversation. User profile before processing: ${profile}`);
    let currentKey: string = '';
    try {
      const personalDetailsStrinfied = JSON.stringify(profile.personalDetails);
      const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${BotMessage}\n`;
      const processConversationPrompt = getPrompt('processConversation', {
        personalDetails: personalDetailsStrinfied,
        combinedText: combinedText,
        date: new Date().toISOString(),
      });
      const res = await this.llmClient.sendMessage(processConversationPrompt, '', []);
      const responses: Map<string, string> = this.parseMultiResponse(res);
      if (responses.has('SUMMARY') && responses.get('SUMMARY') !== '') {
        currentKey = 'SUMMARY';
        profile.conversationSummary = responses.get('SUMMARY')!;
      }
      if (responses.has('PERSONAL DETAILS') && responses.get('PERSONAL DETAILS') !== '') {
        currentKey = 'PERSONAL DETAILS';
        const newPersonalDetails = this.parsePersonalDeatils(responses.get('PERSONAL DETAILS')!);
        profile.personalDetails = { ...newPersonalDetails };
      }
      currentKey = 'COMPLETED';
    } catch (error) {
      logger.error(`Can't parse ${currentKey} from the response`);
    }
    if (currentKey == 'COMPLETED') {
      this.userStore.saveUser(profile);
      logger.info(`proccessing conversation completed Successfully. Profile: ${profile}`);
    }
  };

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
    return await this.llmClient.sendMessage(systemMessage, message, userData.messages);
  };

  executeCurrentStep = async (step: Step, userData: UserData, message: string): Promise<string> => {
    const userProfileString = JSON.stringify(userData.profile);
    const systemMessage = getPrompt(step.promptName, {
      userProfile: userProfileString,
      stepDescription: step.description,
    });
    return await this.llmClient.sendMessage(systemMessage, message, userData.messages);
  };

  public async createScheduledMessage(userId: string): Promise<string> {
    try {
      const userData: UserData = await this.userStore.getUserData(userId);
      const userProfileString = JSON.stringify(userData.profile);

      const systemMessage = getPrompt('createScheduledMessage', {
        userProfile: userProfileString,
        currentTime: new Date().toISOString(),
      });

      const response = await this.llmClient.sendMessage(systemMessage, '', userData.messages);
      this.updateMessageHistory(userData, StandardRoles.assistant, response);
      this.userStore.saveUser(userData.profile);

      return response;
    } catch (error) {
      logger.error('Error creating scheduled message:', error);
      throw error; // Re-throw the error to be handled by the calling function
    }
  }

  updateMessageHistory = (userData: UserData, role: StandardRoles, newMessage: string): void => {
    const message: Message = {
      id: uuidv4(),
      userId: userData.profile.id,
      role: role,
      timestamp: new Date(),
      message: newMessage,
    };
    userData.messages.push(message);
    if (userData.messages.length > MESSAGES_HISTORY_LENGTH) {
      userData.messages.shift();
    }

    this.userStore.addMessage(message);
    this.userStore.saveUser(userData.profile);
  };

  parsePersonalDeatils = (mdContent: string): Record<string, SectionContent> => {
    logger.debug('Started parsing personal details');
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
        // Subsection, start a new array with a specific key
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
    logger.debug('Finished parsing personal details. result: ', result);

    return result;
  };

  camelCase = (input: string): string => {
    return input.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) =>
      index === 0 ? match.toLowerCase() : match.toUpperCase().replace(/\s+/g, ''),
    );
  };

  parseMultiResponse(input: string): Map<string, string> {
    logger.debug(`Started Parsing multi response: ${input}`);
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
        currentSection = trimmedLine.replace('###', '').replace(':', '').replace(/\*\*/g, '').trim();
      } else if (trimmedLine !== '') {
        // If not a new section and not an empty line, add the line to the current content
        currentContent.push(trimmedLine);
      }
    }
    // Add the last section and its content to the map
    if (currentSection) {
      sectionsMap.set(currentSection.toUpperCase(), currentContent.join('\n').trim());
    }
    logger.debug('sections :');
    if (sectionsMap.size > 0 && logger.level == 'debug') {
      for (const [key, value] of sectionsMap) {
        logger.debug(key + ' : ' + value);
      }
    }
    logger.debug('finished Parsing multi response');
    return sectionsMap;
  }

  private checkAndAdvanceStep = async (
    userData: UserData,
    userMessage: string,
    botReply: string,
    currentStep: Step,
  ): Promise<void> => {
    const isFinished = await this.isStepFinished(userData, userMessage, botReply, currentStep);
    if (isFinished) {
      this.stepManager.advanceStep();
    }
  };

  isStepFinished = async (userData: UserData, userMessage: string, botReply: string, step: Step): Promise<boolean> => {
    const finishCriteriaPrompt = getPrompt('evaluateStepFinish', {
      stepFinishCriteria: step.finishCriteria,
      userMessage: userMessage,
      botReply: botReply,
    });
    const evaluation = await this.llmClient.sendMessage(finishCriteriaPrompt, '', []);
    return evaluation.trim() === '1';
  };
}

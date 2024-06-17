import { OpenAIClient } from '../providers/OpenAIClient';
import { LLMProvider } from '../providers/LlmProvider';
import { UserContext, UserProfile, PersonalDetails } from '../user/UserProfile';
import UsersStore from '../user/UsersStore';
import { getPrompt } from '../prompts/PromptsLoader';

const MESSAGES_HISTORY_LENGTH = 20;

export class MessageHandler {
  usersStore: UsersStore;
  openAIClient: LLMProvider;

  constructor(usersStors: UsersStore) {
    this.usersStore = usersStors;
    this.openAIClient = new OpenAIClient();
  }

  handleMessage = async (
    userId: number,
    userMessage: string,
    ctx: UserContext,
  ): Promise<string> => {
    let userProfile = this.usersStore.get(userId);
    this.updateMessageHistory(userProfile, `User: ${userMessage}`);
    const personalDetails: PersonalDetails = {
      firstName: ctx.firstName,
      lastName: ctx.lastName,
    };
    userProfile = {
      ...userProfile,
      personalDetails: personalDetails,
      username: ctx.username,
    };

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
    // Stage 2: Decide whether more information about the user is required
    const nextAction = await this.reccomendNextAction(userProfile);
    console.log('recoomended next action: ', nextAction);
    const botReply = await this.respondToUser(userProfile, userMessage);

    this.updateMessageHistory(userProfile, `Bot: ${botReply}`);
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

  reccomendNextAction = async (
    userProfile: UserProfile
  ): Promise<string> => {
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

  shouldRequestForMoreDetails = async (
    userProfile: UserProfile,
  ): Promise<boolean> => {
    const userProfileString = JSON.stringify(userProfile);
    const systemMessage = getPrompt('shouldRequestForMoreDetails', {
      userProfile: userProfileString,
    });
    const botResponse: string = await this.openAIClient.sendMessage(
      systemMessage,
      '',
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

    console.log('shouldRequestForMoreDetails:', result);
    return result;
  };

  askTheUser = async (
    userProfile: UserProfile,
    message: string,
  ): Promise<string> => {
    // Forward the message to OpenAI and get a response
    const userProfileString = JSON.stringify(userProfile);
    const systemMessage = getPrompt('askTheUser', {
      userProfile: userProfileString,
    });
    return await this.openAIClient.sendMessage(systemMessage, message);
  };

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
    const answerLength = 200;
    const systemMessage = getPrompt('respondToUser', {
      userProfile: userProfileString,
      randomTeacher: randomTeacher,
      answerLength: answerLength,
    });
    return await this.openAIClient.sendMessage(systemMessage, message);
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
    this.usersStore.update(profile);
  };

  updateMessageHistory = (profile: UserProfile, newMessage: string): void => {
    profile.messageHistory.push(newMessage);

    // Keep only the last 10 messages
    if (profile.messageHistory.length > MESSAGES_HISTORY_LENGTH) {
      profile.messageHistory.shift();
    }
  };
}

import { OpenAIClient } from "../providers/OpenAIClient";
import { LLMProvider } from "../providers/LlmProvider";
import { UserContext, UserProfile, PersonalDetails } from "../user/UserProfile";
import UsersStore from "../user/UsersStore";
import { getPrompt } from "../prompts/PromptsLoader";

const MESSAGES_HISTORY_LENGTH = 20;

export class MessageAnalyzer {
  usersStore: UsersStore;
  openAIClient: LLMProvider;

  constructor(usersStors: UsersStore) {
    this.usersStore = usersStors;
    this.openAIClient = new OpenAIClient();
  }

  handleMessage = async (
    userId: number,
    userMessage: string,
    ctx: UserContext
  ): Promise<string> => {
    let userProfile = this.usersStore.get(userId);
    this.updateMessageHistory(userProfile, `User: ${userMessage}`);
    // is it neccessary ?
    const personalDetails: PersonalDetails = {
      firstName: ctx.firstName,
      lastName: ctx.lastName,
    };
    // Update the user profile with the new personal details
    userProfile = {
      ...userProfile,
      personalDetails: personalDetails,
      username: ctx.username,
    };

    // Stage 1: Check if message is in the context of spiritual journey or personal growth.
    const isMessageInContext = await this.isMessageInChatContext(
      userProfile,
      userMessage
    );
    if (!isMessageInContext) {
      return "Thank you for sharing! While that is interesting, I'd love to assist you with topics related to spirituality or personal growth. How can I help you on your spiritual journey today?";
    }
    // Stage 2: Decide whether more information about the user is required
    const shouldRequestForPersonalDetails =
      await this.shouldRequestForMoreDetails(userProfile);
    let botReply = "";
    if (shouldRequestForPersonalDetails) {
      botReply = await this.askTheUser(userProfile, userMessage);
    } else {
      botReply = await this.respondToUser(userProfile, userMessage);
    }
    this.updateMessageHistory(userProfile, `Bot: ${botReply}`);
    // Stage 3: Enhance the conversation summary with the latest messages
    this.enhanceSummary(userProfile, userMessage, botReply);
    return botReply;
  };

  isMessageInChatContext = async (
    userProfile: UserProfile,
    message: string
  ): Promise<Boolean> => {
    const userProfileString = JSON.stringify(userProfile);
    const systemMessage = getPrompt("isMessageInChatContext", {
      userProfile: userProfileString,
    });
    const botResponse: string = await this.openAIClient.sendMessage(
      systemMessage,
      message
    );

    const yesRegex = /\byes\b/i; // \b ensures word boundaries, i makes it case-insensitive
    const noRegex = /\bno\b/i; // \b ensures word boundaries, i makes it case-insensitive
    let result: boolean = true;
    if (yesRegex.test(botResponse)) {
      result = true;
    } else if (noRegex.test(botResponse)) {
      result = false;
    } else {
      console.log("The bot did not return yes or no!");
    }

    console.log("isMessageInChatContext:", result);
    return result;
  };

  shouldRequestForMoreDetails = async (
    userProfile: UserProfile
  ): Promise<boolean> => {
    const userProfileString = JSON.stringify(userProfile);
    const systemMessage = getPrompt("shouldRequestForMoreDetails", {
      userProfile: userProfileString,
    });
    const botResponse: string = await this.openAIClient.sendMessage(
      systemMessage,
      ""
    );

    const yesRegex = /\byes\b/i; // \b ensures word boundaries, i makes it case-insensitive
    const noRegex = /\bno\b/i; // \b ensures word boundaries, i makes it case-insensitive
    let result: boolean = true;
    if (yesRegex.test(botResponse)) {
      result = true;
    } else if (noRegex.test(botResponse)) {
      result = false;
    } else {
      console.log("The bot did not return yes or no!");
    }

    console.log("shouldRequestForMoreDetails:", result);
    return result;
  };

  askTheUser = async (
    userProfile: UserProfile,
    message: string
  ): Promise<string> => {
    // Forward the message to OpenAI and get a response
    const userProfileString = JSON.stringify(userProfile);
    const systemMessage = getPrompt("askTheUser", {
      userProfile: userProfileString,
    });
    return await this.openAIClient.sendMessage(systemMessage, message);
  };

  respondToUser = async (
    userProfile: UserProfile,
    message: string
  ): Promise<string> => {
    // Forward the message to OpenAI and get a response
    const userProfileString = JSON.stringify(userProfile);
    const teachers = [
      "Eckhart Tolle",
      "Thich Nhat Hanh",
      "Ram Dass",
      "Deepak Chopra",
      "Paramahansa Yogananda",
      "Jiddu Krishnamurti",
      "Mooji",
      "Osho",
      "Pema Chödrön",
      "Adyashanti",
      "Byron Katie",
      "Sadhguru",
      "Rumi",
      "Nisargadatta Maharaj",
      "Laozi",
    ];
    const randomTeacher = teachers[Math.floor(Math.random() * teachers.length)];
    const answerLength = 200;
    const systemMessage = getPrompt("respondToUser", {
      userProfile: userProfileString,
      randomTeacher: randomTeacher,
      answerLength: answerLength,
    });
    return await this.openAIClient.sendMessage(systemMessage, message);
  };

  enhanceSummary = async (
    profile: UserProfile,
    userMessage: string,
    botResponse: string
  ) => {
    const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${botResponse}`;
    const systemMessage = getPrompt("enhanceSummary", {
      combinedText: combinedText,
    });
    profile.conversationSummary = await this.openAIClient.sendMessage(
      systemMessage,
      ""
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

import { OpenAIClient } from "../providers/OpenAIClient";
import { LLMProvider } from "../providers/LlmProvider";
import { UserContext, UserProfile, PersonalDetails } from "../user/UserProfile";
import UsersStore from "../user/UsersStore";

const MESSAGES_HISTORY_LENGTH = 20;

export class MessageAnalyzer {
    usersStore: UsersStore;
    openAIClient: LLMProvider;

    constructor(usersStors: UsersStore) {
        this.usersStore = usersStors;
        this.openAIClient = new OpenAIClient();
    }

    handleMessage = async(userId: number, userMessage: string, ctx: UserContext) : Promise<string> => {
        let userProfile = this.usersStore.get(userId);
        this.updateMessageHistory(userProfile, `User: ${userMessage}`);
        const personalDetails: PersonalDetails = {
            firstName: ctx.firstName,
            lastName: ctx.lastName
        }
        userProfile = {
            ...userProfile,
            personalDetails: personalDetails,
            username: ctx.username
        };
        
        // Stage 1: Check if message is in the context of spiritual journey or personal growth.
        const isMessageInContext = await this.isMessageInChatContext(userMessage);
        if (!isMessageInContext) {
            return "Thank you for sharing! While that is interesting, I'd love to assist you with topics related to spirituality or personal growth. How can I help you on your spiritual journey today?";
        }
        // Stage 2: Decide whether more information about the user is required
        const shouldRequestForPersonalDetails = await this.shouldRequestForMoreDetails(userProfile)
        let botReply = "";
        if (shouldRequestForPersonalDetails) {
            botReply = await this.askTheUser(userProfile, userMessage);
        } else {
            botReply = await this.respondToUser(userProfile, userMessage);
        }
        this.updateMessageHistory(userProfile, `Bot: ${botReply}`);
        this.enhanceSummary(userProfile, userMessage, botReply);
        return botReply;
    }

    isMessageInChatContext = async (userMessage: string) : Promise<Boolean> => {
        const systemMessage = `Check if the user message is relevant to the conversation and reply with yes/no.
        1. Relevant: The user is sharing their current mood, feelings, condition, life experience, or anything about themselves or their life.
        2. Irrelevant: The user is asking about coding, math problems, or other technical topics not related to personal sharing.`;
        const botResponse: string = await this.openAIClient.sendMessage(systemMessage, userMessage);

        const yesRegex = /\byes\b/i; // \b ensures word boundaries, i makes it case-insensitive
        const noRegex = /\bno\b/i;   // \b ensures word boundaries, i makes it case-insensitive
        let response = true;
        if (yesRegex.test(botResponse)) {
            response = true;
        } else if (noRegex.test(botResponse)) {
            response = false;
        } else {
            console.log("The bot did not return yes or no!");
        }

        console.log("isMessageInChatContext:", response);
        return response;
    }

    
    shouldRequestForMoreDetails = async(userProfile: UserProfile): Promise<boolean> => {
        const userProfileString = JSON.stringify(userProfile);
        const systemMessage = `Check if the user profile has enough information about the user. reply with yes/no.
        Does the user profile contain the following information? שge, location, personal goal or issues he wants to solve
        UserProfile: ${userProfileString}`;
        const botResponse: string = await this.openAIClient.sendMessage(systemMessage, "");

        const yesRegex = /\byes\b/i; // \b ensures word boundaries, i makes it case-insensitive
        const noRegex = /\bno\b/i;   // \b ensures word boundaries, i makes it case-insensitive
        let response = true;
        if (yesRegex.test(botResponse)) {
            response = true;
        } else if (noRegex.test(botResponse)) {
            response = false;
        } else {
            console.log("The bot did not return yes or no!");
        }

        console.log("isMessageInChatContext:", response);
        return response;
    }

    askTheUser = async (userProfile: UserProfile, message: string): Promise<string> => {
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
            "Laozi"
        ];
        const randomTeacher = teachers[Math.floor(Math.random() * teachers.length)];        
        const initialContext = `You are a spiritual mentor bot, trained to guide users without using repetitive greetings or questions.
        You can imagine you are ${randomTeacher} and answer based on their teachings and style. 
        Engage deeply, helping users understand their goals and challenges. 
        Your purpose is to promote introspection and provide tools for self-investigation.`;
        const guidance = `Ask a question that will assist in filling the user profile or promote introspection.`;

        const systemMessage = `${initialContext}
        ${guidance}
        The user profile is: ${userProfileString}.`;
        return await this.openAIClient.sendMessage(systemMessage, message);
    }

    respondToUser = async (userProfile: UserProfile, message: string): Promise<string> => {
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
            "Laozi"
        ];
        const randomTeacher = teachers[Math.floor(Math.random() * teachers.length)];        
        const initialContext = `You are a spiritual mentor bot, trained to guide users without using repetitive greetings or questions.
        You can imagine you are ${randomTeacher} and answer based on their teachings and style. 
        Engage deeply, helping users understand their goals and challenges. 
        Your purpose is to promote introspection and provide tools for self-investigation.`;
        const guidance = `Remember to ask open-ended questions and promote introspection. 
        Encourage the user to reflect deeply on their feelings, experiences, and beliefs.
        If there are no details about the user's name (or how he would like to be called), age, gender, location, family status or any detail that might be relevant to 
        the process ask the user for these details.
        Please limit the conversation to topics related to spiritual practices, mindfulness, meditation, daily reflections, spiritual teachings, personal growth, and community engagement. Avoid discussing technical details, coding, or unrelated topics. Focus on providing guidance, inspiration, and support within these areas.
        Limit the answer to 800 characters. Don't sign your name at the end`;

        const systemMessage = `${initialContext}
        ${guidance}
        The user profile is: ${userProfileString}.`;
        return await this.openAIClient.sendMessage(systemMessage, message);
    }

    enhanceSummary = async (profile: UserProfile, userMessage: string, botResponse: string) => {
        const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${botResponse}`;
        const systemMessage = `Summarize the following text: "${combinedText}"`;
        profile.conversationSummary = await this.openAIClient.sendMessage(systemMessage, "");
        this.usersStore.update(profile);
    }

    updateMessageHistory = (profile: UserProfile, newMessage: string): void => {
        profile.messageHistory.push(newMessage);
    
        // Keep only the last 10 messages
        if (profile.messageHistory.length > MESSAGES_HISTORY_LENGTH) {
            profile.messageHistory.shift();
        }
    }

    executeBotAction = async (action: string, userProfile: UserProfile, userMessage: string): Promise<string> => {
        let response: string = "I am not sure what to do";
        switch (action) {
            case 'requestPersonalDetails':
                console.log("Got action:", action);
                break;
            case 'savePersonalDetails':
                console.log("Got action:", action);
                break;
            case 'respondToUser':
                response = await this.respondToUser(userProfile, userMessage);
                break;
        }

        return response;
    }
}

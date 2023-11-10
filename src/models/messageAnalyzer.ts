import { json } from "stream/consumers";
import { getOpenAISystemMessageResponse, getOpenAIResponse } from "../providers/OpenAIClient";
import { UserContext, UserProfile } from "../user/UserProfile";
import UsersStore from "../user/UsersStore";

const MESSAGES_HISTORY_LENGTH = 20;

export class MessageAnalyzer {
    usersStore: UsersStore;

    constructor() {
        this.usersStore = new UsersStore();
    }

    handleMessage = async(userId: number, userMessage: string, ctx: UserContext) : Promise<string> => {
        let userProfile = this.usersStore.get(userId);
        this.updateMessageHistory(userProfile, `User: ${userMessage}`);
        userProfile = {
        ...userProfile,
        firstName: ctx.firstName,
        lastName: ctx.lastName,
        username: ctx.username
        };
        console.log("UserProfile 1: ", userProfile);
        const botReply = await this.analyzeMessage(userProfile, userMessage);
        this.updateMessageHistory(userProfile, `Bot: ${botReply}`);
        userProfile.conversationSummary = await this.enhanceSummary(userProfile, userMessage, botReply);
        console.log("UserProfile 2: ", userProfile);
        this.usersStore.update(userProfile);
        return botReply;
    }

    enhanceSummary = async (profile: UserProfile, userMessage: string, botResponse: string): Promise<string> => {
        const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${botResponse}`;
    const systemMessage = `Summarize the following text: "${combinedText}"`;
    return await getOpenAIResponse(systemMessage, "system");
    }

    updateMessageHistory = (profile: UserProfile, newMessage: string): void => {
        profile.messageHistory.push(newMessage);
    
        // Keep only the last 10 messages
        if (profile.messageHistory.length > MESSAGES_HISTORY_LENGTH) {
            profile.messageHistory.shift();
        }
    }

    analyzeMessage = async (userProfile: UserProfile, message: string): Promise<string> => {
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
        the process ask the user for these details.`

        const systemMessage = `${initialContext}
        ${guidance}
        The user profile is: ${userProfileString}.`;
        return await getOpenAISystemMessageResponse(systemMessage, message);
        
    }
}

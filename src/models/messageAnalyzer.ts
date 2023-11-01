import { json } from "stream/consumers";
import { getOpenAIResponse, getOpenAIResponse1 } from "../providers/OpenAIClient";
import { UserProfile } from "../user/UserProfile";

export class MessageAnalyzer {
    constructor() {}

    enhanceSummary = async (profile: UserProfile, userMessage: string, botResponse: string): Promise<string> => {
        const combinedText = `${profile.conversationSummary} User: ${userMessage} Bot: ${botResponse}`;
    const systemMessage = `Summarize the following text: "${combinedText}"`;
    return await getOpenAIResponse1(systemMessage, "system");
    }

    analyzeMessage = async (userProfile: UserProfile, message: string): Promise<string> => {
        userProfile.lastMessage = message;
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
        Encourage the user to reflect deeply on their feelings, experiences, and beliefs.`

        const systemMessage = `${initialContext}
        ${guidance}
        The user profile is: ${userProfileString}.`;
        return await getOpenAIResponse(systemMessage, message);
        
    }
}

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
        const initialContext = `You are a spiritual mentor bot, trained to guide users in understanding their goals and challenges. 
        Your purpose is to engage in deep conversations, helping users find root causes that might be hindering their progress 
        and enlightening their consciousness for a broader perception of reality.`
        const guidance = `Remember to ask open-ended questions and promote introspection. 
        Encourage the user to reflect deeply on their feelings, experiences, and beliefs.`

        const systemMessage = `${initialContext}
        ${guidance}
        The user profile is: ${userProfileString}.`;
        return await getOpenAIResponse(systemMessage, message);
        
    }
}

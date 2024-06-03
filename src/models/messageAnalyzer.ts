import { json } from "stream/consumers";
import { getOpenAISystemMessageResponse, getOpenAIResponse } from "../providers/OpenAIClient";
import { UserContext, UserProfile, PersonalDetails } from "../user/UserProfile";
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
        const personalDetails: PersonalDetails = {
            firstName: ctx.firstName,
            lastName: ctx.lastName
        }
        userProfile = {
            ...userProfile,
            personalDetails: personalDetails,
            username: ctx.username
        };
        console.log("UserProfile 1: ", userProfile);
        const action: string = await this.decideOnNextAction(userProfile, userMessage);
        console.log("Action: ", action);
        const botReply = await this.executeBotAction("respondToUser", userProfile, userMessage);
        //const botReply = await this.respondToUser(userProfile, userMessage);
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

    decideOnNextAction = async(userProfile: UserProfile, userMessage: string): Promise<string> => {
        const userProfileString = JSON.stringify(userProfile);
        const systemMessage = 
        // `Please assist in choosing the next action for the bot. The choice will execute the next action, 
        //     you don't need to execute it yourself. 
        //     Available actions are: 
        //     - requestForPersonalDetails: Ask the user for their personal details. 
        //         Choose this action if the user profile is missing details: age, gender, marital status or any 
        //         other detail that can assist in the conversation.
        //     - savePersonalDetails: Save the personal details the user provided. 
        //         Choose this action if the user provided any personal details about themselves. 
        //         function input is the type of user personal detail and the data itself.
        //     - respondToUser: Respond directly to the user's query (not need for the actual response).
            `Additional details:
            UserProfile: "${userProfileString}". 
            Last User message: "${userMessage}"`;
        const response: string = await getOpenAIResponse(systemMessage, "system");
        //const action: BotAction = JSON.parse(response) as BotAction;
        return response;
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
        Please limit the conversation to topics related to spiritual practices, mindfulness, meditation, daily reflections, spiritual teachings, personal growth, and community engagement. Avoid discussing technical details, coding, or unrelated topics. Focus on providing guidance, inspiration, and support within these areas.`

        const systemMessage = `${initialContext}
        ${guidance}
        The user profile is: ${userProfileString}.`;
        return await getOpenAISystemMessageResponse(systemMessage, message);
        
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

export interface UserProfile {
    id: number;
    is_bot?: boolean;
    firstName?: string;
    lastName?: string;
    username?: string;
    conversationSummary?: string;
    messageHistory: string[];
}


export interface UserContext {
    firstName: string,
    lastName: string,
    username: string
}
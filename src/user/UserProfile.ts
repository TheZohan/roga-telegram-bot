export interface UserProfile {
    id: number;
    is_bot?: boolean;
    firstName?: string;
    lastName?: string;
    username?: string;
    conversationSummary: string;
    lastMessage?: string;
}
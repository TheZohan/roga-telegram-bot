export interface UserProfile {
    id: number;
    is_bot?: boolean;
    username?: string;
    personalDetails: PersonalDetails;
    conversationSummary?: string;
    messageHistory: string[];
}


export interface UserContext {
    firstName: string,
    lastName: string,
    username: string
}

export interface PersonalDetails {
    firstName?: string;
    lastName?: string;
    age?: number;
    gender?: string;
    maritalStatus?: string;
    location?: string;
}
export interface UserProfile {
  id: string;
  is_bot?: boolean;
  username?: string;
  personalDetails: PersonalDetails;
  conversationSummary?: string;
  messageHistory: string[];
  language: 'en-US' | 'heb';
  satisfactionLevel: Rating[];
}

export interface Rating {
  timestamp: Date;
  rating: number;
}

export interface UserContext {
  firstName: string;
  lastName: string;
  username: string;
}

export interface PersonalDetails {
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: string;
  maritalStatus?: string;
  location?: string;
}

export interface Message {
  id: string;
  userId: string;
  role: 'user' | 'bot';
  timestamp: Date;
  content: string;
}

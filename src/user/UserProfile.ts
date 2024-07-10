export interface UserProfile {
  id: string;
  is_bot?: boolean;
  username?: string;
  personalDetails: PersonalDetails;
  conversationSummary?: string;
  messageHistory: Message[];
  language: Language;
  satisfactionLevel: Rating[];
  lastTimeAskedForSatisfactionLevel?: Date;
}

export enum Language {
  heb = 'Hebrew',
  enUS = 'English',
}

export enum FriendlySatisfactionLevel {
  Awful = 'Awful',
  Bad = 'Bad',
  Meh = 'Meh',
  Good = 'Good',
  Great = 'Great',
}

export enum FriendlySatisfactionLevelTranslationKeys {
  Awful = 'FriendlySatisfactionLevel.Awful',
  Bad = 'FriendlySatisfactionLevel.Bad',
  Meh = 'FriendlySatisfactionLevel.Meh',
  Good = 'FriendlySatisfactionLevel.Good',
  Great = 'FriendlySatisfactionLevel.Great',
}

export interface Rating {
  timestamp: Date;
  level: number;
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
  role: StandardRoles;
  timestamp: Date;
  message: string;
}

export enum StandardRoles {
  system = 'SYSTEM',
  user = 'USER',
  assistant = 'CHATBOT',
  tool = 'TOOL',
}

import logger from '../utils/logger';
import { Language, Message, UserData, UserProfile } from './UserProfile';
import { UserStore } from './UserStore';

export class MemoryUserStore implements UserStore {
  private store: Map<string, UserProfile> = new Map();
  private conversationHistory: Map<string, Message[]> = new Map();
  private users: Map<string, UserProfile> = new Map();

  async saveUser(user: UserProfile): Promise<void> {
    this.store.set(user.id, user);
  }

  async getUserData(userId: string): Promise<UserData> {
    const userProfile = await this.getUser(userId);
    const messages = await this.getMessageHistory(userId);
    return { profile: userProfile, messages: messages };
  }

  async getUser(userId: string): Promise<UserProfile> {
    return (
      this.store.get(userId) ||
      ({
        id: userId,
        satisfactionLevel: [],
        personalDetails: {},
        language: Language.heb,
        currentStep: 'greeting',
      } as UserProfile)
    );
  }

  async addMessage(message: Message): Promise<void> {
    const conversation = this.conversationHistory.get(message.userId) || [];
    conversation?.push(message);
    this.conversationHistory.set(message.userId, conversation);
  }

  async getMessageHistory(userId: string): Promise<Message[]> {
    return this.conversationHistory.get(userId) || [];
  }

  async clearMessageHistory(userId: string): Promise<void> {
    const userProfile = await this.getUser(userId);
    userProfile.conversationSummary = '';
    this.saveUser(userProfile);
    this.conversationHistory.set(userId, []);
  }

  async getActiveUsers(): Promise<UserProfile[]> {
    return Array.from(this.users.values());
  }

  getBackups(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  restoreFromBackup(backupKey: string): Promise<void> {
    logger.debug(backupKey);
    throw new Error('Method not implemented.');
  }

  disconnect(): void {
    return;
  }
}

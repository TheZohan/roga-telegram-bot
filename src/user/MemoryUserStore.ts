import { Message, UserProfile } from './UserProfile';
import { UserStore } from './UserStore';

export class MemoryUserStore implements UserStore {
  private store: Map<string, UserProfile> = new Map();
  private conversationHistory: Map<string, Message[]> = new Map();

  async saveUser(user: UserProfile): Promise<void> {
    this.store.set(user.id, user);
  }

  async getUser(userId: string): Promise<UserProfile> {
    return (
      this.store.get(userId) ||
      ({
        id: userId,
        messageHistory: [],
        satisfactionLevel: [],
        personalDetails: {},
        language: 'en-US',
      } as UserProfile)
    );
  }

  async addMessage(message: Message): Promise<void> {
    const conversation = this.conversationHistory.get(message.userId)!;
    conversation?.push(message);
    this.conversationHistory.set(message.userId, conversation);
  }
  async getMessageHistory(userId: string): Promise<Message[]> {
    return this.conversationHistory.get(userId)!;
  }

  async clearMessageHistory(userId: string): Promise<void> {
    const userProfile = await this.getUser(userId);
    userProfile.conversationSummary = '';
    userProfile.messageHistory = [];
    this.saveUser(userProfile);
    this.conversationHistory.set(userId, []);
  }

  getBackups(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  restoreFromBackup(backupKey: string): Promise<void> {
    console.log(backupKey);
    throw new Error('Method not implemented.');
  }

  disconnect(): void {
    return;
  }
}

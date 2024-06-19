import { UserProfile } from './UserProfile';
import { UserStore } from './UserStore';

export class MemoryUserStore implements UserStore {
  private store: Map<string, UserProfile> = new Map();

  async saveUser(user: UserProfile): Promise<void> {
    this.store.set(user.id, user);
  }

  async getUser(id: string): Promise<UserProfile> {
    return this.store.get(id) || ({
      id: id,
      messageHistory: [],
      personalDetails: {},
      language: 'en-US',
    } as UserProfile);
  }

  disconnect(): void {
      return;
  }
}
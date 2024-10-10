import { createClient, RedisClientType } from 'redis';
import { UserStore } from './UserStore';
import { Language, Message, UserData, UserProfile } from './UserProfile';
import logger from '../utils/logger';

const MAX_HISTORY = 10; // Default max history

export class RedisUserStore implements UserStore {
  private client: RedisClientType;

  constructor(private redisUrl: string) {
    this.client = createClient({
      url: this.redisUrl,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', err);
      throw new Error("Couldn't connect to Redis");
    });
  }
  async getUserData(userId: string): Promise<UserData> {
    const userProfile = await this.getUser(userId);
    const messages = await this.getMessageHistory(userId);
    return { profile: userProfile, messages: messages };
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async saveUser(user: UserProfile): Promise<void> {
    await this.client.set(`user:${user.id}`, JSON.stringify(user));
  }

  async getUser(userId: string): Promise<UserProfile> {
    const data = await this.client.get(`user:${userId}`);
    return data
      ? JSON.parse(data)
      : ({
          id: userId,
          satisfactionLevel: [],
          personalDetails: {},
          language: Language.heb,
          currentStep: 'greeting',
        } as UserProfile);
  }

  async addMessage(message: Message): Promise<void> {
    await this.client.rPush(`messages:${message.userId}`, JSON.stringify(message));
  }

  // Fetch all user message keys
  async getAllMessageKeys(): Promise<string[]> {
    return await this.client.keys('messages:*');
  }

  async getMessageHistory(userId: string): Promise<Message[]> {
    const messages = await this.client.lRange(`messages:${userId}`, 0, -1);
    return messages.map((message) => JSON.parse(message));
  }

  async clearMessageHistory(userId: string): Promise<void> {
    try {
      const userProfile: UserProfile = await this.getUser(userId);
      if (userProfile) {
        const backupListKey = `user_backups:${userId}`;
        // Save current message history as a backup
        const timestamp = new Date().toISOString();
        const backupKey = `${backupListKey}:${timestamp}`;
        await this.client.set(backupKey, JSON.stringify(userProfile));
        // Add the backup key to the list of backups
        await this.client.lPush(backupListKey, backupKey);
        // Trim the list to maintain max number of backups
        await this.client.lTrim(backupListKey, 0, MAX_HISTORY - 1);
        // Delete the current message history
        await this.client.del(`user:${userId}`);
        logger.info(`User profile for user ${userId} backed up and cleared.`);
      }
      const messageKey = `messages:${userId}`;
      const messageHistory = await this.client.lRange(messageKey, 0, -1);
      if (messageHistory.length > 0) {
        const backupListKey = `history_backups:${userId}`;
        // Save current message history as a backup
        const timestamp = new Date().toISOString();
        const backupKey = `${backupListKey}:${timestamp}`;
        await this.client.set(backupKey, JSON.stringify(messageHistory));
        // Add the backup key to the list of backups
        await this.client.lPush(backupListKey, backupKey);
        // Trim the list to maintain max number of backups
        await this.client.lTrim(backupListKey, 0, MAX_HISTORY - 1);

        // Delete the current message history
        await this.client.del(messageKey);

        logger.info(`Message history for user ${userId} backed up and cleared.`);
      } else {
        logger.info(`No message history found for user ${userId}.`);
      }
    } catch (error: unknown) {
      logger.error('Error clearing and backing up message history:', error);
    }
  }

  async getBackups(userId: string) {
    const backups = await this.client.lRange(`user_backups:${userId}`, 0, -1);
    return backups.map((backupName: string) => {
      const prefix = `user_backups:${userId}:`;
      if (backupName.startsWith(prefix)) {
        return backupName.replace(prefix, '');
      }
      return backupName;
    });
  }

  async restoreFromBackup(backupKey: string): Promise<void> {
    const profileString: string = (await this.client.get(`user_backups:${backupKey}`))!;
    const profile: UserProfile = JSON.parse(profileString) as UserProfile;
    this.saveUser(profile);
  }

  async getActiveUsers(): Promise<UserProfile[]> {
    const userKeys = await this.client.keys('user:*');
    const activeUsers: UserProfile[] = [];

    for (const key of userKeys) {
      const userData = await this.client.get(key);
      if (userData) {
        activeUsers.push(JSON.parse(userData));
      }
    }

    return activeUsers;
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}

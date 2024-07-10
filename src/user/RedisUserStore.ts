import { createClient, RedisClientType } from 'redis';
import { UserStore } from './UserStore';
import { Language, Message, UserProfile } from './UserProfile';

const MAX_HISTORY = 10; // Default max history

export class RedisUserStore implements UserStore {
  private client: RedisClientType;

  constructor(
    private host: string,
    private port: number,
  ) {
    this.client = createClient({
      socket: {
        host: this.host,
        port: this.port,
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
      throw new Error("Couldn't connect to Redis");
    });
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
          messageHistory: [],
          satisfactionLevel: [],
          personalDetails: {},
          language: Language.heb,
        } as UserProfile);
  }

  async addMessage(message: Message): Promise<void> {
    await this.client.rPush(
      `messages:${message.userId}`,
      JSON.stringify(message),
    );
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
        const emptyProfile: UserProfile = {
          id: userProfile.id,
          language: Language.heb,
          personalDetails: {},
          messageHistory: [],
          satisfactionLevel: [],
        };
        await this.saveUser(emptyProfile);
        console.log(`User profile for user ${userId} backed up and cleared.`);
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

        console.log(
          `Message history for user ${userId} backed up and cleared.`,
        );
      } else {
        console.log(`No message history found for user ${userId}.`);
      }
    } catch (error: unknown) {
      console.error('Error clearing and backing up message history:', error);
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
  // const keys: string[] = [];
  // let cursor = 0;

  // try {
  //   do {
  //     const result = await this.client.scan(cursor, {
  //       MATCH: `user_backups:*`,
  //       COUNT: 100,
  //     });

  //     cursor = result.cursor;
  //     const response: string[] = result.keys.map((backupName: string) => {
  //       const prefix = 'user_backups:';
  //       if (backupName.startsWith(prefix)) {
  //         return backupName.replace(prefix, '');
  //       }
  //       return backupName;
  //     });
  //     keys.push(...response);
  //   } while (cursor !== 0);
  //   console.log(`Found backup keys: ${keys}`);
  // } catch (error) {
  //   console.error('Error scanning backup keys:', error);
  // }

  // return keys;

  async restoreFromBackup(backupKey: string): Promise<void> {
    const profileString: string = (await this.client.get(
      `user_backups:${backupKey}`,
    ))!;
    const profile: UserProfile = JSON.parse(profileString) as UserProfile;
    this.saveUser(profile);
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

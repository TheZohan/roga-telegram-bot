import { createClient, RedisClientType } from 'redis';
import { UserStore } from './UserStore';
import { Message, UserProfile } from './UserProfile';

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
          personalDetails: {},
          language: 'en-US',
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

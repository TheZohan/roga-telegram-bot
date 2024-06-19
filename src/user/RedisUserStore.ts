import { createClient, RedisClientType } from 'redis';
import { UserStore } from './UserStore';
import { UserProfile } from './UserProfile';

export class RedisUserStore implements UserStore {
  private client: RedisClientType;

  constructor(private host: string, private port: number) {
    this.client = createClient({
      socket: {
        host: this.host,
        port: this.port,
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
      throw new Error("Couldn't connect to Redis");
    })
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async saveUser(user: UserProfile): Promise<void> {
    await this.client.set(user.id, JSON.stringify(user));
  }

  async getUser(id: string): Promise<UserProfile> {
    const data = await this.client.get(id);
    return data ? JSON.parse(data) : ({
      id: id,
      messageHistory: [],
      personalDetails: {},
      language: 'en-US',
    } as UserProfile);
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

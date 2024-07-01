import { MemoryUserStore } from './MemoryUserStore';
import { RedisUserStore } from './RedisUserStore';
import { Message, UserProfile } from './UserProfile';

export interface UserStore {
  saveUser(user: UserProfile): Promise<void>;
  getUser(userId: string): Promise<UserProfile>;
  addMessage(message: Message): Promise<void>;
  getMessageHistory(userId: string): Promise<Message[]>;
  clearMessageHistory(userId: string): Promise<void>;
  getBackups(userId: string): Promise<string[]>;
  restoreFromBackup(backupKey: string): Promise<void>;
  disconnect(): void;
}

export const createUserStore = async (): Promise<UserStore> => {
  const redisHost = process.env.REDISHOST!;
  const redisPort = +process.env.REDISPORT!;
  const redisStore = new RedisUserStore(redisHost, redisPort);

  try {
    await redisStore.connect();
    if (await redisStore.isConnected()) {
      console.log('Connected to Redis');
      return redisStore;
    }
  } catch (error) {
    console.error('Redis connection failed:', error);
  }

  console.log('Using MemoryUserStore as fallback');
  return new MemoryUserStore();
};

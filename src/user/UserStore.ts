import logger from '../utils/logger';
import { MemoryUserStore } from './MemoryUserStore';
import { RedisUserStore } from './RedisUserStore';
import { Message, UserData, UserProfile } from './UserProfile';

export interface UserStore {
  getUserData(userId: string): Promise<UserData>;
  saveUser(user: UserProfile): Promise<void>;
  getUser(userId: string): Promise<UserProfile>;
  addMessage(message: Message): Promise<void>;
  getMessageHistory(userId: string): Promise<Message[]>;
  clearMessageHistory(userId: string): Promise<void>;
  getBackups(userId: string): Promise<string[]>;
  restoreFromBackup(backupKey: string): Promise<void>;
  disconnect(): void;
  getActiveUsers(): Promise<UserProfile[]>;
}

export const createUserStore = async (): Promise<UserStore> => {
  const redisHost = process.env.REDISHOST!;
  const redisPort = +process.env.REDISPORT!;
  const redisStore = new RedisUserStore(redisHost, redisPort);

  try {
    await redisStore.connect();
    if (await redisStore.isConnected()) {
      logger.info('Connected to Redis');
      return redisStore;
    }
  } catch (error) {
    logger.error('Redis connection failed:', error);
  }

  logger.info('Using MemoryUserStore as fallback');
  return new MemoryUserStore();
};

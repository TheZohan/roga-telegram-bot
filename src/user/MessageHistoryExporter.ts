import { createClient, RedisClientType } from 'redis';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import iconv from 'iconv-lite';

interface Message {
  id: string;
  userId: string;
  timestamp: Date;
  content: string;
}

class RedisUserStore {
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

    this.client.on('error', (err) => console.error('Redis Client Error', err));
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log('Connected to Redis');
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    console.log('Disconnected from Redis');
  }

  // Fetch all user message keys
  async getAllMessageKeys(): Promise<string[]> {
    return await this.client.keys('messages:*');
  }

  // Get all messages for a specific user
  async getMessageHistory(userId: string): Promise<Message[]> {
    const messages = await this.client.lRange(`messages:${userId}`, 0, -1);
    return messages.map((message) => JSON.parse(message));
  }
}

export const exportMessageHistoryToCsv = async (): Promise<string> => {
  const redisHost = process.env.REDISHOST!;
  const redisPort = +process.env.REDISPORT!;
  const redisStore = new RedisUserStore(redisHost, redisPort);

  try {
    await redisStore.connect();

    const messageKeys = await redisStore.getAllMessageKeys();
    const allMessages: Message[] = [];

    for (const key of messageKeys) {
      const userId = key.split(':')[1];
      const messages = await redisStore.getMessageHistory(userId);
      allMessages.push(...messages);
    }

    // Create a CSV writer instance
    const csvWriter = createObjectCsvWriter({
      path: 'message_history.csv',
      header: [
        { id: 'id', title: 'ID' },
        { id: 'userId', title: 'User ID' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'content', title: 'Content' },
      ],
      encoding: 'utf8', // Ensure the encoding is set to UTF-8
    });

    // Write the records to the CSV
    await csvWriter.writeRecords(allMessages);
    console.log('Message history exported to message_history.csv');

    // Read the CSV file and re-encode it to UTF-8
    const csvContent = fs.readFileSync('message_history.csv');
    const utf8Content = iconv.encode(iconv.decode(csvContent, 'utf8'), 'utf8');
    const csvPath = 'message_history_utf8.csv';
    fs.writeFileSync(csvPath, utf8Content);
    console.log(
      'Message history re-encoded to UTF-8 in message_history_utf8.csv',
    );
    return csvPath;
  } catch (err) {
    console.error('Error:', err);
    return '';
  } finally {
    await redisStore.disconnect();
  }
};

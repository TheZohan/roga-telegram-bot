import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import iconv from 'iconv-lite';
import logger from '../utils/logger';
import { RedisUserStore } from './RedisUserStore';
import { Message } from './UserProfile';

export const exportMessageHistoryToCsv = async (): Promise<string> => {
  const redisUrl = process.env.REDIS_URL!;
  const redisStore = new RedisUserStore(redisUrl);

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
    logger.info('Message history exported to message_history.csv');

    // Read the CSV file and re-encode it to UTF-8
    const csvContent = fs.readFileSync('message_history.csv');
    const utf8Content = iconv.encode(iconv.decode(csvContent, 'utf8'), 'utf8');
    const csvPath = 'message_history_utf8.csv';
    fs.writeFileSync(csvPath, utf8Content);
    logger.info('Message history re-encoded to UTF-8 in message_history_utf8.csv');
    return csvPath;
  } catch (err) {
    logger.error('Error:', err);
    return '';
  } finally {
    await redisStore.disconnect();
  }
};

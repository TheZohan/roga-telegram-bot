import { Telegraf } from 'telegraf';
import { createUserStore, UserStore } from '../user/UserStore';
import { MessageHandler } from '../models/MessageHandler';
import logger from '../utils/logger';
import cron from 'node-cron';
import { initializeBot } from './Bot';
import { Express, Request, Response } from 'express';
import { UserProfile } from '../user/UserProfile';

export class ScheduledMessages {
  private bot: Telegraf;
  private userStore: UserStore;
  private messageHandler: MessageHandler;

  constructor(bot: Telegraf, userStore: UserStore) {
    this.bot = bot;
    this.userStore = userStore;
    this.messageHandler = new MessageHandler(userStore);
  }

  public startScheduledMessages(): void {
    // Schedule the job to run every day at midnight
    cron.schedule('0 0 * * *', () => {
      this.sendScheduledMessages();
    });
  }

  public async sendScheduledMessages(): Promise<void> {
    logger.info('Starting scheduled messages');
    const activeUsers: UserProfile[] = await this.userStore.getActiveUsers();

    for (const user of activeUsers) {
      try {
        const message: string = await this.messageHandler.createScheduledMessage(user.id);
        await this.bot.telegram.sendMessage(user.id, message);
        logger.info(`Sent scheduled message to user ${user.id}`);
      } catch (error) {
        logger.error(`Error sending scheduled message to user ${user.id}:`, error);
      }
    }

    logger.info('Finished sending scheduled messages');
  }
}

export async function setupScheduleMessageRoutes(app: Express): Promise<void> {
  const botInstance: Telegraf = await initializeBot();
  const userStore: UserStore = await createUserStore();
  const scheduledMessages = new ScheduledMessages(botInstance, userStore);

  app.post('/api/trigger-scheduled-messages', async (req: Request, res: Response): Promise<void> => {
    try {
      await scheduledMessages.sendScheduledMessages();
      res.status(200).json({ message: 'Scheduled messages sent successfully' });
    } catch (error) {
      logger.error('Error triggering scheduled messages:', error);
      res.status(500).json({ error: 'Failed to send scheduled messages' });
    }
  });
}

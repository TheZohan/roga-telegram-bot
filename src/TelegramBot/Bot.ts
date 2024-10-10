import { NarrowedContext, Context, Telegraf } from 'telegraf';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import { UserStore, createUserStore } from '../user/UserStore';
import { setLanguageCommand } from './language';
import { createClearConversationHistoryCommand, restoreConversationHistoryCommand } from './ConversationHistory';
import i18n from '../utils/il18n';
import { RatingSelector } from './ratingSelector';
import { MessageHandler } from '../logic/MessageHandler';
import logger from '../utils/logger';

export const initializeBot = async (): Promise<Telegraf> => {
  const telegramToken = process.env.TELEGRAM_TOKEN!;
  const bot: Telegraf = new Telegraf(telegramToken);

  const userStore: UserStore = await createUserStore();
  await setLanguageCommand(bot, userStore);
  await createClearConversationHistoryCommand(bot, userStore);
  await restoreConversationHistoryCommand(bot, userStore);

  bot.use((ctx, next) => {
    logger.debug(ctx.update);
    return next();
  });

  bot.start(async (ctx) => {
    console.time('onStart');
    try {
      const userId: string = ctx.from?.id.toString();
      logger.info('New user', userId);
      const messageHandler = new MessageHandler(userStore);
      const greeting = await messageHandler.greetTheUser(userId);
      await ctx.reply(greeting);
    } catch (error) {
      logger.error('Error in bot.start', error);
      await ctx.reply(i18n.t('errorMessage'));
    } finally {
      console.timeEnd('onStart');
    }
  });

  bot.help((ctx) => {
    ctx.reply(i18n.t('helpMessage'));
  });

  bot.on('message', async (ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>) => {
    console.time('OnTelegramMessage');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userMessage = (ctx.message as any).text;

    if (!userMessage) {
      ctx.reply('Please send a text message.');
      return;
    }

    logger.debug('Input: ', userMessage);

    await ctx.sendChatAction('typing');
    const userId: string = ctx.from?.id.toString();

    const maxRetries = 3;
    let retries = 0;
    let success = false;

    do {
      try {
        const ratingSelector = new RatingSelector(bot, ctx);
        const messageHandler = new MessageHandler(userStore, ratingSelector);
        const botReply = await messageHandler.handleMessage(userId, userMessage);
        if (botReply) {
          await ctx.reply(botReply);
        }
        success = true;
      } catch (error) {
        retries++;
        logger.error('Error handling Telegram message. Retry attempt ${retries} failed', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } while (retries < maxRetries && !success);

    if (!success) {
      // All retries failed, inform the user
      const errorMessage = i18n.t('errorMessage');
      await ctx.reply(errorMessage);
    }

    console.timeEnd('OnTelegramMessage');
  });

  bot.launch().then(() => {
    logger.info('Bot launched');
    //const scheduledMessages = new ScheduledMessages(bot, userStore);
    //scheduledMessages.startScheduledMessages();
  });

  // Gracefully close the connection when the process exits
  process.on('SIGINT', async () => {
    process.exit();
  });

  process.on('SIGTERM', async () => {
    userStore.disconnect();
    bot.stop();
  });

  return bot;
};

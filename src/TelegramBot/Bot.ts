import { NarrowedContext, Context, Telegraf } from 'telegraf';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import { UserStore, createUserStore } from '../user/UserStore';
import { setLanguageCommand } from './language';
import {
  createClearConversationHistoryCommand,
  restoreConversationHistoryCommand,
} from './ConversationHistory';
import i18n from '../il18n';
import { UserContext } from '../user/UserProfile';
import { RatingSelector } from './ratingSelector';
import { MessageHandler } from '../models/MessageHandler';

export const initializeBot = async () => {
  const telegramToken = process.env.TELEGRAM_TOKEN!;
  const bot: Telegraf = new Telegraf(telegramToken);

  const userStore: UserStore = await createUserStore();
  await setLanguageCommand(bot, userStore);
  await createClearConversationHistoryCommand(bot, userStore);
  await restoreConversationHistoryCommand(bot, userStore);

  bot.use((ctx, next) => {
    console.log(ctx.update);
    return next();
  });

  bot.start(async (ctx) => {
    ctx.reply(i18n.t('greeting'));
  });

  bot.help((ctx) => {
    ctx.reply(i18n.t('helpMessage'));
  });

  bot.on(
    'message',
    async (
      ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>,
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userMessage = (ctx.message as any).text;

      if (!userMessage) {
        ctx.reply('Please send a text message.');
        return;
      }

      console.log('Input: ', userMessage);

      await ctx.sendChatAction('typing');
      const userId: string = ctx.from?.id.toString();

      try {
        const userContext: UserContext = {
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name || '',
          username: ctx.from.username || '',
        };

        const ratingSelector = new RatingSelector(bot, ctx);
        const messageAnalyzer = new MessageHandler(userStore, ratingSelector);
        const botReply = await messageAnalyzer.handleMessage(
          userId,
          userMessage,
          userContext,
        );
        await ctx.reply(botReply);
      } catch (error) {
        console.log(error);
        const message = JSON.stringify(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (error as any)?.response?.data?.error ?? 'Unable to extract error',
        );

        console.log({ message });

        await ctx.reply(
          'Whoops! There was an error while talking to OpenAI. Error: ' +
            message,
        );
      }
    },
  );

  bot.launch().then(() => {
    console.log('Bot launched');
  });

  // Gracefully close the connection when the process exits
  process.on('SIGINT', async () => {
    process.exit();
  });

  process.on('SIGTERM', async () => {
    userStore.disconnect();
    bot.stop();
  });
};

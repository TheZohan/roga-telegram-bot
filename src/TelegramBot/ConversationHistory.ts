import { Context, Markup, Telegraf } from 'telegraf';
import { UserProfile } from '../user/UserProfile';
import { UserStore } from '../user/UserStore';
import moment from 'moment';

export const createClearConversationHistoryCommand = async (
  bot: Telegraf,
  userStore: UserStore,
) => {
  bot.command('clear', (ctx: Context) => {
    ctx.reply(
      'Are you sure you want to clear the chat history?',
      Markup.inlineKeyboard([
        Markup.button.callback('Yes please', 'clearChatHistory'),
        Markup.button.callback('No, cancel', 'cancelClearChatHistory'),
      ]),
    );
  });

  bot.action('cancelClearChatHistory', async (ctx) => {
    ctx.reply('Clear chat history cancelled');
  });

  bot.action('clearChatHistory', async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (userId) {
      await userStore.clearMessageHistory(userId);
      ctx.reply('You can start fresh now');
    }
  });
};

export const restoreConversationHistoryCommand = async (
  bot: Telegraf,
  userStore: UserStore,
) => {
  // Command to set language
  bot.command('restore', async (ctx: Context) => {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      console.error('User ID is empty');
      return;
    }
    const backupList: string[] = await userStore.getBackups(userId);
    const backupButtons = backupList.map((backupKey: string) => {
      const backupDate = new Date(backupKey);
      const formattedDate = moment(backupDate).format('DD-MM-YYYY HH:mm');
      return Markup.button.callback(formattedDate, `restore_${backupKey}`);
    });
    backupList.forEach((backupKey: string) => {
      bot.action(`restore_${backupKey}`, async () => {
        await userStore.restoreFromBackup(backupKey);
        ctx.reply(`Restored ${backupKey}`);
      });
    });
    ctx.reply(
      'Which backup do you want to restore?',
      Markup.inlineKeyboard(backupButtons),
    );
  });
};

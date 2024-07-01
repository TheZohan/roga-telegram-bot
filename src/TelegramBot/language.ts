import { Context, Markup, Telegraf } from 'telegraf';
import { UserProfile } from '../user/UserProfile';
import { UserStore } from '../user/UserStore';

export const setLanguageCommand = async (
  bot: Telegraf,
  userStore: UserStore,
) => {
  // Command to set language
  bot.command('setlanguage', (ctx: Context) => {
    ctx.reply(
      'Choose your language / בחר את שפתך',
      Markup.inlineKeyboard([
        Markup.button.callback('English', 'lang_en'),
        Markup.button.callback('עברית', 'lang_he'),
      ]),
    );
  });

  // Handle language selection
  bot.action('lang_en', async (ctx) => {
    if (ctx.from?.id.toString()) {
      const userProfile: UserProfile = await userStore.getUser(
        ctx.from?.id.toString(),
      );
      userProfile.language = 'en-US';
      ctx.answerCbQuery('Language set to English.');
      ctx.reply('Language set to English.');
    }
  });

  bot.action('lang_he', async (ctx) => {
    if (ctx.from?.id.toString()) {
      const userProfile: UserProfile = await userStore.getUser(
        ctx.from?.id.toString(),
      );
      userProfile.language = 'heb';
      ctx.answerCbQuery('השפה נקבעה לעברית.');
      ctx.reply('השפה נקבעה לעברית.');
    }
  });
};

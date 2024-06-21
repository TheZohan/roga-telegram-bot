import dotenv from 'dotenv';
dotenv.config();

import { NarrowedContext, Context, Markup, Telegraf } from 'telegraf';
import express, { Request, Response } from 'express';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import { UserContext, UserProfile } from './user/UserProfile';
import { MessageHandler } from './models/MessageHandler';
import i18n from './il18n';
import fs from 'fs';
import { UserStore, createUserStore } from './user/UserStore';
import { exportMessageHistoryToCsv } from './user/MessageHistoryExporter';
const app = express();
const telegramToken = process.env.TELEGRAM_TOKEN!;

const bot = new Telegraf(telegramToken);
let userStore: UserStore;
(async () => {
  userStore = await createUserStore();
})();

bot.start(async (ctx) => {
  ctx.reply(i18n.t('greeting'));
});

bot.help((ctx) => {
  ctx.reply(i18n.t('helpMessage'));
});

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

      const messageAnalyzer = new MessageHandler(userStore);
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
        'Whoops! There was an error while talking to OpenAI. Error: ' + message,
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

app.get('/', (req: Request, res: Response) => {
  res.send(`Hello, I'm alive!`);
});

// Middleware to secure the endpoint
app.use((req, res, next) => {
  const auth = {
    login: process.env.ADMIN_USER!,
    password: process.env.ADMIN_PASSWORD!,
  };

  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64')
    .toString()
    .split(':');

  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="401"');
  res.status(401).send('Authentication required.');
});

app.get('/export', async (req: Request, res: Response) => {
  try {
    const csvPath = await exportMessageHistoryToCsv();
    res.download(csvPath, (err) => {
      if (err) {
        console.error('Error sending the file:', err);
        res.status(500).send('Error exporting message history.');
      } else {
        console.log('File sent successfully.');
        fs.unlinkSync(csvPath); // Delete the file after sending
      }
    });
  } catch (error) {
    res.status(500).send('Error exporting message history.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

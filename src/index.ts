import dotenv from "dotenv";
dotenv.config();

import { NarrowedContext, Context, Markup, Telegraf } from "telegraf";
import { existsSync, mkdirSync } from "fs";
import express, { Request, Response } from 'express';
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { UserContext, UserProfile } from "./user/UserProfile";
import { MessageAnalyzer } from "./models/messageAnalyzer";
import i18n from './il18n';
import UsersStore from "./user/UsersStore";

const app = express();

const workDir = "./tmp";
const telegramToken = process.env.TELEGRAM_TOKEN!;
// create new telegram chat
const bot = new Telegraf(telegramToken);

const usersStore = new UsersStore();
const messageAnalyzer = new MessageAnalyzer(usersStore);

if (!existsSync(workDir)) {
  mkdirSync(workDir);
}

bot.start(async (ctx) => {
  ctx.reply(i18n.t('greeting'));
});

bot.help((ctx) => {
  ctx.reply(i18n.t('helpMessage'));
});

// Command to set language
bot.command('setlanguage', (ctx: Context) => {
  ctx.reply('Choose your language / בחר את שפתך', Markup.inlineKeyboard([
    Markup.button.callback('English', 'lang_en'),
    Markup.button.callback('עברית', 'lang_he')
  ]));
});

// Handle language selection
bot.action('lang_en', (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    let userProfile: UserProfile = usersStore.get(userId);
    userProfile.language = 'en-US';
    ctx.answerCbQuery('Language set to English.');
    ctx.reply('Language set to English.');
  }
});

bot.action('lang_he', (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    let userProfile: UserProfile = usersStore.get(userId);
    userProfile.language = 'heb';
    ctx.answerCbQuery('השפה נקבעה לעברית.');
    ctx.reply('השפה נקבעה לעברית.');
  }
});


bot.on("message", async (ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>) => {
  const userMessage = (ctx.message as any).text;
  
  // if the user sent empty message
  if (!userMessage) {
    ctx.reply("Please send a text message.");
    return;
  }

  console.log("Input: ", userMessage);

  await ctx.sendChatAction("typing");
  const userId = ctx.from?.id;

  try {
    if (!userId) {
      console.log("userId is null");
      return;
    }

    // Get user data
    const userContext: UserContext = {
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name || "",
      username: ctx.from.username || ""
    }

    // send the message to the chatbot and return the response to the user
    const botReply = await messageAnalyzer.handleMessage(userId, userMessage, userContext);
    await ctx.reply(botReply);
  } 

  catch (error) {
    console.log(error);
    const message = JSON.stringify(
      (error as any)?.response?.data?.error ?? "Unable to extract error"
    );

    console.log({ message });

    await ctx.reply(
      "Whoops! There was an error while talking to OpenAI. Error: " + message
    );
  }
});

bot.launch().then(() => {
  console.log("Bot launched");
});

process.on("SIGTERM", () => {
  bot.stop();
});


app.get('/', (req: Request, res: Response) => {
  res.send(`Hello, I'm alive!`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
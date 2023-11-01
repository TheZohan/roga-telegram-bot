import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import { existsSync, mkdirSync } from "fs";
import express, { Request, Response } from 'express';
import UsersStore from "./user/UsersStore";
import { MessageAnalyzer } from "./models/messageAnalyzer";
const app = express();

const workDir = "./tmp";
const telegramToken = process.env.TELEGRAM_TOKEN!;

const bot = new Telegraf(telegramToken);
const usersStore = new UsersStore();
const messageAnalyzer = new MessageAnalyzer();

if (!existsSync(workDir)) {
  mkdirSync(workDir);
}

bot.start(async (ctx) => {
  const introMessage = `Hi`;
  ctx.reply(introMessage);
});

bot.help((ctx) => {
  ctx.reply(`You can share with me your journey in life. I will be there for you and assit you along your path by 
  lighting up the darker areas of your way`);
});


bot.on("message", async (ctx) => {
  const userMessage = (ctx.message as any).text;

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

    let userProfile = usersStore.get(userId);
    const user = ctx.from;

    userProfile = {
      ...userProfile,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      lastMessage: userMessage
    };
    console.log("UserProfile 1: ", userProfile);
    const botReply = await messageAnalyzer.analyzeMessage(userProfile, userMessage);
    userProfile.conversationSummary = await messageAnalyzer.enhanceSummary(userProfile, userMessage, botReply);
    console.log("UserProfile 2: ", userProfile);
    usersStore.update(userProfile);
    await ctx.reply(botReply);
  } catch (error) {
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
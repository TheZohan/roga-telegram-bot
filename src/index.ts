import dotenv from "dotenv";
dotenv.config();

import { NarrowedContext, Context, Telegraf } from "telegraf";
import { existsSync, mkdirSync } from "fs";
import express, { Request, Response } from 'express';
import { MessageAnalyzer } from "./models/messageAnalyzer";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { UserContext } from "./user/UserProfile";
const app = express();

const workDir = "./tmp";
const telegramToken = process.env.TELEGRAM_TOKEN!;

const bot = new Telegraf(telegramToken);
const messageAnalyzer = new MessageAnalyzer();

if (!existsSync(workDir)) {
  mkdirSync(workDir);
}

bot.start(async (ctx) => {
  const introMessage = `Hey there, great to meet you! I'm Roga, your personal spiritual guide. 
  My goal is to support you on your life's journey. 
  Feel free to ask for advice, seek answers, or just share what's on your mind.
  How's your day going so far?`;
  ctx.reply(introMessage);
});

bot.help((ctx) => {
  ctx.reply(`You can share with me your journey in life. I will be there for you and assit you along your path by 
  lighting up the darker areas of your way`);
});


bot.on("message", async (ctx: NarrowedContext<Context<Update>, Update.MessageUpdate<Message>>) => {
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

    const userContext: UserContext = {
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name || "",
      username: ctx.from.username || ""
    }

    const botReply = await messageAnalyzer.handleMessage(userId, userMessage, userContext);
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
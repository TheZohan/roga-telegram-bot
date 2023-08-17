import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import { existsSync, mkdirSync } from "fs";
import { Model as ChatWithTools } from "./models/chatWithTools";
import express, { Request, Response } from 'express';
const app = express();

const workDir = "./tmp";
const telegramToken = process.env.TELEGRAM_TOKEN!;

const bot = new Telegraf(telegramToken);
let model = new ChatWithTools();

if (!existsSync(workDir)) {
  mkdirSync(workDir);
}

bot.start(async (ctx) => {
  const introMessage = await model.call(`You are a spritual mentor named Roga.
  If asked intorduce yourself as a mentor for a fulfilling and happy life (You can change this definition around this meaning).`);
  ctx.reply(introMessage);
});

bot.help((ctx) => {
  ctx.reply(`You can share with me your journey in life. I will be there for you and assit you along your path by 
  lighting up the darker areas of your way`);
});


bot.on("message", async (ctx) => {
  const text = (ctx.message as any).text;

  if (!text) {
    ctx.reply("Please send a text message.");
    return;
  }

  console.log("Input: ", text);

  await ctx.sendChatAction("typing");
  try {
    const response = await model.call(text);

    await ctx.reply(response);
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
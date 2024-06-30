import { Context, Markup, Telegraf } from 'telegraf';

export type SetSelectionCallback = (
  rating: string,
  userId: string,
) => Promise<void>;

export interface TelegramSelector {
  creategSelector(
    subjectId: string,
    displayText: string,
    values: string[],
    setSelectionCallback: SetSelectionCallback,
  ): Promise<void>;
}

export class RatingSelector implements TelegramSelector {
  bot: Telegraf;
  ctx: Context;

  constructor(bot: Telegraf, ctx: Context) {
    this.bot = bot;
    this.ctx = ctx;
  }

  creategSelector = async (
    subjectId: string,
    displayText: string,
    values: string[],
    setSelectionCallback: SetSelectionCallback,
  ) => {
    if (values.length > 8) {
      console.log(`Telegram can't add more than 8 values to a selector`);
    }

    const selectorMarkup = values.map((value) => {
      return Markup.button.callback(`${value}`, `rating_${subjectId}_${value}`);
    });

    this.ctx.reply(displayText, Markup.inlineKeyboard(selectorMarkup));
    // Handle language selection
    values.forEach((value: string) => {
      this.bot.action(`rating_${subjectId}_${value}`, async (ctx) => {
        if (ctx.from?.id.toString()) {
          setSelectionCallback(value, ctx.from?.id.toString());
          ctx.answerCbQuery('Thank you.');
          ctx.reply('Your selection is saved');
        }
      });
    });
  };
}

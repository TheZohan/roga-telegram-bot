import { Context, Markup, Telegraf } from 'telegraf';
import logger from '../utils/logger';

export type SetSelectionCallback = (level: string, userId: string, ctx: Context) => Promise<void>;

export interface TelegramSelector {
  createSelector(
    subjectId: string,
    displayText: string,
    values: string[],
    displayValues: string[],
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

  createSelector = async (
    subjectId: string,
    displayText: string,
    values: string[],
    displayValues: string[],
    setSelectionCallback: SetSelectionCallback,
  ) => {
    if (values.length > 8) {
      logger.error(`Telegram can't add more than 8 values to a selector`);
    }

    const selectorMarkup = values.map((value, index) => {
      return Markup.button.callback(`${displayValues.at(index)}`, `rating_${subjectId}_${value}`);
    });

    this.ctx.reply(displayText, Markup.inlineKeyboard(selectorMarkup));
    values.forEach((value: string) => {
      this.bot.action(`rating_${subjectId}_${value}`, async (ctx) => {
        if (ctx.from?.id.toString()) {
          setSelectionCallback(value, ctx.from?.id.toString(), ctx);
          ctx.answerCbQuery('Thank you.');
        }
      });
    });
  };
}

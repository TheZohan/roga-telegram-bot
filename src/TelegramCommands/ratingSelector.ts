import { Context, Markup, Telegraf } from 'telegraf';

export type SetRatingCallback = (
  rating: number,
  userId: string,
) => Promise<void>;

export class RatingSelector {
  bot: Telegraf;
  ctx: Context;

  constructor(bot: Telegraf, ctx: Context) {
    this.bot = bot;
    this.ctx = ctx;
  }

  createRatingSelector = (
    ratingSubjectId: string,
    ratingText: string,
    range: number, // max is 8
    start: number = 0,
    setRatingCallback: SetRatingCallback,
  ) => {
    const scale_markup = [];
    for (let i = start; i <= start + range; i++) {
      scale_markup.push(
        Markup.button.callback(`${i}`, `rating_${ratingSubjectId}_${i}`),
      );
    }
    this.ctx.reply(ratingText, Markup.inlineKeyboard(scale_markup));
    // Handle language selection
    for (let i = start; i <= start + range; i++) {
      this.bot.action(`rating_${ratingSubjectId}_${i}`, async (ctx) => {
        if (ctx.from?.id.toString()) {
          setRatingCallback(i, ctx.from?.id.toString());
          ctx.answerCbQuery('Thank you.');
          ctx.reply('Your selection is saved');
        }
      });
    }
  };
}

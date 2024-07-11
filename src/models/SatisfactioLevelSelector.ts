import { Context } from 'telegraf';
import {
  RatingSelector,
  SetSelectionCallback,
} from '../TelegramBot/ratingSelector';
import {
  FriendlySatisfactionLevel,
  FriendlySatisfactionLevelTranslationKeys,
  Rating,
  UserProfile,
} from '../user/UserProfile';
import { UserStore } from '../user/UserStore';
import { MessageHandler } from './MessageHandler';
import i18n from '../il18n';

export function shouldAskForSatisfactionLevel(
  userProfile: UserProfile,
): boolean {
  // Calculate the time difference
  const now = new Date();
  if (userProfile.lastTimeAskedForSatisfactionLevel) {
    const timeDifference =
      now.getTime() -
      new Date(userProfile.lastTimeAskedForSatisfactionLevel).getTime();

    // Convert time difference to hours
    const hoursDifference = timeDifference / (1000 * 60 * 60);

    // Check if the difference is more than 24 hours
    return hoursDifference > 24;
  } else {
    return true;
  }
}

export const createSatisfactionLevelSelector = async (
  messageHandler: MessageHandler,
  lastUserMessage: string,
  userStore: UserStore,
  ratingSelector: RatingSelector,
): Promise<void> => {
  const satisfactionLevels = Object.values(FriendlySatisfactionLevel);
  const translatedSatisfactionLevels = satisfactionLevels.map((level) => {
    return i18n.t(
      FriendlySatisfactionLevelTranslationKeys[
        level as keyof typeof FriendlySatisfactionLevel
      ],
    );
  });
  const satisfactionMapping = satisfactionLevels.map((level, index) => ({
    level,
    value: index + 1,
  }));
  console.log('createSatisfactionLevelSelector');
  const setRatingCallback: SetSelectionCallback = async (
    level: string,
    userId: string,
    ctx: Context,
  ) => {
    console.log('Setting level for user', userId, level);
    const mapping = satisfactionMapping.find((m) => m.level === level);
    if (!mapping) {
      throw new Error('Invalid satisfaction level');
    }
    console.log('setting mapped value: ', level, mapping.value);
    const userProfile: UserProfile = await userStore.getUser(userId);
    const ratingObj: Rating = {
      timestamp: new Date(),
      level: +mapping.value,
    };
    if (!userProfile.satisfactionLevel) {
      userProfile.satisfactionLevel = [];
    }
    userProfile.satisfactionLevel.push(ratingObj);
    userStore.saveUser(userProfile);
    const translatedSatisfactionLevel: string = i18n.t(
      FriendlySatisfactionLevelTranslationKeys[
        level as keyof typeof FriendlySatisfactionLevel
      ],
    );
    ctx.reply(
      await messageHandler.handleMessage(
        userId,
        `${lastUserMessage}. ${i18n.t('FriendlySatisfactionLevel.Template', { level: translatedSatisfactionLevel })}`,
      ),
    );
  };
  ratingSelector.createSelector(
    'satisfactionLevel',
    i18n.t('askForSatisfactionLevel'),
    satisfactionLevels,
    translatedSatisfactionLevels,
    setRatingCallback,
  );
};

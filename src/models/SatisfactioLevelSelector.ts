import {
  RatingSelector,
  SetSelectionCallback,
} from '../TelegramCommands/ratingSelector';
import {
  FriendlySatisfactionLevel,
  Rating,
  UserProfile,
} from '../user/UserProfile';
import { UserStore } from '../user/UserStore';

export const createSatisfactionLevelSelector = async (
  userStore: UserStore,
  ratingSelector: RatingSelector,
): Promise<void> => {
  const satisfactionLevels = Object.values(FriendlySatisfactionLevel);
  const satisfactionMapping = satisfactionLevels.map((level, index) => ({
    level,
    value: index + 1,
  }));
  console.log('createSatisfactionLevelSelector');
  const setRatingCallback: SetSelectionCallback = async (
    level: string,
    userId: string,
  ) => {
    console.log('Setting level for user', userId);
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
  };
  ratingSelector.creategSelector(
    'satisfactionLevel',
    'How satisfied are you from your life right now?',
    satisfactionLevels,
    setRatingCallback,
  );
};

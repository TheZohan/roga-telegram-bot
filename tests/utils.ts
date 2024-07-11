//import { RedisUserStore } from '../src/user/RedisUserStore';
import moment from 'moment';
import { UserProfile } from '../src/user/UserProfile';
import { UserStore, createUserStore } from '../src/user/UserStore';

process.env.REDISHOST = 'localhost';
process.env.REDISPORT = '6379';

const changeUserValue = async (userId: string) => {
  const userStore: UserStore = await createUserStore();
  //new RedisUserStore(REDIS_HOST, REDIS_PORT);
  //await userStore.connect();
  const user: UserProfile = await userStore.getUser(userId);
  const now = new Date();
  const timeDifference = moment.duration(
    now.getTime() - new Date(user.lastTimeAskedForSatisfactionLevel!).getTime(),
  );
  console.log('timeDifference', timeDifference.asHours());
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  console.log(threeDaysAgo);
  user.lastTimeAskedForSatisfactionLevel = threeDaysAgo;
  await userStore.saveUser(user);
  const newTimeDifference = moment.duration(
    now.getTime() - new Date(user.lastTimeAskedForSatisfactionLevel!).getTime(),
  );
  console.log('newTimeDifference', newTimeDifference.asHours());
  console.log('changed');
};

changeUserValue('325270109');

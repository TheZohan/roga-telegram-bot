import { Message, UserProfile } from '../src/user/UserProfile';
import { UserStore } from '../src/user/UserStore';

interface StringToUserProfile {
  [key: string]: UserProfile;
}

export class UserStoreMock implements UserStore {
  getBackups(userId: string): Promise<string[]> {
    return Promise.resolve([]);
  }
  restoreFromBackup(backupKey: string): Promise<void> {
    return Promise.resolve();
  }
  disconnect(): void {}
  data: StringToUserProfile = {};

  getUser(userId: string): Promise<UserProfile> {
    return Promise.resolve(JSON.parse(JSON.stringify(this.data[userId])));
  }

  saveUser(user: UserProfile): Promise<void> {
    console.log('save user id:' + user.id);
    this.data[user.id] = user;
    return Promise.resolve();
  }

  removeUser(userId: string): Promise<void> {
    console.log(' user id:' + userId);
    delete this.data[userId];
    return Promise.resolve();
  }

  addMessage(message: Message): Promise<void> {
    this.data[message.userId].messageHistory.push(message);
    console.log(this.data[message.userId]);
    return Promise.resolve();
  }

  getMessageHistory(userId: string): Promise<Message[]> {
    console.log('messege history id:' + userId);
    const messages = this.data[userId].messageHistory;
    if (messages != undefined) {
      return Promise.resolve(messages);
    }
    return Promise.resolve([]);
  }
  clearMessageHistory(userId: string): Promise<void> {
    this.data[userId].messageHistory = [];
    return Promise.resolve();
  }
}

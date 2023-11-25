import { UserProfile } from "./UserProfile";

export default class UsersStore {
    private store: Map<number, UserProfile>;

    constructor() {
        this.store = new Map<number, UserProfile>();
    }

    update(userProfile: UserProfile) {
        this.store.set(userProfile.id, userProfile);
    }

    get(userId: number): UserProfile {
        return this.store.get(userId) || {id: userId, messageHistory: [], personalDetails: {}} as UserProfile;
    }
}
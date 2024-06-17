def chat(user_response):
    if (user_response != 'bye'):
        if (user_response == 'thanks' or user_response == 'thank you'):
            flag = False
            print("KKWBOT: You are welcome..")
            return "You are welcome.."
        else:
            return "What do you want?"
    else:
        flag = False
        print("KKWBOT: Bye! take care..")
        return "Bye! take care.."


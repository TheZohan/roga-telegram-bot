from cohere_tools import CohereHandler, ConvHistoriesManager

llm_handler = CohereHandler()
histories = ConvHistoriesManager()
conv_id = histories.new_conv()

def chat(user_response):
    histories.add_msg(conv_id, user_response, 'USER')
    bot_response = llm_handler.chat(user_response, histories[conv_id])
    histories.add_msg(conv_id, bot_response['text'], 'CHATBOT')
    return bot_response['text']


    


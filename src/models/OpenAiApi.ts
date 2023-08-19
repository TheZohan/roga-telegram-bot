import axios from 'axios';

class OpenAIApi {
    private readonly API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
    private readonly API_KEY = process.env.OPENAI_API_KEY; // Replace with your OpenAI API key

    public async sendMessage(message: string): Promise<string> {
        try {
            const response = await axios.post(this.API_ENDPOINT, {
                prompt: message,
                model: process.env.OPENAI_MODEL,
                max_tokens: 150 // Adjust as needed
            }, {
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].text.trim();
            } else {
                throw new Error('No response from OpenAI API');
            }
        } catch (error) {
            console.error('Error communicating with OpenAI API:', error);
            throw error;
        }
    }
}

export default OpenAIApi;

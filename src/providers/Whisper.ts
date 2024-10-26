import { createReadStream } from 'fs';
import OpenAI from 'openai';
import { getVoiceFile, VoiceToTextProvider } from './VoiceToTextProvider';
import { Telegraf } from 'telegraf';

export default class Whisper implements VoiceToTextProvider {
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
  async convertVoiceToText(fileId: string, bot: Telegraf): Promise<string> {
    try {
      const audioFilePath = await getVoiceFile(fileId, bot);
      const transcript = await this.openai.audio.transcriptions.create({
        file: createReadStream(audioFilePath),
        model: 'whisper-1',
      })
      return transcript.text;
    } catch (error) {
      throw error;
    }
  }
}

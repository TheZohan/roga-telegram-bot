import { Telegraf } from 'telegraf';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import Whisper from './Whisper';

export interface VoiceToTextProvider {
  convertVoiceToText(fileId: string, bot: Telegraf): Promise<string>;
}

export async function getVoiceFile(fileId: string, bot: Telegraf): Promise<string> {
  const workDir = './tmp';
  if (!existsSync(workDir)) {
    mkdirSync(workDir);
  }
  const oggDestination = `${workDir}/${fileId}.ogg`;
  const wavDestination = `${workDir}/${fileId}.mp3`;
  const fileLink = await bot.telegram.getFileLink(fileId);

  const writestream = createWriteStream(oggDestination);
  const response = await axios({
    method: 'GET',
    url: fileLink.toString(),
    responseType: 'stream',
  });

  await new Promise(async (resolve, reject) => {
    response.data.pipe(writestream);
    writestream.on('finish', resolve);
    writestream.on('error', reject);
  });

  await new Promise((resolve, reject) => {
    ffmpeg(oggDestination)
      .format('mp3')
      .on('error', (err) => reject(err))
      .on('end', () => {
        console.log('Conversion finished!');
        resolve(void 0);
      })
      .save(wavDestination);
  });

  return wavDestination;
}
export const getVoiceToTextClient = (): VoiceToTextProvider => {
  switch (process.env.VOICE_TO_TEXT_PROVIDER) {
    default:
      return new Whisper();
  }
}
import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import fs from 'fs';
import { exportMessageHistoryToCsv } from './user/MessageHistoryExporter';
import { initializeBot } from './TelegramBot/Bot';
import logger from './utils/logger';

initializeBot().catch(logger.error);

const app = express();

app.get('/', (req: Request, res: Response) => {
  res.send(`Hello, I'm alive!`);
});

// Middleware to secure the endpoint
app.get('/export', async (req: Request, res: Response) => {
  try {
    const csvPath = await exportMessageHistoryToCsv();
    res.download(csvPath, (err) => {
      if (err) {
        logger.error('Error sending the file:', err);
        res.status(500).send('Error exporting message history.');
      } else {
        logger.info('File sent successfully.');
        fs.unlinkSync(csvPath); // Delete the file after sending
      }
    });
  } catch (error) {
    res.status(500).send('Error exporting message history.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

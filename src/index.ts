import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import fs from 'fs';
import { exportMessageHistoryToCsv } from './user/MessageHistoryExporter';
import logger from './utils/logger';
import { setupScheduleMessageRoutes } from './TelegramBot/ScheduledMessages';
const app = express();

(async () => {
  try {
    setupScheduleMessageRoutes(app);
  } catch (error) {
    logger.error('Error initializing:', error);
  }
})();

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

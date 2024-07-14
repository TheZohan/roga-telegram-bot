import dotenv from 'dotenv';
dotenv.config();
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import { exportMessageHistoryToCsv } from './user/MessageHistoryExporter';
import { initializeBot } from './TelegramBot/Bot';

initializeBot().catch(console.error);

const app = express();

app.get('/', (req: Request, res: Response) => {
  res.send(`Hello, I'm alive!`);
});

// Middleware to secure the endpoint
const secureMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const auth = {
    login: process.env.ADMIN_USER!,
    password: process.env.ADMIN_PASSWORD!,
  };

  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login && password && login === auth.login && password === auth.password) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="401"');
  res.status(401).send('Authentication required.');
};

app.get('/export', async (req: Request, res: Response) => {
  try {
    const csvPath = await exportMessageHistoryToCsv();
    res.download(csvPath, (err) => {
      if (err) {
        console.error('Error sending the file:', err);
        res.status(500).send('Error exporting message history.');
      } else {
        console.log('File sent successfully.');
        fs.unlinkSync(csvPath); // Delete the file after sending
      }
    });
  } catch (error) {
    res.status(500).send('Error exporting message history.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

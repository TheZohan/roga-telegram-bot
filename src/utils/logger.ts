import { createLogger, format, transports } from 'winston';
import * as path from 'path';

const { combine, timestamp, json } = format;

const log_level = process.env.LOG_LEVEL || 'info';
// Create the logger
const logger = createLogger({
  level: log_level, // Set the minimum level to log (info, warn, error, etc.)
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add timestamp to logs
    json(), // Output logs in JSON format for GCP
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(__dirname, '../../logs/error.log'), level: 'error' }), // Log errors to a file
    //new transports.File({ filename: path.join(__dirname, '../../logs/combined.log') }), // Log all messages to a file
  ],
});

// Export the logger so it can be used in other files
export default logger;

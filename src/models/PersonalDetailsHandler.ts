import cron from 'node-cron';
import { PersonalDetails } from '../user/UserProfile';

export function getMissingDetails(
  details: PersonalDetails,
): (keyof PersonalDetails)[] {
  return Object.keys(details).filter(
    (key) => details[key as keyof PersonalDetails] === undefined,
  ) as (keyof PersonalDetails)[];
}

export function generatePrompt(
  missingDetails: (keyof PersonalDetails)[],
): string {
  if (missingDetails.length === 0) {
    return 'All personal details are filled.';
  }

  const questions = missingDetails.map((detail) => {
    switch (detail) {
      case 'firstName':
        return 'What is your first name?';
      case 'lastName':
        return 'What is your last name?';
      case 'age':
        return 'How old are you?';
      case 'gender':
        return 'What is your gender?';
      case 'maritalStatus':
        return 'What is your marital status?';
      case 'location':
        return 'Where are you located?';
      default:
        return '';
    }
  });

  return questions.join(' ');
}

export function askForPermission(): string {
  return 'Are you willing to provide your personal details? This is only for app usage.';
}

export function setUpDailyReminder() {
  cron.schedule('0 0 * * *', () => {
    // This cron expression runs every day at midnight
    console.log(
      'Reminder: Please provide your personal details for app usage.',
    );
  });
}

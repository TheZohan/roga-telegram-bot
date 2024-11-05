import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import logger from '../utils/logger';

export enum StepsDefinition {
  greeting = 'Greeting',
  askForTheUserName = 'AskForTheUserName',
  discoverUserGoal = 'DiscoverUserGoal',
  continueConversation = 'ContinueConversation',
}

export interface Step {
  id: string;
  prompt: string;
  description: string;
  finishCriteria: string;
  nextStep: string;
}

// Load prompts from a YAML file
const loadSteps = () => {
  const promptsPath = path.join(__dirname, 'steps.yaml');
  const rawData = fs.readFileSync(promptsPath, 'utf-8');
  return parse(rawData);
};

export class StepManager {
  private steps: { [key: string]: Step };

  constructor() {
    const stepList = loadSteps() as Step[];
    this.steps = stepList.reduce(
      (acc, step) => {
        acc[step.id] = step;
        return acc;
      },
      {} as { [key: string]: Step },
    );
  }

  getStep = (stepId: string): Step => {
    try {
      const step = this.steps[stepId];
      if (!step) {
        throw new Error(`Step with id '${stepId}' not found`);
      }
      return step;
    } catch (error) {
      logger.error(`Error retrieving step: ${error}`);
      throw error; // Re-throw the error for the caller to handle
    }
  };
}

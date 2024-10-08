import stepsData from './steps.json';

export interface Step {
  id: string;
  promptName: string;
  description: string;
  finishCriteria: string;
}

export class StepManager {
  private steps: Step[];
  private currentStepIndex: number;

  constructor() {
    this.steps = stepsData as Step[];
    this.currentStepIndex = 0;
  }

  getCurrentStep(): Step {
    return this.steps[this.currentStepIndex];
  }

  advanceStep(): void {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
    }
  }

  isLastStep(): boolean {
    return this.currentStepIndex === this.steps.length - 1;
  }

  resetSteps(): void {
    this.currentStepIndex = 0;
  }
}

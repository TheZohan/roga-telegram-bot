import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import Handlebars from 'handlebars';

// Load prompts from a YAML file
const loadPrompts = () => {
  const promptsPath = path.join(__dirname, 'prompts.yaml');
  const rawData = fs.readFileSync(promptsPath, 'utf-8');
  return parse(rawData);
};

const prompts = loadPrompts();

// Function to get a prompt with variables replaced
export const getPrompt = (action: string, variables: Record<string, any>): string => {
  const promptTemplate = prompts[action];
  if (!promptTemplate) {
    throw new Error(`Prompt for action "${action}" not found`);
  }

  const template = Handlebars.compile(promptTemplate);
  console.log(`Prompt ${action}: ${template(variables)}`);
  return template(variables);
};
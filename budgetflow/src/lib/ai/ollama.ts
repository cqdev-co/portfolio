import { Ollama } from 'ollama';

const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
const model = process.env.OLLAMA_MODEL || 'llama3.2';

export const ollama = new Ollama({ host });
export const AI_MODEL = model;

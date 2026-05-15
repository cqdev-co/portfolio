import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ModelsConfig, Task } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the tools/local-ai-eval/ workspace root. */
export const ROOT = join(__dirname, '..');

export async function loadModelsConfig(): Promise<ModelsConfig> {
  const raw = await readFile(join(ROOT, 'models.config.json'), 'utf8');
  const parsed = JSON.parse(raw) as ModelsConfig;
  if (!parsed.baseUrl) parsed.baseUrl = 'http://localhost:11434';
  if (!parsed.runsPerTask) parsed.runsPerTask = 3;
  if (!parsed.requestTimeoutMs) parsed.requestTimeoutMs = 180000;
  return parsed;
}

export async function loadTasks(): Promise<Task[]> {
  const tasksDir = join(ROOT, 'tasks');
  const entries = await readdir(tasksDir);
  const files = entries.filter((f) => f.endsWith('.json')).sort();
  const tasks: Task[] = [];
  for (const file of files) {
    const raw = await readFile(join(tasksDir, file), 'utf8');
    tasks.push(JSON.parse(raw) as Task);
  }
  return tasks;
}

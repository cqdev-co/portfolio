'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type SuggestedAction = {
  label: string;
  prompt: string;
};

const suggestedActions: SuggestedAction[] = [
  {
    label: 'Explain a complex topic',
    prompt: 'Can you explain quantum computing in simple terms?',
  },
  {
    label: 'Help me write code',
    prompt: 'Help me write a function to sort an array in JavaScript',
  },
  {
    label: 'Brainstorm ideas',
    prompt: 'Give me 5 creative project ideas for learning programming',
  },
  {
    label: 'Summarize something',
    prompt: 'What are the key differences between REST and GraphQL?',
  },
];

type ChatGreetingProps = {
  onSuggestionClick: (prompt: string) => void;
};

export function ChatGreeting({ onSuggestionClick }: ChatGreetingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-6"
      >
        <h2 className="text-lg font-semibold mb-1">Hello there! 👋</h2>
        <p className="text-sm text-muted-foreground">
          How can I help you today?
        </p>
      </motion.div>

      <div className="grid w-full gap-2 sm:grid-cols-2">
        {suggestedActions.map((action, index) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.05 }}
            onClick={() => onSuggestionClick(action.prompt)}
            className={cn(
              'h-auto w-full whitespace-normal p-3 text-left',
              'rounded-xl border bg-background',
              'text-xs text-muted-foreground',
              'transition-colors duration-200',
              'hover:bg-muted hover:text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
          >
            {action.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

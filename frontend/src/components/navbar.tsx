'use client';

import { Dock, DockIcon } from '@/components/magicui/dock';
import { ModeToggle } from '@/components/mode-toggle';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DATA } from '@/data/resume';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { SparklesIcon } from '@/components/chat/chat-icons';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const isChatOpen = pathname === '/chat';

  // Toggle behaviour: open if closed, close (router.back) if already open.
  const handleChatClick = useCallback(() => {
    if (isChatOpen) {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    } else {
      router.push('/chat');
    }
  }, [isChatOpen, router]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mb-4 flex origin-bottom h-full max-h-14 justify-center">
      <div className="fixed bottom-0 inset-x-0 h-16 w-full bg-background to-transparent backdrop-blur-lg [-webkit-mask-image:linear-gradient(to_top,black,transparent)] dark:bg-background"></div>
      <Dock className="z-50 pointer-events-auto flex min-h-full h-full items-center px-1 bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)] transform-gpu dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset] ">
        {DATA.navbar.map((item) => (
          <DockIcon key={item.href}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon' }),
                    'size-12'
                  )}
                >
                  <item.icon className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          </DockIcon>
        ))}
        <Separator orientation="vertical" className="h-full" />
        {Object.entries(DATA.contact.social)
          .filter(([social]) => social)
          .map(([name, social]) => (
            <DockIcon key={name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={social.url}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'icon' }),
                      'size-12'
                    )}
                  >
                    <social.icon className="size-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{name}</p>
                </TooltipContent>
              </Tooltip>
            </DockIcon>
          ))}
        <Separator orientation="vertical" className="h-full py-2" />
        <DockIcon>
          <Tooltip>
            <TooltipTrigger asChild>
              <ModeToggle />
            </TooltipTrigger>
            <TooltipContent>
              <p>Theme</p>
            </TooltipContent>
          </Tooltip>
        </DockIcon>
        <DockIcon>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleChatClick}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  // `size-12` keeps the touch/click target consistent
                  // with the other dock icons. The active state used
                  // to inherit `rounded-md` from `buttonVariants`,
                  // which made the highlight a 48 × 48 rounded-square
                  // at the dock's *last* slot — its corners visibly
                  // clashed with the dock's pill-shaped container.
                  // We override to `rounded-full` so the active
                  // highlight is a circle that nests cleanly inside
                  // the dock at any slot.
                  'size-12 cursor-pointer rounded-full transition-colors',
                  isChatOpen && 'bg-muted text-foreground'
                )}
                aria-label={isChatOpen ? 'Close AI Chat' : 'Open AI Chat'}
                aria-pressed={isChatOpen}
              >
                <SparklesIcon size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isChatOpen ? 'Close chat (Esc)' : 'AI Chat (⌘K)'}</p>
            </TooltipContent>
          </Tooltip>
        </DockIcon>
      </Dock>
    </div>
  );
}

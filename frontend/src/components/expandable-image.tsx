'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Plus } from 'lucide-react';

type ExpandableImageProps = Omit<React.ComponentProps<typeof Image>, 'alt'> & {
  alt: string;
  expandable?: boolean;
};

export function ExpandableImage({
  expandable = true,
  className,
  ...props
}: ExpandableImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!expandable) {
    return (
      <span className="block my-8 w-full">
        <Image
          {...props}
          alt={props.alt}
          width={props.width || 1200}
          height={props.height || 630}
          className={cn('w-full h-auto object-contain rounded-lg', className)}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
        />
      </span>
    );
  }

  return (
    <span className="block my-8 w-full">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <span className="relative group cursor-pointer inline-block w-full">
            <Image
              {...props}
              alt={props.alt}
              width={props.width || 1200}
              height={props.height || 630}
              className={cn(
                'w-full h-auto object-contain rounded-lg block',
                className
              )}
              style={{
                width: '100%',
                height: 'auto',
              }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            />
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="bg-background/90 hover:bg-background text-foreground rounded-full p-2 shadow-sm border border-border/50">
                <Plus className="h-5 w-5" />
              </span>
            </span>
          </span>
        </DialogTrigger>
        <DialogContent className="max-w-none max-h-none w-screen h-screen p-0 m-0 border-0 bg-transparent shadow-none flex items-center justify-center">
          <DialogTitle className="sr-only">
            Expanded view of {props.alt}
          </DialogTitle>
          <div className="relative flex items-center justify-center w-full h-full p-8">
            <div className="relative">
              <Image
                src={props.src}
                alt={props.alt}
                width={props.width || 1200}
                height={props.height || 630}
                className="rounded-lg max-w-full max-h-full object-contain"
                style={{
                  maxWidth: 'calc(100vw - 8rem)',
                  maxHeight: 'calc(100vh - 8rem)',
                  width: 'auto',
                  height: 'auto',
                }}
              />
              <button
                onClick={() => setIsOpen(false)}
                className="absolute -top-2 -right-2 z-50 bg-background/90 hover:bg-background text-foreground rounded-full p-1.5 transition-colors duration-200 shadow-md border border-border/50"
                aria-label="Close image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}

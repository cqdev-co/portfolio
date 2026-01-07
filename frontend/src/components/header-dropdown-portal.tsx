'use client';

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

interface HeaderPortalProps {
  children: React.ReactNode;
}

// Module-level singleton for the portal element
let portalElement: HTMLElement | null = null;

function getOrCreatePortalElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  if (!portalElement) {
    let element = document.getElementById('header-dropdown-portal');

    if (!element) {
      element = document.createElement('div');
      element.id = 'header-dropdown-portal';
      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.width = '100%';
      element.style.height = '100%';
      element.style.pointerEvents = 'none';
      element.style.zIndex = '9999';
      document.body.appendChild(element);
    }

    portalElement = element;
  }

  return portalElement;
}

// External store for tracking client-side rendering
const subscribeToNothing = () => () => {};
const getSnapshot = () => getOrCreatePortalElement();
const getServerSnapshot = () => null;

export function HeaderDropdownPortal({ children }: HeaderPortalProps) {
  // Use useSyncExternalStore to get portal element with SSR support
  const element = useSyncExternalStore(
    subscribeToNothing,
    getSnapshot,
    getServerSnapshot
  );

  // Don't render anything until the portal element is available
  if (!element) return null;

  // Render the children into the portal
  return createPortal(
    <div className="pointer-events-auto">{children}</div>,
    element
  );
}

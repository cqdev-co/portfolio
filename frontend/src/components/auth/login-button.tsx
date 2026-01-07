'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from './auth-provider';
import { LogOut, Settings, TrendingUp } from 'lucide-react';
import { useHeaderDropdown } from './use-header-dropdown';
import { useRouter } from 'next/navigation';
import React from 'react';

export function LoginButton() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const { isOpen, toggle, close, triggerRef } = useHeaderDropdown();
  const router = useRouter();
  const [avatarError, setAvatarError] = React.useState(false);

  // Reset avatar error when user changes
  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.id]);

  // Get avatar URL with fallback
  const getAvatarSrc = () => {
    if (avatarError) return null; // Force fallback if there was an error
    return user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  };

  if (!user) {
    return (
      <Button onClick={() => signInWithGoogle()} variant="outline" size="sm">
        Sign In
      </Button>
    );
  }

  return (
    <div className="relative">
      <div ref={triggerRef}>
        <Avatar
          className="size-8 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={toggle}
        >
          <AvatarImage
            src={getAvatarSrc()}
            alt={
              user.user_metadata?.name ||
              user.user_metadata?.full_name ||
              'User avatar'
            }
            onError={() => setAvatarError(true)}
          />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
            {(
              user.user_metadata?.name?.[0] ||
              user.user_metadata?.full_name?.[0] ||
              user.email?.[0] ||
              'U'
            ).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Simple dropdown positioned relative to avatar */}
      {isOpen && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                close();
              }
            }}
          />

          {/* Dropdown content */}
          <div
            className="absolute right-0 top-full mt-2 z-50 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User info */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user.user_metadata?.full_name ||
                  user.user_metadata?.name ||
                  'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>

            {/* Positions button */}
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  router.push('/positions');
                  close();
                } catch {
                  close();
                }
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 
                dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
                flex items-center gap-2"
            >
              <TrendingUp className="size-4" />
              <span>Positions</span>
            </button>

            {/* Settings button */}
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  router.push('/settings');
                  close();
                } catch {
                  close();
                }
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 
                dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
                flex items-center gap-2"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </button>

            {/* Sign out button */}
            <button
              onMouseDown={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  await signOut();
                  close();
                } catch {
                  // Sign out failed, but still close dropdown for better UX
                  close();
                }
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

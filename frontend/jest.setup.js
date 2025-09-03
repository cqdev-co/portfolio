// Jest setup for DOM testing
require('@testing-library/jest-dom')

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  AnimatePresence: ({ children }) => children,
  motion: {
    div: ({ children, ...props }) => {
      const { animate, initial, exit, transition, whileHover, whileTap, drag, ...rest } = props
      return { type: 'div', props: rest, children }
    },
  },
  useMotionValue: () => ({ get: () => 0, set: jest.fn() }),
  useTransform: () => ({ get: () => 0 }),
  useSpring: () => ({ get: () => 0 }),
}))

'use client'

import { useState, useEffect, useRef } from 'react'

export function useHeaderDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  
  const toggle = () => setIsOpen(!isOpen)
  const close = () => setIsOpen(false)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        close()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  return {
    isOpen,
    toggle,
    close,
    triggerRef
  }
}

'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface HeaderPortalProps {
  children: React.ReactNode
}

export function HeaderDropdownPortal({ children }: HeaderPortalProps) {
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  
  useEffect(() => {
    // Check if the portal element already exists
    let element = document.getElementById('header-dropdown-portal')
    
    // If it doesn't exist, create it
    if (!element) {
      element = document.createElement('div')
      element.id = 'header-dropdown-portal'
      element.style.position = 'fixed'
      element.style.top = '0'
      element.style.left = '0'
      element.style.width = '100%'
      element.style.height = '100%'
      element.style.pointerEvents = 'none'
      element.style.zIndex = '9999'
      document.body.appendChild(element)
    }
    
    setPortalElement(element)
    
    // Clean up function
    return () => {
      // We don't remove the element on unmount as it might be used by other components
    }
  }, [])
  
  // Don't render anything until the portal element is available
  if (!portalElement) return null
  
  // Render the children into the portal
  return createPortal(
    <div className="pointer-events-auto">{children}</div>,
    portalElement
  )
}

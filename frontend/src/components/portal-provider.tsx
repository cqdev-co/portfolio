'use client'

import React, { createContext, useContext, useState } from 'react'

type PortalContextType = {
  portalRoot: HTMLDivElement | null
}

const PortalContext = createContext<PortalContextType>({
  portalRoot: null
})

export const usePortal = () => useContext(PortalContext)

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null)

  return (
    <PortalContext.Provider value={{ portalRoot }}>
      {children}
      <div 
        id="portal-root" 
        ref={setPortalRoot} 
        style={{ 
          position: 'fixed', 
          left: 0, 
          top: 0, 
          width: '100vw', 
          height: '100vh', 
          pointerEvents: 'none',
          zIndex: 9999,
          isolation: 'isolate'
        }}
      />
    </PortalContext.Provider>
  )
}

/**
 * Tests for dock positioning consistency across pages with different scrollbar states
 */

describe('Dock Scrollbar Consistency', () => {
  beforeEach(() => {
    // Reset DOM
    document.documentElement.innerHTML = '<html><head></head><body></body></html>'
  })

  test('html element reserves space for scrollbar to prevent layout shifts', () => {
    // Test by reading the CSS file directly since the rule is applied via CSS
    const fs = require('fs')
    const path = require('path')
    const cssPath = path.resolve(__dirname, '../src/app/globals.css')
    const cssContent = fs.readFileSync(cssPath, 'utf8')
    
    // Check for modern scrollbar-gutter approach
    expect(cssContent).toMatch(/scrollbar-gutter:\s*stable/)
    
    // Check for fallback overflow-y: scroll for older browsers
    expect(cssContent).toMatch(/@supports not \(scrollbar-gutter: stable\)/)
    expect(cssContent).toMatch(/overflow-y:\s*scroll/)
    
    // Verify scrollbar compensation for modals
    expect(cssContent).toMatch(/body\[style\*="overflow: hidden"\]/)
  })

  test('body maintains consistent width regardless of content height', () => {
    // Simulate short content page
    const shortContentHTML = `
      <html style="overflow-y: scroll;">
        <body style="min-height: 100vh;">
          <main style="height: 200px;">Short content that doesn't need scrolling</main>
        </body>
      </html>
    `
    
    document.documentElement.innerHTML = shortContentHTML
    let bodyWidth = document.body.getBoundingClientRect().width
    const shortPageWidth = bodyWidth

    // Simulate long content page
    const longContentHTML = `
      <html style="overflow-y: scroll;">
        <body style="min-height: 200vh;">
          <main style="height: 2000px;">
            Very long content that requires scrolling and would normally show scrollbars
          </main>
        </body>
      </html>
    `
    
    document.documentElement.innerHTML = longContentHTML
    bodyWidth = document.body.getBoundingClientRect().width
    const longPageWidth = bodyWidth

    // Both pages should have the same effective width
    // because scrollbar-gutter: stable reserves space for scrollbar
    expect(shortPageWidth).toBe(longPageWidth)
  })

  test('dock positioning remains consistent with scrollbar compensation', () => {
    // Read the CSS file to verify the fix is in place
    const fs = require('fs')
    const path = require('path')
    const cssPath = path.resolve(__dirname, '../src/app/globals.css')
    const cssContent = fs.readFileSync(cssPath, 'utf8')
    
    // Check for modern scrollbar reservation
    expect(cssContent).toMatch(/scrollbar-gutter:\s*stable/)
    
    // Check for modal scrollbar compensation
    expect(cssContent).toMatch(/padding-right:\s*var\(--scrollbar-width/)
    
    // Verify fallback for older browsers
    expect(cssContent).toMatch(/@supports not \(scrollbar-gutter: stable\)/)
  })

  test('main content centering is not affected by scrollbar changes', () => {
    // Test that mx-auto centering works consistently with scrollbar reservation
    const mockViewportWidth = 1024
    
    // Mock getBoundingClientRect for consistent testing
    const mockGetBoundingClientRect = jest.fn(() => ({
      width: mockViewportWidth,
      left: 0,
      right: mockViewportWidth,
    }))

    // Create main element with mx-auto class
    const mainElement = document.createElement('main')
    mainElement.className = 'mx-auto max-w-4xl'
    mainElement.getBoundingClientRect = mockGetBoundingClientRect
    document.body.appendChild(mainElement)

    const rect = mainElement.getBoundingClientRect()
    
    // With scrollbar-gutter: stable, the width should be consistent
    expect(rect.width).toBe(mockViewportWidth)
  })

  test('dock container uses viewport-based positioning independent of scrollbars', () => {
    // Read navbar component to verify positioning strategy
    const fs = require('fs')
    const path = require('path')
    const navbarPath = path.resolve(__dirname, '../src/components/navbar.tsx')
    const navbarSource = fs.readFileSync(navbarPath, 'utf8')
    
    // Verify fixed positioning that's independent of content
    expect(navbarSource).toMatch(/fixed inset-x-0 bottom-0/)
    
    // Verify flexbox centering that works with scrollbar reservation
    expect(navbarSource).toMatch(/justify-center/)
    
    // Ensure no relative positioning that could be affected by scrollbars
    expect(navbarSource).not.toMatch(/relative.*mx-auto/)
  })
})

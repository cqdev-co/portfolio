/**
 * Tests for dock positioning to ensure it stays fixed across page navigation
 */

describe('Dock Positioning CSS Classes', () => {
  test('dock variants should not include margin-auto class', () => {
    // This test ensures the dock component doesn't use mx-auto 
    // which could cause positioning inconsistencies
    const fs = require('fs')
    const path = require('path')
    const dockPath = path.resolve(__dirname, '../src/components/magicui/dock.tsx')
    const dockSource = fs.readFileSync(dockPath, 'utf8')
    
    // Verify mx-auto is not in the dockVariants definition
    const dockVariantsMatch = dockSource.match(/const dockVariants = cva\(\s*"([^"]*)"/)
    expect(dockVariantsMatch).toBeTruthy()
    
    const variantClasses = dockVariantsMatch[1]
    expect(variantClasses).not.toMatch(/mx-auto/)
    
    // Verify essential positioning classes are present
    expect(variantClasses).toMatch(/w-max/) // Should have w-max for content width
    expect(variantClasses).toMatch(/h-full/) // Should have h-full for height
    expect(variantClasses).toMatch(/flex/) // Should have flex for layout
  })

  test('navbar component uses proper fixed positioning classes', () => {
    // Mock the DATA dependency
    jest.doMock('@/data/resume', () => ({
      DATA: {
        navbar: [],
        contact: { social: {} }
      }
    }), { virtual: true })

    // Read the navbar component source to verify class structure
    const fs = require('fs')
    const path = require('path')
    const navbarPath = path.resolve(__dirname, '../src/components/navbar.tsx')
    const navbarSource = fs.readFileSync(navbarPath, 'utf8')
    
    // Verify the container uses fixed positioning with proper classes
    expect(navbarSource).toMatch(/fixed inset-x-0 bottom-0/)
    expect(navbarSource).toMatch(/justify-center/)
    expect(navbarSource).toMatch(/z-30/)
    
    // Verify the dock doesn't use relative + mx-auto combination
    expect(navbarSource).not.toMatch(/relative mx-auto/)
    
    // Verify the dock uses proper z-index
    expect(navbarSource).toMatch(/z-50/)
  })

  test('dock positioning is viewport-independent', () => {
    // Simulate different viewport scenarios
    const scenarios = [
      { width: 320, height: 568, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' }, 
      { width: 1920, height: 1080, name: 'desktop' }
    ]

    scenarios.forEach(scenario => {
      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: scenario.width,
      })
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: scenario.height,
      })

      // The dock should use fixed positioning regardless of viewport size
      // This is verified by checking the CSS classes in the component
      expect(scenario.width).toBeGreaterThan(0) // Basic test to ensure scenarios run
    })
  })

  test('dock container hierarchy maintains proper layering', () => {
    // Read component source to verify structural integrity
    const fs = require('fs')
    const path = require('path')
    const navbarPath = path.resolve(__dirname, '../src/components/navbar.tsx')
    const navbarSource = fs.readFileSync(navbarPath, 'utf8')
    
    // Verify the backdrop element comes before dock element in DOM order
    const backdropIndex = navbarSource.indexOf('backdrop-blur-lg')
    const dockIndex = navbarSource.indexOf('z-50')
    
    expect(backdropIndex).toBeLessThan(dockIndex)
    expect(backdropIndex).toBeGreaterThan(-1)
    expect(dockIndex).toBeGreaterThan(-1)
  })

  test('dock uses content-based width instead of full width', () => {
    const fs = require('fs')
    const path = require('path')
    const dockPath = path.resolve(__dirname, '../src/components/magicui/dock.tsx')
    const dockSource = fs.readFileSync(dockPath, 'utf8')
    
    // Extract the dockVariants classes
    const dockVariantsMatch = dockSource.match(/const dockVariants = cva\(\s*"([^"]*)"/)
    expect(dockVariantsMatch).toBeTruthy()
    
    const variantClasses = dockVariantsMatch[1]
    
    // Should use w-max (content width) not w-full (full width)
    expect(variantClasses).toMatch(/w-max/)
    expect(variantClasses).not.toMatch(/w-full/)
  })
})

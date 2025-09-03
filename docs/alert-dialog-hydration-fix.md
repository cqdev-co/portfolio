# Alert Dialog Hydration Error Fix

## Issue Description

When clicking the "Delete my Account" button in the settings page, a hydration error was occurring with the following message:

```
In HTML, <div> cannot be a descendant of <p>.
This will cause a hydration error.
```

## Root Cause

The error was caused by invalid HTML structure in the `ProfileTab` component (`src/components/settings/profile-tab.tsx`). The `AlertDialogDescription` component from Radix UI renders as a `<p>` tag by default, but we were placing block-level elements (`<div>` and `<ul>`) inside it, which is invalid HTML.

### Problematic Code Structure

```tsx
<AlertDialogDescription className="space-y-2">
  <div>  {/* ❌ Block element inside <p> */}
    Are you absolutely sure you want to delete your account? This action will:
  </div>
  <ul className="list-disc list-inside space-y-1 text-sm">  {/* ❌ Block element inside <p> */}
    <li>Permanently delete all your account data</li>
    <li>Remove all your settings and preferences</li>
    <li>Cancel any active subscriptions</li>
    <li>Sign you out of all devices</li>
  </ul>
  <div className="font-medium text-destructive">  {/* ❌ Block element inside <p> */}
    This action cannot be undone.
  </div>
</AlertDialogDescription>
```

## Solution

Restructured the dialog content to separate the description from the detailed content:

1. **Simplified AlertDialogDescription**: Keep only inline text content in the description
2. **Moved block elements outside**: Created a separate `<div>` container for the list and additional content
3. **Maintained styling**: Preserved the visual appearance while fixing the HTML structure

### Fixed Code Structure

```tsx
<AlertDialogHeader>
  <AlertDialogTitle className="flex items-center gap-2">
    <AlertTriangle className="h-5 w-5 text-destructive" />
    Delete Account
  </AlertDialogTitle>
  <AlertDialogDescription>
    Are you absolutely sure you want to delete your account?
  </AlertDialogDescription>
</AlertDialogHeader>

<div className="space-y-4">  {/* ✅ Separate container for block elements */}
  <div>
    <p className="text-sm text-muted-foreground mb-3">
      This action will:
    </p>
    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
      <li>Permanently delete all your account data</li>
      <li>Remove all your settings and preferences</li>
      <li>Cancel any active subscriptions</li>
      <li>Sign you out of all devices</li>
    </ul>
  </div>
  <p className="font-medium text-destructive text-sm">
    This action cannot be undone.
  </p>
</div>
```

## Additional Fix: Scrollbar Layout Shift

### Issue
When the AlertDialog opens, it disables body scrolling which causes the scrollbar to disappear, making the content shift left by the scrollbar width (~15-17px).

### Solution
Implemented scrollbar width compensation using CSS variables and dynamic padding:

1. **Calculate scrollbar width** in `layout.tsx` and set as CSS variable
2. **Reserve scrollbar space** in `globals.css` when body overflow is hidden
3. **Use modern CSS properties** like `scrollbar-gutter: stable` for supported browsers

### Implementation Details

#### Layout Script (layout.tsx)
```javascript
// Calculate scrollbar width and set as CSS variable
(function() {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
})();
```

#### CSS Compensation (globals.css)
```css
html {
  /* Modern browsers: Reserve space for scrollbar */
  scrollbar-gutter: stable;
}

/* Fallback for browsers that don't support scrollbar-gutter */
@supports not (scrollbar-gutter: stable) {
  html {
    overflow-y: scroll;
  }
}

/* Compensate for scrollbar when body overflow is hidden (modals open) */
body[style*="overflow: hidden"] {
  padding-right: var(--scrollbar-width, 0px);
}
```

## Files Modified

- `frontend/src/components/settings/profile-tab.tsx`: Fixed the AlertDialog content structure
- `frontend/src/app/layout.tsx`: Added script to calculate scrollbar width
- `frontend/src/app/globals.css`: Added scrollbar compensation CSS rules
- `frontend/tests/dock-scrollbar-positioning.test.js`: Updated tests to match new implementation

## Technical Details

### Why This Happens

- Radix UI's `AlertDialogDescription` component uses `AlertDialogPrimitive.Description`
- This primitive renders as a `<p>` element by default
- HTML specification doesn't allow block-level elements (`<div>`, `<ul>`, etc.) inside `<p>` elements
- Next.js hydration process validates HTML structure and throws errors for invalid nesting

### Best Practices

1. **Keep AlertDialogDescription simple**: Use only inline text content
2. **Use separate containers**: Place complex content outside the description in its own container
3. **Validate HTML structure**: Ensure block elements are not nested inside inline elements
4. **Test hydration**: Always test dialog interactions to catch hydration errors early
5. **Prevent layout shifts**: Implement scrollbar compensation for modal dialogs

## Testing

After applying this fix:
1. Navigate to Settings page
2. Click "Delete my Account" button
3. Verify no console errors appear
4. Confirm dialog displays correctly with proper styling
5. Verify no layout shift occurs when dialog opens/closes

## Related Documentation

- [Next.js Hydration Errors](https://nextjs.org/docs/messages/react-hydration-error)
- [Radix UI Alert Dialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog)
- [HTML Content Categories](https://developer.mozilla.org/en-US/docs/Web/HTML/Content_categories)
- [CSS scrollbar-gutter Property](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter)

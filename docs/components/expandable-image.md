# Expandable Image Component

## Overview

The `ExpandableImage` component provides click-to-expand functionality for images in blog posts. When users click on an image, it opens in a full-screen modal dialog for better viewing.

## Features

- **Click to Expand**: Images can be clicked to open in a modal
- **Hover Effects**: Visual feedback with zoom icon overlay on hover
- **Responsive**: Works on all screen sizes
- **Keyboard Accessible**: Supports ESC key to close modal
- **Smooth Animations**: Uses Radix UI Dialog with smooth transitions
- **Optional**: Can be disabled per image if needed

## Usage

### In MDX Files

Images in MDX files automatically use the expandable functionality:

```markdown
![Architecture Diagram](/images/event-gateway-architecture.png)
```

### Direct Component Usage

```tsx
import { ExpandableImage } from "@/components/expandable-image";

<ExpandableImage
  src="/images/example.png"
  alt="Example image"
  width={800}
  height={600}
  expandable={true} // optional, defaults to true
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | - | Image source URL |
| `alt` | `string` | - | Alt text for accessibility |
| `width` | `number` | `1200` | Image width |
| `height` | `number` | `630` | Image height |
| `expandable` | `boolean` | `true` | Whether image can be expanded |
| `className` | `string` | - | Additional CSS classes |

## Implementation Details

### Components Used

- **Radix UI Dialog**: Provides accessible modal functionality
- **Next.js Image**: Optimized image loading and display
- **Lucide React Icons**: Zoom and close icons
- **Tailwind CSS**: Styling and animations

### HTML Structure

The component uses `<span>` elements with `display: block` styling instead of `<div>` elements for the wrapper. This is critical for avoiding hydration errors when the component is used within markdown content where images are automatically wrapped in `<p>` tags.

**Why this matters:**
- Markdown parsers (like react-markdown) automatically wrap images in `<p>` tags
- HTML spec doesn't allow `<div>` elements inside `<p>` tags
- Using `<span className="block">` provides block-level styling while remaining valid within `<p>` tags
- Prevents React hydration errors: `<p> cannot contain a nested <div>`

### Modal Features

- **Full Screen**: Modal takes up 95% of viewport
- **Centered**: Image is centered in the modal
- **Close Button**: X button in top-right corner
- **Click Outside**: Click outside image to close
- **ESC Key**: Press ESC to close modal
- **Responsive**: Adapts to different screen sizes

### Hover State

- **Overlay**: Semi-transparent overlay appears on hover
- **Zoom Icon**: Zoom-in icon indicates clickable functionality
- **Smooth Transition**: 200ms transition for smooth UX

## Styling

The component uses Tailwind CSS classes for styling:

```css
/* Base image container */
.my-6.overflow-hidden.rounded-lg.border.bg-secondary/20.max-w-full

/* Hover overlay */
.absolute.inset-0.flex.items-center.justify-center.opacity-0.group-hover:opacity-100

/* Modal content */
.max-w-[95vw].max-h-[95vh].p-0.border-0.bg-transparent.shadow-none
```

## Accessibility

- **Alt Text**: Required alt prop for screen readers
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Proper focus handling in modal
- **ARIA Labels**: Close button has proper aria-label
- **Screen Reader**: Modal content is announced to screen readers

## Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Chrome Mobile
- **Responsive**: Works on all screen sizes
- **Touch**: Touch-friendly on mobile devices

## Performance

- **Lazy Loading**: Images use Next.js optimized loading
- **Size Optimization**: Responsive image sizes
- **Minimal Bundle**: Only loads when image is clicked
- **Smooth Animations**: Hardware-accelerated transitions

## Customization

### Disable Expansion

```tsx
<ExpandableImage
  src="/images/example.png"
  alt="Example"
  expandable={false}
/>
```

### Custom Styling

```tsx
<ExpandableImage
  src="/images/example.png"
  alt="Example"
  className="custom-image-class"
/>
```

### Different Sizes

```tsx
<ExpandableImage
  src="/images/example.png"
  alt="Example"
  width={600}
  height={400}
/>
```

## Integration

The component is automatically integrated into the MDX rendering pipeline:

1. **MDX Components**: `globalComponents` in `mdx.tsx` maps `Image` to `RoundedImage`
2. **RoundedImage**: Wrapper that uses `ExpandableImage`
3. **Blog Posts**: All images in blog posts automatically get expand functionality

## Troubleshooting

### Hydration Errors

If you encounter hydration errors like:
```
Error: Hydration failed because the server rendered HTML didn't match the client.
<p> cannot contain a nested <div>
```

**Solution:** The component has been fixed to use `<span className="block">` instead of `<div>` elements for the wrapper. This ensures valid HTML when the component is used within markdown content where images are automatically wrapped in `<p>` tags.

**Key Points:**
- Never wrap the component in a `<div>` when it might be inside a `<p>` tag
- The `block` class provides `display: block` behavior while maintaining valid HTML
- This is especially important for MDX/markdown integration

## Future Enhancements

Potential improvements for the component:

- **Image Gallery**: Navigate between multiple images
- **Zoom Controls**: Zoom in/out within the modal
- **Download Option**: Allow users to download images
- **Share Functionality**: Share image links
- **Captions**: Support for image captions in modal

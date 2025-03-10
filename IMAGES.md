# Images for the Portfolio

## Adding Your Images

The portfolio is looking for the following images to display correctly:

1. **Header Background GIF**
   - Path: `/public/images/header.gif`
   - This is the background image for the header section

2. **Profile Photo**
   - Path: `/public/images/headshot.jpg`
   - This is your headshot/profile photo that appears in the header

## How to Add the Images

1. Create a folder called `images` inside the `public` directory if it doesn't already exist:
   ```
   mkdir -p public/images
   ```

2. Copy your images to the correct locations:
   ```
   cp "path/to/your/gif" public/images/header.gif
   cp "path/to/your/headshot" public/images/headshot.jpg
   ```
   
3. Restart the development server to see the changes:
   ```
   bun dev
   ```

## Image Recommendations

- **Header Background GIF**: Should be a high-quality image that is at least 1600px wide
- **Profile Photo**: Should be a square image (ideally at least 400x400px) that will be displayed in a circle

If your images don't appear correctly, check that:
1. The file paths match exactly what's specified above
2. The file names match including letter case
3. The files are actually in the public/images directory 
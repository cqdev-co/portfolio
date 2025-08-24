const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

describe('Line Length Validation', () => {
  const MAX_LINE_LENGTH = 75;
  
  test('MDX files should not have lines longer than 75 characters', async () => {
    // Find all MDX files in the content directory
    const mdxFiles = await glob('content/**/*.mdx', { 
      cwd: path.join(__dirname, '..'),
      absolute: true 
    });
    
    const violations = [];
    
    for (const filePath of mdxFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.length > MAX_LINE_LENGTH) {
          violations.push({
            file: path.relative(path.join(__dirname, '..'), filePath),
            line: index + 1,
            length: line.length,
            content: line.substring(0, 80) + (line.length > 80 ? '...' : '')
          });
        }
      });
    }
    
    if (violations.length > 0) {
      const errorMessage = violations
        .map(v => `${v.file}:${v.line} (${v.length} chars): ${v.content}`)
        .join('\n');
      
      throw new Error(
        `Found ${violations.length} lines longer than ${MAX_LINE_LENGTH} characters:\n${errorMessage}`
      );
    }
  });
  
  test('Code blocks in MDX files should have proper line wrapping', async () => {
    const mdxFiles = await glob('content/**/*.mdx', { 
      cwd: path.join(__dirname, '..'),
      absolute: true 
    });
    
    const codeBlockViolations = [];
    
    for (const filePath of mdxFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      let inCodeBlock = false;
      let codeBlockStart = 0;
      
      lines.forEach((line, index) => {
        if (line.trim().startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true;
            codeBlockStart = index + 1;
          } else {
            inCodeBlock = false;
          }
        } else if (inCodeBlock && line.length > MAX_LINE_LENGTH) {
          codeBlockViolations.push({
            file: path.relative(path.join(__dirname, '..'), filePath),
            line: index + 1,
            codeBlockStart,
            length: line.length,
            content: line.substring(0, 80) + (line.length > 80 ? '...' : '')
          });
        }
      });
    }
    
    if (codeBlockViolations.length > 0) {
      const errorMessage = codeBlockViolations
        .map(v => `${v.file}:${v.line} (code block starting at line ${v.codeBlockStart}, ${v.length} chars): ${v.content}`)
        .join('\n');
      
      throw new Error(
        `Found ${codeBlockViolations.length} code block lines longer than ${MAX_LINE_LENGTH} characters:\n${errorMessage}`
      );
    }
  });
});

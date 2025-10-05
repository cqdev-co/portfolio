#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const MAX_LINE_LENGTH = 75;

/**
 * Smart text wrapper that preserves markdown formatting
 */
function wrapText(text, maxLength = MAX_LINE_LENGTH) {
  if (text.length <= maxLength) return text;
  
  // Don't wrap certain types of lines
  if (text.trim().startsWith('---') || 
      text.trim().startsWith('title:') ||
      text.trim().startsWith('publishedAt:') ||
      text.trim().startsWith('summary:') ||
      text.trim().startsWith('image:') ||
      text.trim().startsWith('tags:') ||
      text.trim().startsWith('![') ||
      text.trim().startsWith('##') ||
      text.trim().startsWith('###') ||
      text.trim().startsWith('####') ||
      false) { // Removed text.includes('](') to allow link wrapping
    
    // Special handling for frontmatter fields that are too long
    if (text.trim().startsWith('title:') || text.trim().startsWith('summary:')) {
      const colonIndex = text.indexOf(':');
      if (colonIndex > 0) {
        const field = text.substring(0, colonIndex + 1);
        const value = text.substring(colonIndex + 1).trim();
        
        // For YAML multiline strings, use the folded scalar style
        if (value.startsWith('"') && value.endsWith('"')) {
          const content = value.slice(1, -1);
          // Use YAML folded scalar (>) for long strings
          return field + ' >\n  ' + wrapPlainText(content, maxLength - 2).split('\n').join('\n  ');
        }
      }
    }
    
    // Special handling for headers that are too long
    if (text.trim().startsWith('###') && text.length > maxLength) {
      // For headers, we can break them at logical points
      const headerMatch = text.match(/^(###\s*)(.*)/);
      if (headerMatch) {
        const prefix = headerMatch[1];
        const content = headerMatch[2];
        
        // Try to break at logical points like colons or parentheses
        if (content.includes(':')) {
          const colonIndex = content.indexOf(':');
          if (prefix.length + colonIndex < maxLength - 5) {
            return prefix + content.substring(0, colonIndex + 1) + '\n' + content.substring(colonIndex + 1).trim();
          }
        }
        
        // Break at parentheses
        if (content.includes('(')) {
          const parenIndex = content.indexOf('(');
          if (prefix.length + parenIndex < maxLength - 5) {
            return prefix + content.substring(0, parenIndex).trim() + '\n' + content.substring(parenIndex);
          }
        }
      }
    }
    
    return text; // Don't wrap frontmatter, headers, images, or links
  }
  
  // Handle bullet points and numbered lists
  const listMatch = text.match(/^(\s*[-*+]\s*\*\*[^*]+\*\*:\s*)/);
  if (listMatch) {
    const prefix = listMatch[1];
    const content = text.substring(prefix.length);
    if (prefix.length + content.length <= maxLength) return text;
    
    // Wrap the content part, preserving the bullet point prefix
    const wrappedContent = wrapPlainText(content, maxLength - prefix.length);
    return prefix + wrappedContent.split('\n').join('\n' + ' '.repeat(prefix.length));
  }
  
  // Handle regular paragraphs
  return wrapPlainText(text, maxLength);
}

/**
 * Wrap plain text at word boundaries
 */
function wrapPlainText(text, maxLength) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is longer than maxLength, force break
        lines.push(word);
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.join('\n');
}

/**
 * Wrap code block lines more conservatively
 */
function wrapCodeLine(line, maxLength = MAX_LINE_LENGTH) {
  if (line.length <= maxLength) return line;
  
  // For ASCII art or table-like structures, try to preserve alignment
  if (line.includes('│') || line.includes('├') || line.includes('└')) {
    // Try to break at logical points like spaces before/after table separators
    const parts = line.split('│');
    if (parts.length > 1) {
      // This is a table row, try to wrap it intelligently
      let result = '';
      let currentLength = 0;
      
      for (let i = 0; i < parts.length; i++) {
        const part = i === 0 ? parts[i] : '│' + parts[i];
        if (currentLength + part.length <= maxLength) {
          result += part;
          currentLength += part.length;
        } else {
          // Break here and continue on next line with proper indentation
          const indent = line.match(/^\s*/)[0];
          return result + '\n' + indent + '│' + parts.slice(i).join('│');
        }
      }
      return result;
    }
  }
  
  // For Python code, try to break at logical points
  if (line.includes('->') && line.includes(':')) {
    const arrowIndex = line.indexOf('->');
    if (arrowIndex > 0 && arrowIndex < maxLength - 10) {
      const beforeArrow = line.substring(0, arrowIndex).trim();
      const afterArrow = line.substring(arrowIndex).trim();
      const indent = line.match(/^\s*/)[0];
      return beforeArrow + ' \\\n' + indent + '    ' + afterArrow;
    }
  }
  
  // For comments, try to wrap at word boundaries
  if (line.trim().startsWith('#')) {
    const commentMatch = line.match(/^(\s*#\s*)/);
    if (commentMatch) {
      const prefix = commentMatch[1];
      const content = line.substring(prefix.length);
      const wrapped = wrapPlainText(content, maxLength - prefix.length);
      return wrapped.split('\n').map((l, i) => 
        i === 0 ? prefix + l : prefix + l
      ).join('\n');
    }
  }
  
  // Default: don't modify complex code lines to avoid breaking syntax
  return line;
}

/**
 * Process a single MDX file
 */
function processFile(filePath) {
  console.log(`Processing: ${path.relative(process.cwd(), filePath)}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const processedLines = [];
  
  let inCodeBlock = false;
  let inFrontmatter = false;
  let changes = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track frontmatter
    if (line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      processedLines.push(line);
      continue;
    }
    
    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
      continue;
    }
    
    // Skip processing if in frontmatter
    if (inFrontmatter) {
      processedLines.push(line);
      continue;
    }
    
    // Process the line based on context
    if (line.length > MAX_LINE_LENGTH) {
      let wrappedLine;
      
      if (inCodeBlock) {
        wrappedLine = wrapCodeLine(line);
      } else {
        wrappedLine = wrapText(line);
      }
      
      if (wrappedLine !== line) {
        changes++;
        console.log(`  Line ${i + 1}: ${line.length} → ${Math.max(...wrappedLine.split('\n').map(l => l.length))} chars`);
      }
      
      processedLines.push(wrappedLine);
    } else {
      processedLines.push(line);
    }
  }
  
  if (changes > 0) {
    fs.writeFileSync(filePath, processedLines.join('\n'));
    console.log(`  ✅ Fixed ${changes} lines`);
  } else {
    console.log(`  ✅ No changes needed`);
  }
  
  return changes;
}

/**
 * Recursively find all .mdx files in a directory
 */
function findMdxFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
        files.push(fullPath);
      }
    }
  }
  
  if (fs.existsSync(dir)) {
    traverse(dir);
  }
  
  return files;
}

/**
 * Main function
 */
function main() {
  console.log('🔧 Line Length Fixer - Fixing lines longer than 75 characters\n');
  
  // Find all MDX files
  const contentDir = path.resolve(process.cwd(), 'content');
  const mdxFiles = findMdxFiles(contentDir);
  
  if (mdxFiles.length === 0) {
    console.log('❌ No MDX files found in content/');
    process.exit(1);
  }
  
  console.log(`Found ${mdxFiles.length} MDX files\n`);
  
  let totalChanges = 0;
  
  for (const filePath of mdxFiles) {
    const changes = processFile(filePath);
    totalChanges += changes;
  }
  
  console.log(`\n🎉 Complete! Fixed ${totalChanges} lines across ${mdxFiles.length} files`);
  
  if (totalChanges > 0) {
    console.log('\n💡 Run the tests again to verify all issues are resolved:');
    console.log('   cd frontend && bun run test');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { wrapText, wrapCodeLine, processFile };

"use client";

import { useEffect } from "react";

export default function CodeBlockEnhancer() {
  useEffect(() => {
    const enhanceCodeBlocks = () => {
      const codeBlocks = document.querySelectorAll("pre");
      
      codeBlocks.forEach((block) => {
        // Skip if already enhanced
        if (block.parentElement?.classList.contains("code-block-with-copy")) return;
        
        // Create the copy button
        const button = document.createElement("button");
        button.className = "copy-button";
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
        button.setAttribute("aria-label", "Copy code");
        
        // Add the copy functionality
        button.addEventListener("click", () => {
          const code = block.textContent || "";
          navigator.clipboard.writeText(code);
          
          // Visual feedback
          button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
          setTimeout(() => {
            button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
          }, 2000);
        });
        
        // Wrap the code block
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-with-copy";
        block.parentNode?.insertBefore(wrapper, block);
        wrapper.appendChild(block);
        wrapper.appendChild(button);
      });
    };

    // Run once on mount
    enhanceCodeBlocks();

    // Set up a MutationObserver to watch for new code blocks
    const observer = new MutationObserver(enhanceCodeBlocks);
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null; // This component doesn't render anything
} 
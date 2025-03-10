import Image from "next/image";
import Link from "next/link";
import React from "react";
import { cn } from "@/lib/utils";

type TableProps = {
  data: { 
    headers: string[]; 
    rows: string[][] 
  }
};

function Table({ data }: TableProps) {
  const headers = data.headers.map((header, index) => (
    <th key={index} className="border-b p-4 pt-0 pb-3 text-left font-medium">
      {header}
    </th>
  ));
  
  const rows = data.rows.map((row, index) => (
    <tr key={index} className={index % 2 === 0 ? "bg-secondary/50" : ""}>
      {row.map((cell, cellIndex) => (
        <td key={cellIndex} className="border-b p-4">
          {cell}
        </td>
      ))}
    </tr>
  ));

  return (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>{headers}</tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function CustomLink(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const href = props.href;

  if (!href) return <a {...props} />;

  if (href.startsWith("/")) {
    return (
      <Link href={href} {...props} className={cn("font-medium underline underline-offset-4", props.className)}>
        {props.children}
      </Link>
    );
  }

  if (href.startsWith("#")) {
    return <a {...props} className={cn("font-medium underline underline-offset-4", props.className)} />;
  }

  return (
    <a 
      target="_blank" 
      rel="noopener noreferrer" 
      {...props} 
      className={cn(
        "font-medium underline underline-offset-4 text-primary",
        props.className
      )} 
    />
  );
}

function RoundedImage(props: Omit<React.ComponentProps<typeof Image>, "alt"> & { 
  alt: string;
}) {
  return (
    <div className="my-6 overflow-hidden rounded-lg border bg-secondary/20">
      <Image 
        {...props}
        alt={props.alt}
        width={props.width || 1200}
        height={props.height || 630}
        className={cn("w-full", props.className)}
      />
    </div>
  );
}

// Function to create a slug from heading text
function slugify(str: string) {
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

// Create heading components with anchor links
function createHeading(level: number) {
  const Heading = ({ children, className, ...props }: { 
    children: React.ReactNode;
    className?: string;
    [key: string]: unknown;
  }) => {
    const slug = slugify(children as string);
    
    return React.createElement(
      `h${level}`,
      { 
        id: slug,
        className: cn(
          "font-medium tracking-tighter mt-10 mb-4 scroll-mt-20",
          level === 1 && "text-3xl lg:text-4xl",
          level === 2 && "text-2xl lg:text-3xl",
          level === 3 && "text-xl lg:text-2xl",
          level === 4 && "text-lg lg:text-xl",
          className
        ),
        ...props 
      },
      [
        React.createElement("a", {
          href: `#${slug}`,
          key: `link-${slug}`,
          className: "absolute -ml-8 mt-1 flex items-center opacity-0 group-hover:opacity-100",
          "aria-label": `Link to ${children}`,
        }),
      ],
      children,
    );
  };
  
  Heading.displayName = `Heading${level}`;
  return Heading;
}

// Code block component with better styling
function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <div className="group relative my-6">
      <pre className={cn("rounded-lg border bg-secondary/50 p-4 overflow-x-auto", props.className)} {...props}>
        {props.children}
      </pre>
      <button
        onClick={() => {
          const code = props.children?.toString() || "";
          navigator.clipboard.writeText(code);
        }}
        className="absolute right-3 top-3 rounded-md p-2 opacity-0 transition-opacity bg-secondary hover:bg-secondary/80 group-hover:opacity-100"
        aria-label="Copy code"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </button>
    </div>
  );
}

// Blockquote component with better styling
function Blockquote(props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote
      className={cn(
        "mt-6 border-l-4 border-primary pl-6 font-normal italic text-muted-foreground",
        props.className
      )}
      {...props}
    />
  );
}

export const globalComponents = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  h5: createHeading(5),
  h6: createHeading(6),
  Image: RoundedImage,
  a: CustomLink,
  Table,
  pre: CodeBlock,
  blockquote: Blockquote,
};

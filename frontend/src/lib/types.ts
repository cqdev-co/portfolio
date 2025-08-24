// Define a simple interface for page params
export interface PageParams {
  [key: string]: string;
}

// Define the PageProps type used by Next.js pages
export interface PageProps<P = PageParams> {
  params: P;
  searchParams?: { [key: string]: string | string[] | undefined };
} 
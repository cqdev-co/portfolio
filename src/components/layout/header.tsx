import { DATA } from "@/data/resume";
import Image from "next/image";

export function Header() {
  return (
    <header className="w-full py-8 mt-4">
      <div className="container max-w-4xl mx-auto px-4 md:px-6">
        {/* Profile section with image and info side by side */}
        <div className="flex flex-row items-center gap-6">
          {/* Profile Image */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 border-white dark:border-gray-900 bg-white dark:bg-gray-800 overflow-hidden flex-shrink-0">
            <div className="relative w-full h-full">
              <Image 
                src="/images/headshot.jpg" 
                alt="Profile Photo"
                fill
                sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
                style={{ objectFit: 'cover', objectPosition: 'center 20%' }}
                priority
              />
            </div>
          </div>
          
          {/* Profile Info */}
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
              {DATA.name}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {DATA.title}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {DATA.location}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
} 
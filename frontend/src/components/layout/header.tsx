import { DATA } from "@/data/resume";
import Image from "next/image";

export function Header() {
  const education = DATA.education && DATA.education.length > 0 ? DATA.education[0] : null;
  
  // Split degree and minors if possible
  let degree = "";
  let minors = "";
  if (education && education.degree) {
    const parts = education.degree.split(';');
    degree = parts[0].trim();
    minors = parts.length > 1 ? parts[1].trim() : "";
  }

  return (
    <header className="w-full py-6 mt-3">
      <div className="container max-w-4xl mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center">
          {/* Left side: Profile section with image and info */}
          <div className="flex flex-row items-center gap-5">
            {/* Profile Image */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full border-3 border-background bg-card overflow-hidden flex-shrink-0">
              <div className="relative w-full h-full">
                <Image 
                  src="/images/headshot.jpg" 
                  alt="Profile Photo"
                  fill
                  sizes="(max-width: 640px) 80px, (max-width: 768px) 96px, 112px"
                  style={{ objectFit: 'cover', objectPosition: 'center 20%' }}
                  priority
                />
              </div>
            </div>
            
            {/* Profile Info */}
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground tracking-tight">
                {DATA.name}
              </h1>
              <p className="text-sm text-muted-foreground tracking-tight">
                {DATA.title}
              </p>
              <p className="text-caption text-muted-foreground mt-0.5">
                {DATA.location}
              </p>
            </div>
          </div>

          {/* Right side: Education info */}
          {education && (
            <div className="hidden sm:flex flex-col items-end text-right">
              <div className="flex items-center gap-2">
                {education.logoUrl && (
                  <div className="w-8 h-8 relative overflow-hidden rounded-sm">
                    <Image
                      src={education.logoUrl}
                      alt={education.school}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                )}
                <h2 className="text-sm font-medium text-foreground tracking-tight">
                  {education.school}
                </h2>
              </div>
              <p className="text-caption text-muted-foreground mt-0.5">
                {degree}
              </p>
              {minors && (
                <p className="text-caption text-muted-foreground mt-0.5">
                  {minors}
                </p>
              )}
              <p className="text-caption text-muted-foreground mt-0.5">
                {education.start} - {education.end}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DATA } from "@/data/resume";
import { ProjectCard } from "@/components/project-card";
import { Separator } from "@/components/ui/separator";
import { ResumeCard } from "@/components/resume-card";
import { PersonSchema, WebsiteSchema } from "@/components/schema";

// Use the data directly to avoid type issues with readonly arrays
const data = DATA;

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      {/* Add structured data for SEO */}
      <PersonSchema />
      <WebsiteSchema />
      
      {/* About Section */}
      <section>
        <h2 className="text-lg font-semibold mb-3">About</h2>
        <Separator className="mb-4" />
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p>{data.about || "About information not available."}</p>
        </div>
      </section>

      {/* Work Experience */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Work Experience</h2>
        <Separator className="mb-4" />
        <div className="space-y-4">
          {data.work && data.work.length > 0 
              ? data.work.map((job, index) => (
                  <ResumeCard
                    key={index}
                    logoUrl={job.logoUrl}
                    altText={job.company}
                    title={job.company}
                    subtitle={job.title}
                    period={`${job.start} - ${job.end}`}
                    href={job.href}
                    description={job.description}
                    highlights={job.highlights}
                  />
                ))
              : <p>No experience data available</p>
            }
        </div>
      </section>
      
      {/* Skills Section */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Skills</h2>
        <Separator className="mb-4" />
        <div className="flex flex-wrap gap-2">
          {data.skills?.map((skill: string) => (
            <span 
              key={skill} 
              className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-2.5 py-0.5 text-xs font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>
      
      {/* Projects Section */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">View All</Link>
          </Button>
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.projects?.map((project, index) => (
            <ProjectCard
              key={index}
              title={project.title}
              description={project.description}
              dates={project.dates}
              tags={project.technologies}
              image={project.image}
              video={project.video}
              href={project.href}
              active={project.active}
              links={project.links}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

import { Separator } from "@/components/ui/separator";
import { ResumeCard } from "@/components/resume-card";
import { ProjectCard } from "@/components/project-card";
import { DATA } from "@/data/resume";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/utils";

// Use the data directly to avoid type issues with readonly arrays
const data = DATA;

export const metadata: Metadata = createMetadata({
  title: "Conor Quinlan | Security Engineer & Software Developer",
  description: "Security Engineer specializing in cloud security, DevSecOps, and building secure, resilient systems and infrastructure.",
});

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      {/* About Section */}
      <section>
        <h2 className="text-base font-medium mb-3">About</h2>
        <Separator className="mb-4" />
        <div className="text-compact text-muted-foreground space-y-2.5">
          <p>
            Security Engineer with a strong focus on building automation, securing infrastructure, and integrating AI into modern security operations. With a background in Computer Science and minors in Mathematics and Business Analytics, I bring a well-rounded, analytical approach to solving complex security challenges.
          </p>
          <p>
            Over the past year, I&apos;ve led the development of tools and systems across areas like vulnerability management, threat detection, secret scanning, and cloud security. Often using Python, GCP, and modern LLM frameworks in my tool belt. I also manage and mentor junior team members, driving innovation while fostering growth in others.
          </p>
          <p>
            I&apos;m particularly passionate about AI in Security, Infra/Product Security, and empowering lean security teams through intelligent automation. Whether it&apos;s building internal APIs, deploying secure bots, or researching emerging threat vectors, I aim to combine technical depth with practical impact.
          </p>
          <p>
            I thrive in fast-paced environments where experimentation, ownership, and continuous learning are encouraged. My long-term goal is to grow into a leadership role that bridges technical excellence with strategic decision-making.
          </p>
        </div>
      </section>

      {/* Work Experience */}
      <section>
        <h2 className="text-base font-medium mb-3">Work Experience</h2>
        <Separator className="mb-4" />
        <div className="space-y-4">
          {data.work && data.work.length > 0 
              ? data.work.map((job, index) => (
                  <ResumeCard
                    key={index}
                    logoUrl={job.logoUrl || ""}
                    altText={job.company}
                    title={job.company}
                    subtitle={job.title}
                    period={`${job.start} - ${job.end}`}
                    href={job.href}
                    description={job.description}
                    highlights={job.highlights}
                    companyTag={job.companyTag}
                  />
                ))
              : <p className="text-compact text-muted-foreground">No experience data available</p>
            }
        </div>
      </section>

      {/* Education Section */}
      <section>
        <h2 className="text-base font-medium mb-3">Education</h2>
        <Separator className="mb-4" />
        <div className="space-y-4">
          {data.education && data.education.length > 0 
            ? data.education.map((edu, index) => (
                <ResumeCard
                  key={index}
                  logoUrl={edu.logoUrl || ""}
                  altText={edu.school}
                  title={edu.school}
                  subtitle={edu.degree}
                  period={`${edu.start} - ${edu.end}`}
                  href={edu.href}
                />
              ))
            : <p className="text-compact text-muted-foreground">No education data available</p>
          }
        </div>
      </section>
      
      {/* Skills Section */}
      <section>
        <h2 className="text-base font-medium mb-3">Skills</h2>
        <Separator className="mb-4" />
        <div className="flex flex-wrap gap-2">
          {data.skills?.map((skill) => (
            <span 
              key={skill}
              className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-caption text-muted-foreground"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>
      
      {/* Projects Section */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-medium">Projects</h2>
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

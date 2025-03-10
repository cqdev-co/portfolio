import { Separator } from "@/components/ui/separator";
import { ResumeCard } from "@/components/resume-card";
import { ProjectCard } from "@/components/project-card";
import { DATA } from "@/data/resume";

// Use the data directly to avoid type issues with readonly arrays
const data = DATA;

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      {/* About Section */}
      <section>
        <h2 className="text-base font-medium mb-3">About</h2>
        <Separator className="mb-4" />
        <div className="text-compact text-muted-foreground space-y-2.5">
          <p>
            I&apos;m a Security Engineer at Cyera focused on building secure, resilient systems and infrastructure. With a strong foundation in cloud security, I specialize in hardening AWS environments, implementing containerization best practices, and automating security workflows.
          </p>
          <p>
            My expertise spans across DevSecOps, infrastructure as code (Ansible/Terraform), and container security. I&apos;m passionate about integrating security throughout the development lifecycle and creating efficient, scalable solutions that protect sensitive data while enabling innovation.
          </p>
          <p>
            Outside of my professional work, I contribute to open-source security projects and continuously explore emerging technologies in cloud security, AI integration, and secure software engineering.
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
                  />
                ))
              : <p className="text-compact text-muted-foreground">No experience data available</p>
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

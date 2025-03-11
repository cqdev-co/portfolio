import { Separator } from "@/components/ui/separator";
import { DATA } from "@/data/resume";
import type { Metadata } from "next";
import BlurFade from "@/components/magicui/blur-fade";

export const metadata: Metadata = {
  title: "About Me",
  description: "Learn more about my background, experience, and expertise as a Security Engineer.",
  keywords: ["about", "security engineer", "cloud security", "DevSecOps", "background"],
  openGraph: {
    title: "About Conor Quinlan | Security Engineer",
    description: "Learn more about my background, experience, and expertise as a Security Engineer.",
    url: `${DATA.url}/about`,
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Conor Quinlan | Security Engineer",
    description: "Learn more about my background, experience, and expertise as a Security Engineer.",
  },
};

export default function AboutPage() {
  return (
    <section className="max-w-3xl mx-auto">
      <BlurFade delay={0.1}>
        <h1 className="font-medium text-2xl mb-8 tracking-tighter">about me</h1>
      </BlurFade>

      <Separator className="mb-8" />
      
      <div className="prose dark:prose-invert max-w-none">
        <h2>Background</h2>
        <p>
          I&apos;m a Security Engineer with extensive experience in cloud environments, application security, and infrastructure hardening. My journey in technology began with a fascination for how systems work and how they can be protected against threats.
        </p>
        
        <h2>Philosophy</h2>
        <p>
          I believe security should be a foundational aspect of any system, not an afterthought. My approach integrates security considerations throughout the development lifecycle, creating resilient systems that are secure by design.
        </p>
        
        <h2>Expertise</h2>
        <ul>
          <li><strong>Cloud Security:</strong> Specializing in AWS security architecture, IAM policies, and security automation</li>
          <li><strong>DevSecOps:</strong> Implementing security guardrails and automated testing in CI/CD pipelines</li>
          <li><strong>Infrastructure as Code:</strong> Building secure, repeatable infrastructure with Terraform and Ansible</li>
          <li><strong>Container Security:</strong> Hardening Docker containers and Kubernetes deployments</li>
          <li><strong>Security Monitoring:</strong> Designing comprehensive monitoring solutions with advanced alerting</li>
        </ul>
        
        <h2>Continuous Learning</h2>
        <p>
          The security landscape is constantly evolving, and I&apos;m committed to staying at the forefront of emerging threats and defense mechanisms. I regularly participate in security conferences, contribute to open-source projects, and pursue advanced certifications.
        </p>
        
        <h2>Beyond Work</h2>
        <p>
          Outside of my professional work, I enjoy hiking, photography, and exploring new technologies. I&apos;m also passionate about mentoring aspiring security professionals and contributing to the security community.
        </p>
      </div>
    </section>
  );
} 
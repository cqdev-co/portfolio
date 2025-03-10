import { Icons } from "@/components/icons";
import { HomeIcon, NotebookIcon } from "lucide-react";

export const DATA = {
  name: "Conor Quinlan",
  initials: "CQ",
  url: "https://conorq.com",
  location: "Boulder, CO",
  title: "Security Engineer @ Cyera",
  about: "Specializing in secure application development, infrastructure hardening, and automations. Experienced in building resilient systems with Python, Docker, and Cloud technologies while implementing security by design principles.",
  locationLink: "https://www.google.com/maps/place/boulder",
  description: "Security Engineer | Cloud Infrastructure Security | Secure Software Development",
  summary: "Security engineer with expertise in developing secure full-stack applications, implementing zero-trust deployment pipelines, and automating security controls. Focused on proactive security design patterns for cloud infrastructure (AWS, GCP) and container technologies.",
  avatarUrl: "/me.png",
  skills: [
    "Cloud Security (AWS/GCP)",
    "CI/CD Security",
    "Docker Containerization",
    "Infrastructure as Code",
    "Zero-Trust Architecture",
    "Security Automation",
    "Terraform",
    "Ansible",
    "TypeScript/JavaScript",
    "Python",
    "Next.js/React",
    "FastAPI",
    "SQL/Database Security",
    "GitHub Actions",
    "Linux Administration",
  ],
  navbar: [
    { href: "/", icon: HomeIcon, label: "Home" },
    { href: "/blog", icon: NotebookIcon, label: "Blog" },
  ],
  contact: {
    email: "conorquinlan@cloud.com",
    tel: "+12064503502",
    social: {
      GitHub: {
        name: "GitHub",
        url: "https://github.com/cqdev-co",
        icon: Icons.github,
        navbar: true,
      },
      LinkedIn: {
        name: "LinkedIn",
        url: "https://linkedin.com/in/conorgquinlan",
        icon: Icons.linkedin,
        navbar: true,
      },
      X: {
        name: "X",
        url: "https://x.com/realconorcodes",
        icon: Icons.x,
        navbar: true,
      },
    },
  },
  coreCompetencies: [
    {
      area: "Application Security",
      skills: ["Secure SDLC implementation", "Dependency vulnerability management", "Authentication/authorization design", "API security", "Input validation"]
    },
    {
      area: "Infrastructure Security",
      skills: ["Container security", "Cloud security posture management", "IaC security scanning", "Network segmentation", "Encryption implementation"]
    },
    {
      area: "DevSecOps",
      skills: ["CI/CD pipeline security", "Secret management", "Automated security testing", "Compliance as code", "Security monitoring"]
    },
  ],
  work: [
    {
      company: "Cyera",
      href: "https://cyera.io",
      badges: ["Security", "Full-Stack"],
      location: "Boulder, CO",
      title: "Security Engineer",
      logoUrl: "/logos/cyera.svg",
      start: "September 2024",
      end: "Present",
      description:
        "Architected and implemented a secure full-stack NextJS platform with hardened authorization controls and encrypted data flows. Key accomplishments:",
      highlights: [
        "Developed secure authentication patterns using TypeScript, TailwindCSS and ShishCN",
        "Containerized applications with Docker ensuring consistent security controls across environments",
        "Implemented least-privilege principle for security automation using GitHub Actions",
        "Designed secure data storage with encrypted AWS RDS PostgreSQL database",
        "Created containerized security monitoring system on Google Cloud Run for automated threat detection",
      ]
    },
    {
      company: "PearAI",
      href: "https://trypear.ai",
      badges: ["Open Source", "Security"],
      location: "Boulder, CO",
      title: "Open-Source Contributor",
      logoUrl: "/logos/pearai.jpeg",
      start: "June 2024",
      end: "Present",
      description:
        "Contributed security-focused improvements to open source projects. Key accomplishments:",
      highlights: [
        "Integrated secure Terraform deployment patterns for AWS infrastructure",
        "Implemented secure API integrations for Google Gemini",
        "Created VMWare fail-safe deployment mechanisms",
        "Conducted security-focused code reviews applying OWASP best practices",
        "Established security testing practices for large GitHub repositories"
      ]
    },
    {
      company: "Netskope",
      badges: ["Security", "SOC"],
      href: "https://netskope.com",
      location: "Clayton, MO",
      title: "Information Security Intern",
      logoUrl: "/logos/netskope.png",
      start: "January 2024",
      end: "September 2024",
      description:
        "Implemented secure infrastructure automation practices for AWS deployments. Key accomplishments:",
      highlights: [
        "Built secure IaC templates using Ansible and Terraform with embedded security controls",
        "Designed AWS Security Groups following zero-trust principles",
        "Secured GitLab Actions workflows with proper secret management",
        "Migrated Flask applications to production with security-focused configurations",
        "Created security monitoring dashboards using Python and Looker Studio"
      ]
    },
  ],
  education: [
    {
      school: "University of Denver",
      href: "https://du.edu",
      degree: "B.S. in Computer Science; Minor: Mathematics, Business Analytics",
      logoUrl: "/du.png",
      start: "September 2020",
      end: "June 2024",
    },
  ],
  projects: [
    {
      title: "Portfolio",
      href: "https://magicui.design",
      dates: "March 2025 - Present",
      active: true,
      description:
        "Develoepd a portfolio website.",
      technologies: [
        "NextJS",
        "TypeScript",
        "ShadCN",
        "TailwindCSS",
        "Shadcn UI",
        "Magic UI",
      ],
      links: [
        {
          type: "Website",
          href: "https://conorq.com",
          icon: <Icons.globe className="size-3" />,
        },
        {
          type: "Source",
          href: "https://github.com/cqdev-co/portfolio",
          icon: <Icons.github className="size-3" />,
        },
      ],
      image: "",
      video: "https://cdn.magicui.design/bento-grid.mp4",
    },
  ],
  certifications: [
    {
      name: "AWS Certified Security - Specialty",
      issuer: "Amazon Web Services",
      date: "2024",
      logo: "/aws-security-cert.png"
    },
  ],
} as const;

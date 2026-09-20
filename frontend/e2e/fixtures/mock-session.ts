import type { Page } from "@playwright/test";

export interface MockSessionOptions {
  template?: "swiss" | "classic" | "modern" | "minimal";
  overallScore?: number;
  jobDescriptionText?: string;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  sectionOrder?: string[];
  hiddenSections?: string[];
}

export function createMockResumeContent(options?: MockSessionOptions) {
  return {
    personal: {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "+1 (555) 234-5678",
      location: "San Francisco, CA",
      linkedin: "https://linkedin.com/in/janedoe",
      github: "https://github.com/janedoe",
      portfolio: "https://janedoe.dev",
      website: "https://janedoe.dev/blog",
      other_links: [],
    },
    summary:
      "Principal Full-Stack Engineer with 10+ years of experience architecting cloud-native distributed systems, modern React frontends, and automated CI/CD pipelines.",
    skill_groups: [
      {
        id: "sg-1",
        name: "Languages",
        items: [
          { id: "sk-1", name: "TypeScript" },
          { id: "sk-2", name: "Python" },
          { id: "sk-3", name: "Go" },
          { id: "sk-4", name: "SQL" },
        ],
      },
      {
        id: "sg-2",
        name: "Frameworks & Libraries",
        items: [
          { id: "sk-5", name: "React" },
          { id: "sk-6", name: "Vite" },
          { id: "sk-7", name: "TailwindCSS" },
          { id: "sk-8", name: "FastAPI" },
        ],
      },
      {
        id: "sg-3",
        name: "Cloud & Testing",
        items: [
          { id: "sk-9", name: "AWS" },
          { id: "sk-10", name: "Docker" },
          { id: "sk-11", name: "CI/CD" },
          { id: "sk-12", name: "Playwright" },
        ],
      },
    ],
    experience: [
      {
        id: "exp-1",
        employer: "Acme Cloud Corp",
        title: "Staff Platform Engineer",
        location: "San Francisco, CA",
        start_date: "2022-01",
        end_date: "Present",
        is_current: true,
        employment_type: "Full-time",
        bullets: [
          {
            id: "b-1",
            text: "Spearheaded migration to micro-frontends with React and TypeScript, boosting core web vitals by 42%.",
          },
          {
            id: "b-2",
            text: "Designed automated E2E testing framework using Playwright, cutting deployment regression escapes to zero.",
          },
        ],
      },
      {
        id: "exp-2",
        employer: "Apex Systems",
        title: "Senior Full Stack Engineer",
        location: "New York, NY",
        start_date: "2018-03",
        end_date: "2021-12",
        is_current: false,
        employment_type: "Full-time",
        bullets: [
          {
            id: "b-3",
            text: "Built high-throughput distributed ingestion pipelines with Python and FastAPI processing 50M events daily.",
          },
        ],
      },
    ],
    projects: [
      {
        id: "proj-1",
        name: "Career Copilot Studio",
        description: "AI-assisted resume optimizer and ATS benchmarking engine",
        technologies: ["React", "TypeScript", "TailwindCSS", "FastAPI"],
        url: "https://github.com/career-copilot",
        bullets: [
          {
            id: "b-4",
            text: "Engineered side-by-side keyword matching comparison and Swiss-style document editor.",
          },
        ],
      },
    ],
    education: [
      {
        id: "edu-1",
        institution: "University of California, Berkeley",
        degree: "Bachelor of Science",
        specialization: "Computer Science",
        location: "Berkeley, CA",
        start_date: "2013-08",
        end_date: "2017-05",
        gpa: "3.9",
        details: "Graduated with High Honors, Dean's Honor List",
      },
    ],
    certifications: [
      {
        id: "cert-1",
        name: "AWS Certified Solutions Architect - Professional",
        issuer: "Amazon Web Services",
        date: "2023-04",
        credential_id: "AWS-PSA-98231",
        credential_url: "https://aws.amazon.com/verification",
      },
    ],
    achievements: [
      {
        id: "ach-1",
        text: "Winner of Global Hackathon 2023 for AI Developer Tools architecture.",
      },
    ],
    links: [
      {
        id: "link-1",
        label: "GitHub",
        url: "https://github.com/janedoe",
      },
    ],
    languages: [
      {
        id: "lang-1",
        language: "English",
        proficiency: "Native / Bilingual",
      },
      {
        id: "lang-2",
        language: "Spanish",
        proficiency: "Professional Working",
      },
    ],
    additional: [
      {
        id: "patents",
        title: "Patents & Publications",
        entries: [
          {
            id: "add-1",
            text: "US Patent #11,492,012: Distributed State Synchronization in Cloud Microservices.",
          },
        ],
      },
    ],
    section_order: options?.sectionOrder || [
      "personal",
      "summary",
      "experience",
      "skills",
      "projects",
      "education",
      "certifications",
      "achievements",
      "languages",
      "additional:patents",
    ],
    hidden_sections: options?.hiddenSections || [],
  };
}

export function createMockPresentation(template: "swiss" | "classic" | "modern" | "minimal" = "swiss") {
  return {
    template,
    page_size: "a4" as const,
    font_family: "calibri" as const,
    font_size: 10,
    heading_size: 14,
    heading_weight: 700 as const,
    line_height: 1.4,
    paragraph_spacing: 8,
    section_spacing: 16,
    heading_spacing: 6,
    bullet_spacing: 4,
    bullet_indent: 14,
    margin_top: 20,
    margin_right: 20,
    margin_bottom: 20,
    margin_left: 20,
    header_alignment: "left" as const,
    heading_alignment: "left" as const,
    accent_color: "#1d4ed8",
    divider: "line" as const,
    section_overrides: {},
  };
}

export function createMockSession(options?: MockSessionOptions) {
  const template = options?.template || "swiss";
  const defaultJd =
    options?.jobDescriptionText ||
    "We are seeking a Staff Platform Engineer with deep expertise in TypeScript, React, Vite, TailwindCSS, CI/CD, and Playwright. Experience with distributed systems and performance optimization in Python and AWS is required. Nice to have: GraphQL, Kubernetes, and Golang.";

  return {
    working_version: {
      id: "version-active-123",
      resume_id: "resume-root-456",
      version_number: 2,
      source_type: "studio",
      extraction_status: "ready",
      original_filename: "Jane_Doe_Resume_2026.pdf",
      created_at: new Date().toISOString(),
    },
    source_version: {
      id: "version-source-111",
      resume_id: "resume-root-456",
      version_number: 1,
      source_type: "upload",
      original_filename: "Jane_Doe_Original.pdf",
    },
    resume: {
      id: "resume-root-456",
      title: "Jane Doe - Principal Resume",
      is_active: true,
    },
    document: {
      schema_version: "2.0.0",
      source_version_id: "version-source-111",
      ats_analysis_id: "ats-analysis-789",
      content: createMockResumeContent(options),
      presentation: createMockPresentation(template),
    },
    ats: {
      analysis: {
        id: "ats-analysis-789",
        overall_score: options?.overallScore !== undefined ? options.overallScore : 82,
        status: "completed",
        resume_version_id: "version-active-123",
        job_description_id: "jd-cloudscale-999",
        created_at: new Date().toISOString(),
        summary: {
          matched_skills: 8,
          missing_skills: 2,
          experience_alignment: "high",
        },
        score_breakdown: {
          skills: 85,
          experience: 80,
          education: 90,
        },
      },
      evidence: [
        {
          id: "ev-1",
          requirement_text: "TypeScript & React frontends",
          requirement_type: "skill",
          match_status: "matched",
          resume_evidence_text: "Spearheaded migration to micro-frontends with React and TypeScript",
          resume_section: "experience",
          explanation: "Explicit match in recent staff engineering role.",
        },
        {
          id: "ev-2",
          requirement_text: "Playwright E2E testing framework",
          requirement_type: "skill",
          match_status: "matched",
          resume_evidence_text: "Designed automated E2E testing framework using Playwright",
          resume_section: "experience",
          explanation: "Explicit match found.",
        },
        {
          id: "ev-3",
          requirement_text: "GraphQL schema design and federation",
          requirement_type: "skill",
          match_status: "missing",
          resume_evidence_text: null,
          resume_section: null,
          explanation: "Candidate does not mention GraphQL.",
        },
        {
          id: "ev-4",
          requirement_text: "Kubernetes orchestration in production",
          requirement_type: "skill",
          match_status: "missing",
          resume_evidence_text: null,
          resume_section: null,
          explanation: "Kubernetes missing from resume experience.",
        },
      ],
      job_description: {
        id: "jd-cloudscale-999",
        title: "Staff Platform Engineer",
        company: "Acme Cloud Scale",
        role_title: "Staff Platform Engineer",
        raw_text: defaultJd,
      },
    },
  };
}

export async function setupResumeStudioRoutes(
  page: Page,
  options?: MockSessionOptions,
) {
  const session = createMockSession(options);

  // Set mock access token so authenticated apiRequest executes real fetch calls intercepted by page.route
  await page.addInitScript(() => {
    window.localStorage.setItem("career_copilot_access_token", "test-bearer-token-12345");
  });

  // Mock workspace bootstrap
  await page.route("**/me/bootstrap*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          id: "user-123",
          email: "jane.doe@example.com",
          full_name: "Jane Doe",
          username: "janedoe",
        },
        workspace: {
          id: "ws-123",
          name: "Jane's Workspace",
        },
      }),
    });
  });

  // Mock session opening
  await page.route("**/resume-studio/sessions", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
    } else {
      await route.fallback();
    }
  });

  // Mock session fetch / save
  await page.route("**/resume-studio/sessions/*", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/reset") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
      return;
    }

    if (url.includes("/suggest") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          original_text: "Spearheaded migration to micro-frontends",
          proposed_text:
            "Spearheaded architectural migration to modern TypeScript micro-frontends, increasing reliability by 42%.",
          reason: "Aligns with staff engineering leadership keywords and quantifiable metrics.",
          addresses: "TypeScript, React, performance metrics",
          needs_candidate_input: false,
        }),
      });
      return;
    }

    if (method === "PUT") {
      const body = route.request().postDataJSON();
      const updated = {
        ...session,
        document: {
          ...session.document,
          content: body.content || session.document.content,
          presentation: body.presentation || session.document.presentation,
        },
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(updated),
      });
      return;
    }

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
      return;
    }

    await route.fallback();
  });

  // Mock ATS analyses
  await page.route("**/ats-analyses*", async (route) => {
    if (route.request().url().includes("/evidence")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session.ats.evidence),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "ats-analysis-new-999",
        overall_score: 88,
        summary: { matched: 10, missing: 1 },
        score_breakdown: { skills: 90, experience: 85 },
      }),
    });
  });

  // Mock export PDF
  await page.route("**/resume-versions/*/exports", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "export-task-444" }),
    });
  });

  await page.route("**/resume-exports/*/download", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        download_url: "blob:http://127.0.0.1:3000/mock-resume.pdf",
        filename: "Jane_Doe_Swiss_Resume.pdf",
      }),
    });
  });

  return session;
}

# SmartSBA - Codebase Overview

> **Generated**: 2026-07-19
> **Purpose**: Quick reference for navigating the project and delegating tasks to agents in `.github/agents/`

---

## Project Identity

- **Name**: SmartSBA (School-Based Assessment)
- **Description**: Multi-school educational management web app for student assessments, reports, and role-based dashboards (Ghanaian BECE-compatible)
- **Repository**: `github.com/gameli-lab/smartsba`
- **Latest Commit**: `7a6acfd5c47847ec0c59f943bb04985f589c6e7f`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16.2.2 (App Router, Turbopack) |
| **UI Library** | React 19.1.0 |
| **Language** | TypeScript 5.x (strict mode, `@/*` → `./src/*`) |
| **Styling** | TailwindCSS 4.x + shadcn/ui (Radix primitives) |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Forms** | React Hook Form + Zod 4.x |
| **PDF** | jsPDF + jspdf-autotable |
| **Excel** | ExcelJS |
| **Database** | Supabase PostgreSQL (RLS) |
| **Auth** | Supabase SSR (PKCE flow) |
| **Edge Functions** | Deno (3 functions) |
| **AI** | Anthropic SDK |
| **Email** | Nodemailer |
| **SMS** | Twilio (with queue management) |
| **Testing** | Jest (13 test suites) |

---

## Project Structure

```
smartsba/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Login page
│   │   ├── (dashboard)/       # Role-based dashboards
│   │   ├── (school-admin)/    # School admin layouts
│   │   ├── parent/            # Parent portal
│   │   ├── student/           # Student portal
│   │   ├── teacher/           # Teacher portal
│   │   ├── admin/             # Admin functions
│   │   ├── ai/                # AI command center
│   │   ├── mfa-challenge/     # MFA verification
│   │   ├── profile/           # Profile editing
│   │   ├── reset-password/    # Password reset
│   │   └── api/               # API routes
│   ├── components/            # Reusable UI components
│   │   ├── ai/               # AI-related components
│   │   ├── analytics/        # Analytics charts
│   │   ├── auth/             # Auth UI (login shell, OTP, school selection)
│   │   ├── layout/           # Layouts, sidebars, headers
│   │   ├── parent/           # Parent-specific components
│   │   ├── profile/          # Profile editor
│   │   ├── providers/        # React context providers
│   │   ├── schools/          # School management components
│   │   ├── student/          # Student-specific components
│   │   ├── super-admin/      # Super admin components
│   │   ├── super-admins/     # Super admin CRUD components
│   │   └── ui/               # shadcn/ui primitives
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Core utilities & business logic
│   │   ├── supabase.ts       # Supabase client factories (browser/server/admin)
│   │   ├── auth.ts           # AuthService (login flows for all roles)
│   │   ├── auth-guards.ts    # Server-side role guards
│   │   ├── csrf.ts           # CSRF token management
│   │   ├── mfa.ts            # TOTP MFA operations
│   │   ├── mfa-session.ts    # MFA cookie management
│   │   ├── otp-session.ts    # OTP cookie verification
│   │   ├── rate-limit.ts     # Rate limiting
│   │   ├── password-policy.ts # Password strength enforcement
│   │   ├── login-security.ts # Login attempt tracking & lockout
│   │   ├── schools.ts        # School CRUD
│   │   ├── school-operations.ts # School business operations
│   │   ├── school-metrics.ts # School analytics
│   │   ├── school-provisioning.ts # School provisioning
│   │   ├── school-admin-onboarding.ts # School admin onboarding
│   │   ├── assume-role.ts    # Super admin role assumption
│   │   ├── audit.ts / audit-log.ts # Audit logging
│   │   ├── security-monitor.ts # Security monitoring
│   │   ├── session-timeout.ts # Session timeout management
│   │   ├── storage.ts        # Supabase storage (avatar uploads)
│   │   ├── core-subjects.ts  # Core subject auto-creation
│   │   ├── pdf-export.ts     # PDF report generation
│   │   ├── email-templates.ts # Email templates
│   │   ├── header-utils.ts   # Request header utilities
│   │   └── constants/        # Constants (level groups)
│   ├── services/             # Business logic services
│   │   ├── adminCreationService.ts
│   │   ├── aiGovernanceService.ts
│   │   ├── aiLLMService.ts
│   │   ├── emailService.ts
│   │   ├── githubSyncService.ts
│   │   ├── schoolDeletionService.ts
│   │   ├── securityRuleEngineService.ts
│   │   ├── smsService.ts
│   │   ├── teacherDashboardService.ts
│   │   ├── twilioService.ts
│   │   └── twilioQueueService.ts
│   └── types/                # TypeScript definitions
│       ├── index.ts          # Main types (entities, forms, API responses)
│       ├── supabase.ts       # Supabase-generated types
│       ├── supabase-generated.ts
│       └── teacher-dashboard.ts
├── supabase/
│   ├── migrations/           # 36+ SQL migration files
│   ├── functions/            # Edge Functions (Deno)
│   │   ├── calculate-aggregates/
│   │   ├── calculate-ranks/
│   │   └── generate-report/
│   ├── seed.sql              # Sample/seed data
│   └── storage-policies.sql  # Storage bucket policies
├── tests/                    # Jest test suites (13 files)
├── docs/                     # Documentation (30+ files)
├── .github/agents/           # Agent definitions (100+ agents)
├── middleware.ts             # Next.js middleware (auth, CSRF, MFA, security)
├── next.config.ts            # Next.js configuration
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── components.json           # shadcn/ui configuration
├── eslint.config.mjs         # ESLint flat config
└── package.json              # Dependencies & scripts
```

---

## User Roles & Authentication

### 5 Roles

| Role | Login Method | MFA Required | Redirect Path |
|------|-------------|--------------|---------------|
| **super_admin** | Email + password | Yes | `/dashboard/super-admin` |
| **school_admin** | Staff ID + password | Yes | `/school-admin` |
| **teacher** | Staff ID + password | No | `/teacher` |
| **student** | Admission Number + password | No | `/student` |
| **parent** | Name + Ward Admission Number + password | No | `/parent` |

### Auth Flow
1. **Login** → identifier lookup → Supabase auth sign-in → profile fetch → role-based redirect
2. **MFA** → TOTP verification for privileged roles (super_admin, school_admin)
3. **OTP** → Email-based one-time passwords as MFA alternative
4. **Session** → Activity tracking via cookie, configurable timeout (default 60 min)
5. **CSRF** → Cookie + header token validation on state-changing API requests
6. **Rate Limiting** → Login attempts tracked with account lockout
7. **Role Assumption** → Super admins can assume other roles for support/troubleshooting

### Middleware (`middleware.ts`)
- Session activity tracking with timeout enforcement
- MFA verification for privileged paths
- Password change requirement enforcement
- CSRF protection for state-changing API requests
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Protected path routing (redirects unauthenticated users to `/login`)

---

## Database Schema

### Core Tables

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `schools` | name, motto, logo_url, stamp_url, status, education_levels | Institution records |
| `user_profiles` | user_id, school_id, role, email, staff_id, admission_number | Extends auth.users |
| `academic_sessions` | school_id, academic_year, term, is_current | School years/terms |
| `classes` | school_id, name, stream, level, class_teacher_id | Classes with streams |
| `subjects` | school_id, class_id, name, code, is_core, level_group | Core/elective subjects |
| `teachers` | school_id, user_id, staff_id, is_active | Teacher records |
| `teacher_assignments` | teacher_id, class_id, subject_id, is_class_teacher, academic_year | Flexible assignments |
| `students` | school_id, user_id, admission_number, class_id, gender | Student records |
| `parent_student_links` | parent_id, student_id, relationship, is_primary | Parent-child relationships |
| `scores` | student_id, subject_id, session_id, ca_score (0-30), exam_score (0-70), grade | Assessment scores |
| `student_aggregates` | student_id, session_id, aggregate_score, class_position, overall_position | Computed aggregates |
| `attendance` | student_id, session_id, present_days, total_days, percentage | Attendance records |
| `class_teacher_remarks` | student_id, session_id, remark, promotion_status | Promotion decisions |
| `announcements` | school_id, title, content, target_audience, is_urgent | School announcements |

### Security & Monitoring Tables

| Table | Purpose |
|-------|---------|
| `mfa_enrollments` | TOTP MFA configuration (secret, backup codes) |
| `login_otp_challenges` | OTP-based verification challenges |
| `login_attempts` | Brute-force tracking |
| `security_events` | Security event audit log |
| `audit_logs` | General audit trail |
| `email_logs` | Email delivery tracking |
| `system_settings` | Key-value configuration store |

### AI & Governance Tables

| Table | Purpose |
|-------|---------|
| `ai_governance` | AI decision logs |
| `ai_test_cases` | AI test case definitions |
| `ai_regression_tickets` | AI regression tracking |
| `security_rule_history` | Security rule changes |

---

## Grade System

- **Numeric grades**: 1-9 (1=Excellent, 9=Poor) — BECE compatible
- **Aggregate calculation**: 4 core subjects (English, Math, Science, Social Studies) + 4 best electives = 8 total
- **Automated via PostgreSQL triggers**: Recalculates on score changes
- **Core subjects auto-created** per school via `ensureCoreSubjects()`

---

## API Routes

| Route Group | Purpose |
|-------------|---------|
| `/api/auth/*` | Login security, logout, MFA, OTP, staff/student/parent lookups |
| `/api/schools/*` | School CRUD |
| `/api/classes/*` | Class management |
| `/api/teacher/*` | Teacher dashboard data |
| `/api/student/*` | Student performance, reports |
| `/api/parent/*` | Parent reports |
| `/api/profile/*` | Profile management, avatar upload |
| `/api/analytics/*` | Analytics data |
| `/api/super-admin/*` | Super admin ops (assume-role, security, dummy data, GitHub, Twilio) |
| `/api/super-admins/*` | Super admin CRUD |
| `/api/audit-logs/*` | Audit log queries |
| `/api/password-reset/*` | Password reset workflow (request, approval, complete) |
| `/api/ai/*` | AI command, findings, test cases |
| `/api/create-admins/*` | Admin creation |
| `/api/dev/*` | Dev utilities |

---

## Available Agents (`.github/agents/`)

The project includes **100+ specialized agents** organized by domain. Use these to delegate tasks:

### Engineering Agents (50+)

| Agent File | Specialty | Use When... |
|-----------|-----------|-------------|
| `engineering-senior-developer.md` | Premium full-stack implementation | Building premium features, complex full-stack work |
| `engineering-frontend-developer.md` | React/Next.js UI implementation | Building or fixing UI components, pages |
| `engineering-backend-architect.md` | System architecture, API design | Designing APIs, database architecture |
| `engineering-software-architect.md` | High-level architecture decisions | Architecture reviews, system design |
| `engineering-database-optimizer.md` | Query optimization, indexing | Slow queries, performance tuning |
| `engineering-database-reliability-engineer.md` | DB reliability, migrations | Migration planning, data integrity |
| `engineering-api-platform-engineer.md` | API design and platform | Building new API endpoints |
| `engineering-devops-automator.md` | CI/CD, deployment automation | Deployment, infrastructure |
| `engineering-code-reviewer.md` | Code quality review | PR reviews, code quality checks |
| `engineering-rapid-prototyper.md` | Quick prototyping | Building MVPs, proof-of-concepts |
| `engineering-technical-writer.md` | Documentation | Writing docs, README files |
| `engineering-prompt-engineer.md` | AI prompt engineering | Crafting AI prompts |
| `engineering-ai-engineer.md` | AI/ML integration | AI feature implementation |
| `engineering-ai-data-remediation-engineer.md` | AI data quality | AI data cleanup, training data |
| `engineering-identity-access-engineer.md` | Auth & authorization | Auth flows, permissions, RLS |
| `engineering-sre.md` | Site reliability | Monitoring, alerting, uptime |
| `engineering-mobile-app-builder.md` | Mobile development | Mobile app features |
| `engineering-i18n-engineer.md` | Internationalization | Multi-language support |
| `engineering-search-relevance-engineer.md` | Search implementation | Search features |
| `engineering-realtime-collaboration-engineer.md` | Real-time features | WebSockets, live updates |
| `engineering-rag-pipeline-engineer.md` | RAG pipeline engineering | RAG system implementation |
| `engineering-multi-agent-systems-architect.md` | Multi-agent systems | Multi-agent coordination |
| `engineering-autonomous-optimization-architect.md` | Autonomous optimization | Self-optimizing systems |
| `engineering-git-workflow-master.md` | Git workflow management | Git strategy, branching |
| `engineering-minimal-change-engineer.md` | Minimal change implementation | Safe, minimal-impact changes |
| `engineering-incident-response-commander.md` | Incident response | Production incidents |
| `engineering-finops-engineer.md` | Cloud cost optimization | Cost reduction |
| `engineering-webassembly-engineer.md` | WebAssembly | WASM integration |
| `engineering-video-streaming-engineer.md` | Video streaming | Video features |
| `engineering-voice-ai-integration-engineer.md` | Voice AI | Voice features |
| `engineering-iot-fleet-engineer.md` | IoT fleet management | IoT device management |
| `engineering-embedded-firmware-engineer.md` | Embedded firmware | Firmware development |
| `engineering-solidity-smart-contract-engineer.md` | Smart contracts | Blockchain features |
| `engineering-network-engineer.md` | Network engineering | Network configuration |
| `engineering-email-intelligence-engineer.md` | Email systems | Email delivery, templates |
| `engineering-cms-developer.md` | CMS development | CMS features |
| `engineering-codebase-onboarding-engineer.md` | Codebase onboarding | New developer setup |
| `engineering-feishu-integration-developer.md` | Feishu integration | Feishu/Lark integration |
| `engineering-gaussdb-expert.md` | GaussDB expertise | GaussDB database |
| `engineering-it-service-manager.md` | IT service management | ITIL, service desk |
| `engineering-orgscript-engineer.md` | OrgScript engineering | OrgScript language |
| `engineering-payments-billing-engineer.md` | Payments & billing | Payment integration |
| `engineering-section-508-specialist.md` | Section 508 compliance | Accessibility compliance |
| `engineering-uswds-developer.md` | USWDS development | US Web Design System |
| `engineering-wechat-mini-program-developer.md` | WeChat Mini Programs | WeChat integration |
| `engineering-wordpress-performance.md` | WordPress performance | WordPress optimization |
| `engineering-wordpress-shopping-cart.md` | WordPress ecommerce | WooCommerce |
| `engineering-drupal-performance.md` | Drupal performance | Drupal optimization |
| `engineering-drupal-shopping-cart.md` | Drupal ecommerce | Drupal commerce |
| `engineering-filament-optimization-specialist.md` | Filament optimization | Filament admin panels |
| `engineering-desktop-app-engineer.md` | Desktop applications | Electron, Tauri, native apps |
| `engineering-mobile-release-engineer.md` | Mobile release management | App store deployment |

### Security Agents (12)

| Agent File | Specialty | Use When... |
|-----------|-----------|-------------|
| `security-ai-generated-code-auditor.md` | AI code audit | Reviewing AI-generated code |
| `security-appsec-engineer.md` | Application security | Security vulnerabilities |
| `security-architect.md` | Security architecture | Security design review |
| `security-blockchain-security-auditor.md` | Blockchain security | Smart contract audit |
| `security-cloud-security-architect.md` | Cloud security | Cloud infrastructure security |
| `security-compliance-auditor.md` | Compliance auditing | Regulatory compliance |
| `security-incident-responder.md` | Incident response | Security incidents |
| `security-penetration-tester.md` | Penetration testing | Security testing |
| `security-secrets-credential-engineer.md` | Secrets management | Credential security |
| `security-senior-secops.md` | Security operations | Security operations |
| `security-threat-detection-engineer.md` | Threat detection | Threat monitoring |
| `security-threat-intelligence-analyst.md` | Threat intelligence | Threat research |

### Design Agents (10)

| Agent File | Specialty | Use When... |
|-----------|-----------|-------------|
| `design-ui-designer.md` | UI design | Visual design, component styling |
| `design-ux-architect.md` | UX architecture | User flows, information architecture |
| `design-ux-researcher.md` | UX research | User research, usability testing |
| `design-visual-storyteller.md` | Visual storytelling | Data visualization, narrative |
| `design-whimsy-injector.md` | Whimsy & delight | Fun interactions, micro-animations |
| `design-brand-guardian.md` | Brand consistency | Brand guidelines, design system |
| `design-image-prompt-engineer.md` | Image prompt engineering | AI image generation prompts |
| `design-inclusive-visuals-specialist.md` | Inclusive design | Accessibility, diversity in visuals |
| `design-persona-walkthrough.md` | Persona walkthroughs | User journey mapping |
| `design-brand-guardian.md` | Brand guardian | Brand identity protection |

### Marketing Agents (30+)

| Agent File | Specialty |
|-----------|-----------|
| `marketing-seo-specialist.md` | SEO optimization |
| `marketing-content-creator.md` | Content creation |
| `marketing-social-media-strategist.md` | Social media strategy |
| `marketing-email-strategist.md` | Email marketing |
| `marketing-growth-hacker.md` | Growth hacking |
| `marketing-app-store-optimizer.md` | App Store optimization |
| `marketing-agentic-search-optimizer.md` | AI search optimization |
| `marketing-ai-citation-strategist.md` | AI citation strategy |
| `marketing-baidu-seo-specialist.md` | Baidu SEO |
| `marketing-bilibili-content-strategist.md` | Bilibili content |
| `marketing-book-co-author.md` | Book co-authoring |
| `marketing-carousel-growth-engine.md` | Carousel content |
| `marketing-china-ecommerce-operator.md` | China ecommerce |
| `marketing-china-market-localization-strategist.md` | China market localization |
| `marketing-cross-border-ecommerce.md` | Cross-border ecommerce |
| `marketing-douyin-strategist.md` | Douyin strategy |
| `marketing-global-podcast-strategist.md` | Global podcast strategy |
| `marketing-instagram-curator.md` | Instagram curation |
| `marketing-kuaishou-strategist.md` | Kuaishou strategy |
| `marketing-linkedin-content-creator.md` | LinkedIn content |
| `marketing-livestream-commerce-coach.md` | Livestream commerce |
| `marketing-multi-platform-publisher.md` | Multi-platform publishing |
| `marketing-podcast-strategist.md` | Podcast strategy |
| `marketing-pr-communications-manager.md` | PR & communications |
| `marketing-private-domain-operator.md` | Private domain operations |
| `marketing-reddit-community-builder.md` | Reddit community building |
| `marketing-short-video-editing-coach.md` | Short video editing |
| `marketing-tiktok-strategist.md` | TikTok strategy |
| `marketing-twitter-engager.md` | Twitter engagement |
| `marketing-video-optimization-specialist.md` | Video optimization |
| `marketing-wechat-official-account.md` | WeChat official account |
| `marketing-weibo-strategist.md` | Weibo strategy |
| `marketing-x-twitter-intelligence-analyst.md` | X/Twitter intelligence |
| `marketing-xiaohongshu-specialist.md` | Xiaohongshu/RED strategy |
| `marketing-zhihu-strategist.md` | Zhihu strategy |
| `marketing-aeo-foundations.md` | AEO foundations |

### Product Agents (5)

| Agent File | Specialty |
|-----------|-----------|
| `product-manager.md` | Product management |
| `product-behavioral-nudge-engine.md` | Behavioral design |
| `product-feedback-synthesizer.md` | Feedback analysis |
| `product-sprint-prioritizer.md` | Sprint prioritization |
| `product-trend-researcher.md` | Trend research |

### Project Management Agents (6)

| Agent File | Specialty |
|-----------|-----------|
| `project-manager-senior.md` | Senior project management |
| `project-management-experiment-tracker.md` | Experiment tracking |
| `project-management-jira-workflow-steward.md` | Jira workflow |
| `project-management-meeting-notes-specialist.md` | Meeting notes |
| `project-management-project-shepherd.md` | Project shepherding |
| `project-management-studio-operations.md` | Studio operations |
| `project-management-studio-producer.md` | Studio production |

### Testing Agents (8)

| Agent File | Specialty |
|-----------|-----------|
| `testing-test-automation-engineer.md` | Test automation |
| `testing-api-tester.md` | API testing |
| `testing-accessibility-auditor.md` | Accessibility testing |
| `testing-evidence-collector.md` | Test evidence collection |
| `testing-performance-benchmarker.md` | Performance benchmarking |
| `testing-reality-checker.md` | Reality/sanity checking |
| `testing-test-results-analyzer.md` | Test results analysis |
| `testing-tool-evaluator.md` | Tool evaluation |
| `testing-workflow-optimizer.md` | Workflow optimization |

### Support Agents (6)

| Agent File | Specialty |
|-----------|-----------|
| `support-support-responder.md` | Support response |
| `support-analytics-reporter.md` | Support analytics |
| `support-executive-summary-generator.md` | Executive summaries |
| `support-finance-tracker.md` | Finance tracking |
| `support-infrastructure-maintainer.md` | Infrastructure maintenance |
| `support-legal-compliance-checker.md` | Legal compliance |

---

## How to Use Agents

When a task comes in, follow this process:

1. **Identify the domain** (engineering, design, security, testing, marketing, product, project-management, support)
2. **Pick the most specific agent** from `.github/agents/` that matches the task
3. **Read the agent file** to understand its scope, behavior, and tool preferences
4. **Delegate the task** to the agent with clear context and requirements
5. **Review the agent's output** and integrate it back

### Example Agent Selection

| Task | Agent to Use |
|------|-------------|
| "Fix the teacher dashboard showing N/A for assigned classes" | `engineering-codebase-onboarding-engineer.md` (or the teacher-module agent in `.agent.md`) |
| "Add a new API endpoint for student reports" | `engineering-api-platform-engineer.md` |
| "Optimize slow database queries" | `engineering-database-optimizer.md` |
| "Review code for security vulnerabilities" | `security-appsec-engineer.md` |
| "Design a new user onboarding flow" | `design-ux-architect.md` |
| "Write tests for the scoring module" | `testing-test-automation-engineer.md` |
| "Set up CI/CD pipeline" | `engineering-devops-automator.md` |
| "Audit RLS policies" | `security-compliance-auditor.md` |
| "Create documentation for the API" | `engineering-technical-writer.md` |
| "Build a new dashboard page" | `engineering-frontend-developer.md` |
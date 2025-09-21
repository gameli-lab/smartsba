# SmartSBA - Multi-School Assessment & Reporting System

A comprehensive School-Based Assessment (SBA) and reporting system designed for Ghanaian schools. Built with Next.js, TypeScript, and Supabase to handle multi-school environments with role-based access control.

## 🎯 Features

### 📊 Core Functionality

- **Multi-School Support**: Manage multiple schools from a single platform
- **Role-Based Access**: Super Admin, School Admin, Teachers, Students, and Parents
- **Assessment Management**: Continuous Assessment (CA) and Exam scores
- **Report Generation**: Professional Ghanaian-style report cards with QR verification
- **Real-time Analytics**: Performance tracking and class rankings
- **Attendance Tracking**: Student attendance and punctuality monitoring

### 🔐 Authentication System

- **Super Admin**: Email-based login for system administrators
- **Staff (School Admin/Teachers)**: Staff ID-based authentication
- **Students**: Admission number-based login
- **Parents**: Name + ward's admission number authentication

### 📱 User Dashboards

- **Super Admin**: System overview, school management, user analytics
- **School Admin**: School-specific analytics, staff/student management
- **Teachers**: Class management, score entry, student performance
- **Students**: Personal performance, attendance, report access
- **Parents**: Ward's performance, attendance, fee status

## 🛠 Tech Stack

- **Frontend**: Next.js 15 with App Router, TypeScript, TailwindCSS
- **UI Components**: shadcn/ui component library
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Authentication**: Supabase Auth with Row-Level Security (RLS)
- **Database**: PostgreSQL with comprehensive schema and relationships
- **Deployment**: Vercel (Frontend) + Supabase (Backend)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account and project
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd smartsba
npm install
```

### 2. Environment Setup

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database Setup

```bash
# Run migrations
supabase db reset

# Apply schema and RLS policies
psql -h your-db-host -p 5432 -U postgres -d postgres < supabase/migrations/001_initial_schema.sql
psql -h your-db-host -p 5432 -U postgres -d postgres < supabase/migrations/002_rls_policies.sql

# Seed with sample data
psql -h your-db-host -p 5432 -U postgres -d postgres < supabase/seed.sql
```

### 4. Deploy Edge Functions

```bash
supabase functions deploy generate-report
supabase functions deploy calculate-ranks
```

### 5. Start Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   │   └── login/         # Multi-role login
│   ├── (dashboard)/       # Protected dashboard pages
│   │   └── dashboard/     # Role-specific dashboards
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Landing page
├── components/            # Reusable UI components
│   ├── layout/           # Layout components
│   │   ├── dashboard-layout.tsx
│   │   └── sidebar.tsx
│   └── ui/               # shadcn/ui components
├── lib/                  # Utility libraries
│   ├── auth.ts          # Authentication service
│   ├── supabase.ts      # Supabase client
│   └── utils.ts         # Utility functions
└── types/               # TypeScript definitions
    ├── index.ts         # Core types
    └── supabase.ts      # Database types

supabase/
├── functions/           # Edge Functions
│   ├── generate-report/ # PDF report generation
│   └── calculate-ranks/ # Class ranking calculation
├── migrations/          # Database migrations
│   ├── 001_initial_schema.sql
│   └── 002_rls_policies.sql
└── seed.sql            # Sample data
```

## 🗄 Database Schema

### Core Tables

- **user_profiles**: User information for all roles
- **schools**: School details and configuration
- **academic_sessions**: Term/semester management
- **classes**: Class organization
- **subjects**: Subject catalog
- **teachers**: Staff information
- **students**: Student records
- **scores**: Assessment results
- **attendance**: Attendance tracking
- **fees**: Financial records

### Relationships

- Multi-tenant isolation by school
- Role-based data access
- Parent-student relationships
- Teacher-subject-class assignments

## 🔒 Security Features

### Row-Level Security (RLS)

- School-based data isolation
- Role-based access control
- Secure teacher-student relationships
- Parent access to ward data only

### Authentication Flow

1. Role-based login forms
2. Credential validation
3. Session management
4. Route protection via middleware

## 📊 Sample Users (Seed Data)

### Super Admin

- **Email**: admin@smartsba.com
- **Password**: Set via Supabase Auth

### School Admin (Bright Future School)

- **Staff ID**: BF001
- **Name**: Dr. Kwame Asante

### Teacher

- **Staff ID**: BF001
- **Name**: Mr. John Oppong

### Student

- **Admission Number**: BF2024001
- **Name**: Ama Osei

### Parent

- **Name**: Mr. Daniel Osei
- **Ward Admission**: BF2024001

## 🚀 Deployment

### Frontend (Vercel)

```bash
npm run build
vercel --prod
```

### Backend (Supabase)

```bash
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy
```

## 🧪 Testing

### Development Testing

```bash
# Start development server
npm run dev

# Test authentication flows
# Test role-based dashboards
# Test score entry and calculations
```

### Edge Functions Testing

```bash
# Test report generation
curl -X POST 'your-supabase-url/functions/v1/generate-report' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"student_id": "student_001", "session_id": "session_2024_2"}'

# Test rank calculation
curl -X POST 'your-supabase-url/functions/v1/calculate-ranks' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"class_id": "class_001", "session_id": "session_2024_2"}'
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - Multi-role login
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/user` - Current user info

### Edge Functions

- `POST /functions/v1/generate-report` - PDF report generation
- `POST /functions/v1/calculate-ranks` - Class ranking calculation

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💡 Features Roadmap

- [ ] Mobile app (React Native)
- [ ] SMS notifications
- [ ] Fee payment integration
- [ ] Advanced analytics
- [ ] Bulk data import/export
- [ ] Multi-language support
- [ ] WhatsApp integration

## 🆘 Support

For support and questions:

- Email: support@smartsba.com
- Documentation: [Wiki](https://github.com/your-repo/smartsba/wiki)
- Issues: [GitHub Issues](https://github.com/your-repo/smartsba/issues)

---

Built with ❤️ for Ghanaian schools by the SmartSBA Team

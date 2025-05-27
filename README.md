# Elevate Fitness Management Application

A comprehensive fitness business management application built with React, TypeScript, and Supabase.

## Features

### 🔐 Role-Based Access Control (RBAC)
- Complete permission system with admin, staff, and member roles
- Role-based navigation and route protection
- Dynamic menu filtering based on user permissions

### 👥 Member Management
- Complete member registration and profile management
- Member creation with comprehensive form validation
- Member workout tracking and progress monitoring
- Role-based member access controls

### 🏋️ Fitness Business Management
- Coach scheduling and programming
- Attendance tracking and results monitoring
- Billing and invoice management
- Administrative dashboard with analytics

### 📅 Planning & Organization
- Event planning and management
- Social media content planning
- Marketing campaign organization
- Member retention tracking

### 🛠️ Technical Features
- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for responsive design
- Supabase for backend and authentication
- Comprehensive error handling and validation

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Elev8
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy the environment template
   cp .env.example .env.local
   
   # Add your Supabase credentials
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   ```bash
   # Run Supabase migrations
   npx supabase db reset
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard widgets
│   ├── layout/         # Layout components (Header, Sidebar)
│   └── shared/         # Shared utility components
├── context/            # React context providers
├── pages/              # Page components
│   ├── auth/           # Authentication pages
│   ├── member/         # Member-specific pages
│   ├── coach/          # Coach-specific pages
│   ├── billing/        # Billing management
│   └── planning/       # Planning and organization
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── supabase/           # Database migrations and functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks

## Authentication & Roles

The application supports three main user roles:

1. **Admin** - Full access to all features including user management
2. **Staff** - Access to member management, coaching, and billing
3. **Member** - Access to personal dashboard and workout tracking

## Database Schema

The application uses Supabase with the following main tables:
- `profiles` - User profiles with role assignments
- `members` - Member information and fitness data
- `memberships` - Membership types and billing information
- `workouts` - Workout programs and tracking
- `attendance` - Class and session attendance

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please open an issue on GitHub or contact the development team.

---

Built with ❤️ for the fitness community

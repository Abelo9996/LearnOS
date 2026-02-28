# LearnOS Frontend - Enhanced UI

Modern, production-ready frontend for LearnOS 3.0 with full support for multi-LLM integration, authentication, and adaptive learning features.

## New Features Added

### 🔐 Authentication System
- **Login/Register Pages** - User account management with JWT tokens
- **Authentication Provider** - React Context for global auth state
- **Profile Management** - User settings and account information
- **Secure Token Storage** - LocalStorage-based token persistence

### 📚 Content Generation
- **Multi-Modal Content Display** - Explanations, analogies, code samples, diagrams, questions, applications
- **Difficulty Level Selection** - Beginner, Intermediate, Advanced content
- **Rich Content Formatting** - Code highlighting, structured lists, embedded diagrams

### ⚙️ LLM Configuration Dashboard
- **Provider Management** - Register and select LLM providers
- **Usage Analytics** - Track tokens used, costs incurred, requests made
- **Cost Optimization** - Visual breakdown of spending by provider
- **Performance Metrics** - Compare providers by speed, cost, quality

### 👤 User Profile
- **Profile Settings** - Display name, role, tier information
- **Account Info** - Email, username, plan details
- **Quick Navigation** - Links to key features

### 🎨 Enhanced Navigation
- **Smart Navigation Bar** - Dynamic links based on login status
- **Quick Action Cards** - Easy access to main features (Content Gen, LLM Config, Progress)
- **Responsive Design** - Works on desktop, tablet, mobile

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx                 # Root layout with AuthProvider & NavBar
│   ├── page.tsx                   # Home page with feature overview
│   ├── login/
│   │   └── page.tsx               # Login page
│   ├── register/
│   │   └── page.tsx               # Registration page
│   ├── profile/
│   │   └── page.tsx               # User profile & settings
│   ├── content-generation/
│   │   └── page.tsx               # AI content generator
│   ├── llm-config/
│   │   └── page.tsx               # LLM provider dashboard
│   ├── graph/
│   │   └── [goalId]/
│   │       └── page.tsx           # Concept graph visualization
│   ├── learn/
│   │   └── [sessionId]/
│   │       └── page.tsx           # Learning session
│   ├── progress/
│   │   └── page.tsx               # Progress dashboard
│   ├── onboarding/
│   │   └── page.tsx               # Onboarding flow
│   └── globals.css                # Global styles
├── components/
│   └── AuthProvider.tsx           # Auth context provider
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── postcss.config.js
```

## Key Pages

### Home Page (`/`)
- **Unauthenticated Users**: Show register/login buttons
- **Authenticated Users**: Quick access cards to main features
- **Learning Goal Input**: Create new learning goals with concept graph generation

### Login Page (`/login`)
- Email and password form
- Link to registration for new users
- Error handling and feedback

### Register Page (`/register`)
- Email, username, password fields
- Password confirmation
- Link to login for existing users

### Profile Page (`/profile`)
- View account information (email, username, role, tier)
- Edit display name
- Quick navigation to features

### LLM Config Page (`/llm-config`)
- **Statistics Cards**: Total tokens, total cost, request count
- **Provider List**: Available LLM providers with status and capabilities
- **Primary Model Selection**: Choose default LLM for operations
- **Usage Breakdown**: Visual chart of spending by provider

### Content Generation Page (`/content-generation`)
- **Concept Input**: Enter concept to learn
- **Difficulty Selection**: Choose learning level
- **Rich Output Display**:
  - Explanation with key concepts
  - Memorable analogies
  - Practical examples
  - Working code samples
  - Mermaid diagrams
  - Interactive questions
  - Real-world applications

## Component Architecture

### AuthProvider (`components/AuthProvider.tsx`)
```tsx
interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  accessToken: string | null
}

export function AuthProvider({ children }: { children: ReactNode })
export function useAuth()
```

Features:
- JWT token management
- User session persistence
- Automatic token refresh
- Logout handling

### Navigation Bar (in `layout.tsx`)
- Conditional rendering based on login status
- Quick links to major features
- Logout button
- Responsive design

## Setup & Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development Server

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## API Integration

All pages integrate with the LearnOS backend API:

```
Base URL: http://localhost:8000/api
Auth URL: http://localhost:8000/auth
```

### Key Endpoints Used

**Authentication**:
- `POST /auth/register` - Create new account
- `POST /auth/login` - Authenticate user
- `GET /auth/users/me` - Get current user profile
- `PUT /auth/users/me` - Update profile

**LLM Management**:
- `GET /api/llm/providers` - List providers
- `POST /api/llm/users/{user_id}/primary-model` - Set primary model
- `GET /api/llm/usage` - Get usage statistics

**Content Generation**:
- `POST /api/content/generate` - Generate educational content

**Learning**:
- `POST /api/goal` - Create learning goal
- `GET /api/graph/{goal_id}` - Get concept graph
- `GET /api/progress` - Get learning progress

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Styling

Uses **TailwindCSS** for styling:
- Pre-configured color palette
- Responsive utilities
- Custom components in utility classes
- Dark mode support ready

## Features by User Type

### Unauthenticated Visitors
- View home page overview
- Register new account
- Log in to existing account
- Read feature descriptions

### Learners
- Set learning goals
- Generate personalized content
- Track learning progress
- View concept graphs
- Participate in learning sessions
- Manage LLM preferences

### Instructors
- Create learning goals for students
- Generate course content
- View student progress
- Configure LLM settings

### Admins
- Access full analytics
- Manage LLM providers
- Monitor usage and costs
- View system health

## Performance Optimizations

- **Code Splitting**: Next.js automatic route splitting
- **Image Optimization**: Next.js image component
- **Font Optimization**: System font stack
- **Bundle Size**: Tree-shaking unused code

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security Considerations

- ✅ JWT tokens stored in localStorage
- ✅ HTTPS-only in production
- ✅ Secure password transmission
- ✅ CORS enabled for backend
- ✅ Token expiration handling
- ✅ XSS protection via React's built-in escaping

## Testing

To test the frontend locally:

1. Start backend: `cd backend && python main.py`
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://localhost:3000`
4. Register a new account or login
5. Try features: Content generation, LLM config, progress tracking

## Common Issues

### API Connection Failed
- Ensure backend is running on port 8000
- Check `NEXT_PUBLIC_API_URL` environment variable
- Verify CORS is enabled in backend

### Token Expired
- Page will automatically clear invalid tokens
- User will be redirected to login
- Register a new account to get new token

### Content Generation Timeout
- Large concept queries may take longer
- Increase request timeout if needed
- Try simpler concepts first

## Future Enhancements

- [ ] Dark mode support
- [ ] Mobile app (React Native)
- [ ] Offline capability
- [ ] Real-time collaboration
- [ ] Video content support
- [ ] Advanced filtering for resources
- [ ] Social features (peer learning)
- [ ] AI-powered search
- [ ] Analytics dashboard
- [ ] Export/sharing capabilities

## Contributing

This frontend is part of the LearnOS project. See main README for contribution guidelines.

## License

MIT License - See LICENSE file for details

---

**Built with Next.js 14, React 18, TypeScript, and TailwindCSS**

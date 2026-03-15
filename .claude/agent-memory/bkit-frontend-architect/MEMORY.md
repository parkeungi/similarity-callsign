# Frontend Architect Memory

## Project: 유사호출부호 공유시스템

### Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- Zustand (auth state), TanStack Query v5 (server state)
- react-hook-form + zod, axios

### Key Paths
- Source: `/Users/sein/Desktop/katc1/src/`
- Design reference: `/Users/sein/Desktop/katc1/airline.html`
- Design tokens: `src/app/globals.css` (CSS variables), `tailwind.config.ts`

### Architecture Decisions
- accessToken: Zustand memory only (XSS protection)
- refreshToken: cookie via `src/lib/api/client.ts` setCookie/getCookie
- authStore is both `create<AuthStore>()` export AND `useAuthStore` hook alias
- Route groups: `(auth)` for login/signup pages, `(main)` for authenticated pages
- `(auth)/pending/page.tsx` uses TanStack Query refetchInterval for polling (30s)

### Type Locations
- `src/types/user.ts`: User, LoginResponse, SignupRequest, ChangePasswordRequest, ForgotPasswordRequest, ApiError
- `src/types/auth.ts`: LoginRequest, TokenRefreshResponse, AuthState
- auth.ts API imports LoginRequest from @/types/auth (NOT @/types/user)

### Component Map
| Component | Path |
|-----------|------|
| Button | src/components/ui/Button.tsx |
| Input (forwardRef) | src/components/ui/Input.tsx |
| Card/CardHeader/CardBody/CardFooter | src/components/ui/Card.tsx |
| StatusBadge | src/components/ui/StatusBadge.tsx |
| PasswordStrength | src/components/ui/PasswordStrength.tsx |
| Header | src/components/layout/Header.tsx |
| Providers (QueryClient) | src/components/layout/Providers.tsx |
| LoginForm | src/components/forms/LoginForm.tsx |
| SignupForm | src/components/forms/SignupForm.tsx |
| ForgotPasswordForm | src/components/forms/ForgotPasswordForm.tsx |
| ChangePasswordForm | src/components/forms/ChangePasswordForm.tsx |
| UserApprovalTable | src/components/admin/UserApprovalTable.tsx |

### tsconfig Notes
- `"jsx": "preserve"` required for Next.js (not "react-jsx")
- `"noEmit": true` for Next.js type checking pattern
- Must include `"next-env.d.ts"` in include array

### Color System (airline.html synced)
- navy: #1e3a5f, sky: #0891b2, primary: #2563eb
- Top bar: `linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)`
- Auth pages bg: `linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #0891b2 100%)`

### Build Status: Passing (11 routes, all static)

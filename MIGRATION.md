# Migration from Vite to Next.js

This project has been successfully migrated from Vite + React Router to Next.js 15 with App Router.

## Key Changes

### 1. Project Structure
- **Before**: `src/main.tsx` + `index.html` + React Router
- **After**: `app/` directory with Next.js App Router structure

### 2. Routing
- **Before**: React Router with `<BrowserRouter>`, `<Routes>`, `<Route>`
- **After**: Next.js file-based routing in `app/` directory
  - `/` → `app/page.tsx` (Welcome page)
  - `/app` → `app/app/page.tsx` (Main app)
  - `/auth` → `app/auth/page.tsx` (Auth screen)
  - `/progress` → `app/progress/page.tsx` (Progress tracking)
  - `/adventure` → `app/adventure/page.tsx` (redirects to `/app`)

### 3. Navigation
- **Before**: `useNavigate()` from `react-router-dom`
- **After**: `useRouter()` from `next/navigation`
  - `navigate('/path')` → `router.push('/path')`
  - `navigate('/path', { replace: true })` → `router.replace('/path')`

### 4. Environment Variables
- **Before**: `import.meta.env.VITE_*`
- **After**: `process.env.NEXT_PUBLIC_*` (for client-side)
- **Migration**: All env vars now support both formats for compatibility
- **Action Required**: Update your `.env` file to use `NEXT_PUBLIC_` prefix:
  ```
  VITE_FIREBASE_API_KEY → NEXT_PUBLIC_FIREBASE_API_KEY
  VITE_GOOGLE_API_KEY → NEXT_PUBLIC_GOOGLE_API_KEY
  etc.
  ```

### 5. Client Components
- Components using hooks, browser APIs, or state must have `'use client'` directive
- Server components (default) can't use hooks or browser APIs

### 6. Build & Dev Scripts
- **Before**: `vite dev`, `vite build`
- **After**: `next dev`, `next build`, `next start`

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   - Copy `.env.local.example` to `.env.local`
   - Update all `VITE_*` variables to `NEXT_PUBLIC_*` format
   - Or keep both formats for compatibility

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Files Changed

### New Files
- `app/layout.tsx` - Root layout with metadata
- `app/providers.tsx` - Client-side providers wrapper
- `app/page.tsx` - Home page
- `app/app/page.tsx` - Main app page
- `app/auth/page.tsx` - Auth page
- `app/progress/page.tsx` - Progress page
- `app/adventure/page.tsx` - Adventure redirect
- `app/not-found.tsx` - 404 page
- `app/globals.css` - Global styles (moved from `src/index.css`)
- `next.config.js` - Next.js configuration
- `next-env.d.ts` - Next.js TypeScript definitions
- `.eslintrc.json` - ESLint config for Next.js

### Modified Files
- `package.json` - Updated dependencies and scripts
- `tsconfig.json` - Updated for Next.js
- `tailwind.config.ts` - Updated content paths
- All files with `import.meta.env` → Updated to use `process.env`
- All files with React Router → Updated to use Next.js navigation

### Files to Remove (Optional)
- `vite.config.ts` - No longer needed
- `index.html` - Next.js handles HTML generation
- `src/main.tsx` - Replaced by Next.js App Router
- `src/App.tsx` - Logic moved to `app/` directory structure

## Notes

- The app maintains backward compatibility with Vite env vars during transition
- All client components are marked with `'use client'`
- Static assets in `public/` directory work the same way
- Firebase, PostHog, and other integrations continue to work

## Troubleshooting

1. **Environment variables not working**: Ensure they're prefixed with `NEXT_PUBLIC_`
2. **Routing issues**: Check that pages are in the correct `app/` directory structure
3. **Build errors**: Run `npm install` to ensure all dependencies are installed
4. **TypeScript errors**: Ensure `next-env.d.ts` is present and TypeScript config is correct

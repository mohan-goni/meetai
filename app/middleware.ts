// app/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define the protected routes
const protectedRoutes = ['/dashboard'];

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = request.cookies.get('session')?.value;

  // Check if the user is authenticated
  const isAuthenticated = !!session;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !isAuthenticated) {
    // Redirect unauthenticated users to sign-in page
    const signInUrl = new URL('/signin', request.nextUrl.origin);
    signInUrl.searchParams.append('callbackUrl', pathname); // Optional: Pass the current path as a callback URL
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/dashboard'],
};

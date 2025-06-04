// app/signin/page.tsx
import SigninForm from '@/components/auth/signin-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SigninPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md space-y-8 border border-neutral-700 bg-neutral-900/50 backdrop-blur-sm text-neutral-50 shadow-2xl rounded-lg p-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-neutral-50">Sign In</CardTitle>
          <CardDescription className="mt-2 text-sm text-neutral-400">
            Welcome back! Sign in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SigninForm />
        </CardContent>
      </Card>
    </div>
  );
}

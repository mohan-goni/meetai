// app/forgot-password/page.tsx
import ForgotPasswordForm from '@/components/auth/forgot-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md space-y-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Forgot Password</CardTitle>
          <CardDescription className="mt-2 text-sm text-muted-foreground">
            Enter your email address to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

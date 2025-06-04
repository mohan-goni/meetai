'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { signin, signInWithGoogle } from '@/app/actions/auth'; // Import the server action
import { useState } from 'react';
import { useRouter } from 'next/navigation'; // To redirect after successful signin
import { CardFooter } from '@/components/ui/card';
import Link from 'next/link';

// Define the schema for client-side validation
const formSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function SigninForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setError(null); // Clear previous errors
    setIsLoading(true);
    console.log('Attempting to sign in with:', values);

    const formData = new FormData();
    formData.append('email', values.email);
    formData.append('password', values.password);

    try {
      const result = await signin(formData);

      if (result?.success) {
        console.log('Signin successful, redirecting...');
        // Redirect to the dashboard or desired page
        router.push('/dashboard'); // Assuming '/dashboard' is your protected route
      } else {
        // Handle server-side errors
        console.error('Signin failed:', result?.error);
        if (result?.error?._form) {
             setError(result.error._form[0]);
        } else if (result?.error?.email) {
             setError(result.error.email[0]); // Display email-specific error like "Invalid credentials"
        } else {
             setError('An unexpected error occurred during signin.');
        }
      }
    } catch (err) {
      console.error('Error executing signin action:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
        setIsLoading(false);
    }
  }

    async function handleGoogleSignIn() {
        await signInWithGoogle();
    }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  {...field}
                   className={cn(
                     form.formState.errors.email && "border-destructive ring-destructive-foreground focus-visible:ring-destructive"
                   )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  {...field}
                   className={cn(
                     form.formState.errors.password && "border-destructive ring-destructive-foreground focus-visible:ring-destructive"
                   )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && (
            <div className="text-destructive text-sm text-center mt-4">
                {error}
            </div>
        )}
        <Button
          type="submit"
          className="w-full"
           disabled={isLoading}
        >
           {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>
        <Button
            type="button"
            className="w-full bg-google-blue text-white hover:bg-google-blue-dark"
            onClick={handleGoogleSignIn}
        >
            Sign In with Google
        </Button>
       <CardFooter className="flex justify-center px-0 pb-0 mt-6">
         <p className="text-center text-sm text-muted-foreground">
           Don&apos;t have an account?{' '}
           <Link href="/signup" className="font-medium text-primary hover:underline">
             Sign Up
           </Link>
         </p>
       </CardFooter>
    </Form>
  );
}

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
import { signup, signInWithGoogle } from '@/app/actions/auth'; // Import the server action
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { useTransition } from 'react';
import zxcvbn from 'zxcvbn';

// Define the schema for client-side validation
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  // Confirm password can be added here if needed for client-side confirmation
});

const generatePassword = () => {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
};


export default function SignupForm() {
   const router = useRouter();
   const [error, setError] = useState<string | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   const [isGenerating, setIsGenerating] = useState(false);
   const [passwordStrength, setPasswordStrength] = useState<string>('');

  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

    const {
        field: { value: passwordValue, onChange: setPasswordValue },
    } = form.control.register('password');

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
     setError(null); // Clear previous errors
     setIsLoading(true);
     console.log('Attempting to sign up with:', values);

    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('email', values.email);
    formData.append('password', values.password);

    try {
      const result = await signup(formData);

      if (result?.success) {
        console.log('Signup successful, redirecting to signin...');
        // Redirect to the signin page after successful signup
        router.push('/signin');
      } else {
         // Handle server-side errors
        console.error('Signup failed:', result?.error);
         if (result?.error?._form) {
              setError(result.error._form[0]);
         } else if (result?.error?.email) {
              setError(result.error.email[0]); // Display email-specific error like "Email already exists"
         } else {
              setError('An unexpected error occurred during signup.');
         }
      }
    } catch (err) {
        console.error('Error executing signup action:', err);
        setError('An unexpected error occurred. Please try again.');
    } finally {
        setIsLoading(false);
    }
  }

    async function handleGoogleSignIn() {
        await signInWithGoogle();
    }

    const handleGeneratePassword = () => {
      setIsGenerating(true);
      const newPassword = generatePassword();
      form.setValue('password', newPassword);
      setPasswordValue(newPassword)
      setIsGenerating(false);
    };

    useEffect(() => {
        const result = zxcvbn(passwordValue);
        setPasswordStrength(result.score > 2 ? 'Strong' : result.score > 1 ? 'Medium' : passwordValue ? 'Weak' : '');
    }, [passwordValue]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
         <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your name"
                  {...field}
                   className={cn(
                     form.formState.errors.name && "border-destructive ring-destructive-foreground focus-visible:ring-destructive"
                   )}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    value = {passwordValue}
                    onChange={setPasswordValue}
                    className={cn(
                      form.formState.errors.password && "border-destructive ring-destructive-foreground focus-visible:ring-destructive"
                    )}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={isGenerating}
                    onClick={handleGeneratePassword}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    {isGenerating ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <span>Generate</span>
                    )}
                  </Button>
                </div>
                {passwordStrength && (
                  <div className={cn(
                    "text-sm mt-1",
                    passwordStrength === 'Weak' && "text-destructive",
                    passwordStrength === 'Medium' && "text-yellow-500",
                    passwordStrength === 'Strong' && "text-green-500",
                  )}>{passwordStrength}</div>
                )}
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
          {isLoading ? 'Signing Up...' : 'Sign Up'}
        </Button>
      </form>
        <Button
            type="button"
            className="w-full bg-google-blue text-white hover:bg-google-blue-dark"
            onClick={handleGoogleSignIn}
        >
            Sign Up with Google
        </Button>
      <CardFooter className="flex justify-center px-0 pb-0 mt-6">
         <p className="text-center text-sm text-muted-foreground">
           Already have an account?{' '}
           <Link href="/signin" className="font-medium text-primary hover:underline">
             Sign In
           </Link>
         </p>
       </CardFooter>
    </Form>
  );
}

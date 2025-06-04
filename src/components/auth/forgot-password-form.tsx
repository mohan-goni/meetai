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
import { useState } from 'react';
// import { forgotPassword } from '@/app/actions/auth'; // Will import the server action later
import Link from 'next/link';

// Define the schema for client-side validation
const formSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export default function ForgotPasswordForm() {
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setMessage(null); // Clear previous messages
    setIsLoading(true);
    console.log('Attempting forgot password for:', values.email);

    // TODO: Call the forgotPassword server action here
    // const result = await forgotPassword(values.email);
    // For now, simulate a success message
    const result = { success: true }; // Simulate success

    if (result?.success) {
      setMessage({ type: 'success', text: 'If an account with that email exists, we have sent instructions to reset your password.' });
    } else {
      // Handle server-side errors
      console.error('Forgot password failed:', result?.error);
      setMessage({ type: 'error', text: result?.error || 'An unexpected error occurred.' });
    }

    setIsLoading(false);
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
                  placeholder="Enter your email address"
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

        {message && (
            <div className={cn(
                "text-sm text-center mt-4",
                message.type === 'success' ? 'text-green-500' : 'text-destructive'
            )}>
                {message.text}
            </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
           {isLoading ? 'Sending Link...' : 'Send Reset Link'}
        </Button>
      </form>
       <div className="text-center text-sm mt-6">
         <Link href="/signin" className="font-medium text-primary hover:underline">
           Back to Sign In
         </Link>
       </div>
    </Form>
  );
}

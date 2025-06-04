'use server';

import { z } from 'zod';
import { db } from '@/db'; // Assuming your db instance is exported from src/db/index.ts
import { usersTable, passwordResetTokensTable } from '@/db/schema'; // Import schema and tokens table
import bcrypt from 'bcrypt';
import { eq, and, gt } from 'drizzle-orm'; // Import 'and' and 'gt' for queries
import { cookies } from 'next/headers'; // For session management
import { v4 as uuidv4 } from 'uuid'; // For generating UUID tokens
import { addHours } from 'date-fns'; // For calculating expiry time
import { Resend } from 'resend'; // Import Resend
import { redirect } from 'next/navigation'; // Import redirect
import { google } from '@lucia-auth/oauth/providers'; // Using @lucia-auth/oauth as a common pattern for OAuth handling


// --- Email Sending Setup ---
// You would need to install the email service SDK: npm install resend
// And initialize it with your API key from environment variables.
const resend = new Resend(process.env.RESEND_API_KEY); // Make sure RESEND_API_KEY is in your .env
const senderEmail = process.env.EMAIL_FROM as string; // Your verified sender email from .env

if (!senderEmail) {
    console.error("EMAIL_FROM environment variable is not set.");
    // Depending on your application's needs, you might throw an error here
    // or handle this configuration issue during startup.
}

// --- Google OAuth Setup ---
// You would need to install @lucia-auth/oauth and related dependencies:
// npm install @lucia-auth/oauth lucia oslo
// And potentially a Google SDK if fetching additional profile info beyond the basic scope.
// Define your Google OAuth provider configuration
const googleOAuth = google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!, // Your callback URL
    scope: ['email', 'profile'], // Request email and profile access
});


// Define schemas for input validation
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'), // Minimum 1 for basic validation, actual check against hashed
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
    token: z.string().uuid('Invalid token format'),
    password: z.string().min(8, 'New password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Confirm password is required'),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});


export async function signup(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const parsed = signupSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Signup validation failed:', parsed.error);
    // In a real app, return specific errors to the client
    return { success: false, error: parsed.error.formErrors.fieldErrors };
  }

  const { name, email, password } = parsed.data;

  try {
    // Check if user already exists
    const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existingUser.length > 0) {
      return { success: false, error: { email: ['Email already exists'] } };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database
    const newUser = await db.insert(usersTable).values({
      name,
      email,
      hashed_password: hashedPassword,
      email_verified: false, // Email not verified by default
      provider: 'email',
    }).returning({ insertedId: usersTable.id }); // Return inserted ID

    if (newUser.length === 0) {
        return { success: false, error: { _form: ['Failed to create user.'] } };
    }

    // Optional: Set a cookie or create a session after successful signup
    // For simplicity now, we'll handle session on signin.

    console.log('User created successfully:', newUser[0].insertedId);
    return { success: true, userId: newUser[0].insertedId };

  } catch (error) {
    console.error('Error during signup:', error);
    return { success: false, error: { _form: ['An unexpected error occurred.'] } };
  }
}

export async function signin(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const parsed = signinSchema.safeParse(data);

  if (!parsed.success) {
    console.error('Signin validation failed:', parsed.error);
    return { success: false, error: parsed.error.formErrors.fieldErrors };
  }

  const { email, password } = parsed.data;

  try {
    // Find the user by email
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    const user = users[0];

    if (!user || !user.hashed_password) {
      return { success: false, error: { email: ['Invalid credentials'] } };
    }

    // Compare the provided password with the hashed password
    const passwordMatch = await bcrypt.compare(password, user.hashed_password);

    if (!passwordMatch) {
      return { success: false, error: { email: ['Invalid credentials'] } };
    }

    // Optional: Check if email is verified before allowing signin
    // if (!user.email_verified) {
    //   return { success: false, error: { email: ['Please verify your email address'] };
    // }

    // Successful signin - Create a session (using a simple cookie for now)
    // In a real app, you'd generate a session token and potentially store it in a sessions table
    // and/or use a dedicated auth library like NextAuth.js/Auth.js or Clerk.
    const sessionToken = user.id.toString(); // Replace with a proper secure token
    cookies().set('session', sessionToken, {
        httpOnly: true, // Important for security
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
        sameSite: 'strict',
    });


    console.log('User signed in successfully:', user.id);
    return { success: true, userId: user.id };

  } catch (error) {
    console.error('Error during signin:', error);
    return { success: false, error: { _form: ['An unexpected error occurred.'] } };
  }
}

// Placeholder for getting the current user from the session cookie
export async function getCurrentUser() {
  const sessionToken = cookies().get('session')?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    // In a real app, you would look up the session token in your database
    // to find the associated user ID and check session validity/expiry.
    // For this basic example, we assume the session token is the user ID.
    const userId = parseInt(sessionToken, 10);

    if (isNaN(userId)) {
        return null;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];

    return user || null;

  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}


// Placeholder for signout
export async function signout() {
    cookies().delete('session');
    // In a real app, you might also invalidate the session token in the database
    return { success: true };
}


// Forgot Password Server Action with Resend Email Sending
export async function forgotPassword(formData: FormData) {
    const data = Object.fromEntries(formData.entries());
    const parsed = forgotPasswordSchema.safeParse(data);

    if (!parsed.success) {
        console.error('Forgot password validation failed:', parsed.error);
        return { success: false, error: parsed.error.formErrors.fieldErrors };
    }

    const { email } = parsed.data;

    try {
        // Find the user by email
        const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
        const user = users[0];

        // IMPORTANT: Do NOT reveal whether the email exists for security reasons.
        // Always proceed as if the email was found and send a generic message.
         if (!user) {
            console.warn(\`Forgot password attempt for non-existent email: ${email}\`);
             // In a real app, you might still send a dummy email to avoid timing attacks,
            // but for now, we'll just return the success message.
             return { success: true, message: 'If an account with that email exists, we sent a password reset link.' };
        }

        // 1. Generate a secure, time-limited reset token (UUID)
        const resetToken = uuidv4();
        const expiresAt = addHours(new Date(), 1); // Token expires in 1 hour

        // 2. Store the token in the database
        // First, delete any existing tokens for this user to ensure only one is valid at a time
        await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));

        await db.insert(passwordResetTokensTable).values({
            token: resetToken,
            userId: user.id,
            expiresAt: expiresAt,
        });

        // 3. Send an email to the user's email address containing a link with the reset token.
        //    e.g., https://your-app.com/reset-password?token=<generated_token>
        const resetLink = \`\${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}\`; // Assume NEXT_PUBLIC_APP_URL is set in .env


        // --- Resend Email Sending Logic ---
        if (!senderEmail) {
             console.error("Email sending failed: Sender email (EMAIL_FROM) is not configured.");
             // Optionally, return an error or log, but still send generic success to user
             return { success: true, message: 'If an account with that email exists, we sent a password reset link.' };
        }

        console.log(\`Attempting to send password reset email to ${user.email} from ${senderEmail}\`);

        try {
             const { data, error } = await resend.emails.send({
                 from: senderEmail,
                 to: user.email,
                 subject: 'Password Reset Request',
                 text: \`Please use the following link to reset your password: ${resetLink}
This link will expire in 1 hour.\`,
                 html: \`<p>Please use the following link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link will expire in 1 hour.</p>\`,
             });

             if (error) {
                 console.error('Error sending password reset email:', error);
                 // Optionally, log this error to a monitoring service
                 // But still return success to the user for security
             } else {
                 console.log('Password reset email sent successfully:', data);
             }
        } catch (emailError) {
             console.error('Caught exception sending password reset email:', emailError);
             // Log this exception, return generic success message to user
        }
        // -----------------------------


        console.log(\`Password reset initiated for email: ${email}. Reset token generated, stored, and email conceptually sent.\`);
        return { success: true, message: 'If an account with that email exists, we sent a password reset link.' };

    } catch (error) {
        console.error('Error during forgot password process:', error);
        return { success: false, error: { _form: ['An unexpected error occurred.'] } };
    }
}


// Reset Password Server Action (Added in previous step)
export async function resetPassword(formData: FormData) {
    const data = Object.fromEntries(formData.entries());
    const parsed = resetPasswordSchema.safeParse(data);

    if (!parsed.success) {
        console.error('Reset password validation failed:', parsed.error);
        return { success: false, error: parsed.error.formErrors.fieldErrors };
    }

    const { token, password } = parsed.data; // We don't need confirmPassword after validation

    try {
        const now = new Date();

        // 1. Find the token in the database and check if it's valid (exists and not expired)
        const tokens = await db.select()
            .from(passwordResetTokensTable)
            .where(and(
                eq(passwordResetTokensTable.token, token),
                gt(passwordResetTokensTable.expiresAt, now) // Check if token is not expired
            ))
            .limit(1);

        const validToken = tokens[0];

        if (!validToken) {
            return { success: false, error: { _form: ['Invalid or expired reset token.'] } };
        }

        // 2. Find the user associated with the token
        const users = await db.select().from(usersTable).where(eq(usersTable.id, validToken.userId)).limit(1);
        const user = users[0];

        if (!user) {
             // This should ideally not happen if token refers to a valid user, but good for safety
             console.error(\`User not found for valid token: ${token}\`);
             return { success: false, error: { _form: ['An unexpected error occurred.'] } };
        }

        // 3. Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Update the user's password in the database
        await db.update(usersTable)
            .set({ hashed_password: hashedPassword })
            .where(eq(usersTable.id, user.id));

        // 5. Invalidate/Delete the reset token after use
        await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.token, token));

        console.log(\`Password successfully reset for user ID: ${user.id}\`);
        return { success: true, message: 'Your password has been successfully reset.' };

    } catch (error) {
        console.error('Error during reset password process:', error);
        return { success: false, error: { _form: ['An unexpected error occurred.'] } };
    }
}


// --- Google Authentication Server Actions ---

// Action to initiate Google OAuth flow
export async function signInWithGoogle() {
    try {
        // Generate the authorization URL and state
        const [url, state] = await googleOAuth.generateAuthorizationURL();

        // Set the state as a cookie to verify on callback
        cookies().set('google_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60, // State expires in 1 hour
            path: '/',
        });

        // Redirect the user to Google's authentication page
        redirect(url.toString());

    } catch (error) {
        console.error('Error initiating Google OAuth:', error);
        // In a real app, redirect to an error page or show a message
        redirect('/signin?error=google_oauth_failed'); // Example redirect to signin with error
    }
}

// Action to handle Google OAuth callback
// This action should be called from your Google Redirect URI route (e.g., /api/auth/callback/google/route.ts)
export async function handleGoogleOAuthCallback(searchParams: URLSearchParams): Promise<{ success: boolean; userId?: number; error?: string }> {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const storedState = cookies().get('google_oauth_state')?.value;

    // 1. Validate state parameter to prevent CSRF attacks
    if (!state || !storedState || state !== storedState) {
        console.error('Google OAuth callback failed: State mismatch or missing.');
        // Handle error - redirect to an error page or signin page
        return { success: false, error: 'Authentication failed (state mismatch).';
    }

    // Clear the state cookie
    cookies().delete('google_oauth_state');

    // 2. Exchange authorization code for tokens
    if (!code) {
         console.error('Google OAuth callback failed: Code parameter missing.');
         return { success: false, error: 'Authentication failed (code missing).';
    }

    try {
        const { getGoogleUser, getExistingUser, createUser, tokens } = await googleOAuth.validateCallback(code);
        const googleUser = await getGoogleUser(); // This fetches the user's profile information from Google
        const userEmail = googleUser.email;
        const userId = googleUser.id;
        const userName = googleUser.name;

        if (!userEmail) {
            console.error('Google OAuth callback failed: Email not provided by Google.');
            return { success: false, error: 'Authentication failed (email missing from Google).';
        }


        // 4. Find or create user in your database
        const existingUser = await getExistingUser(userId);


        let dbUserId;

        if (existingUser) {
            // User exists, log them in
            dbUserId = existingUser.id;
            console.log('Existing Google user found, signing in:', dbUserId);

             // Optional: Update user info from Google if needed
             // await db.update(usersTable).set({ name: googleUser.name }).where(eq(usersTable.id, userId));

        } else {
            // User does not exist, create a new one
            console.log('New Google user, creating account...');

            try{
                const newUser = await createUser({
                     attributes: {
                         email: userEmail,
                         name: userName || 'Google User', // Use name from Google or a default
                         provider: 'google',
                         provider_id: userId,
                         email_verified: true, // Assume email is verified by Google
                         // hashed_password will be null for social logins
                     }
                 });
                 dbUserId = newUser.id;
                  console.log('New Google user created:', dbUserId);
            } catch (e){
                console.log(e)
                return { success: false, error: 'database error' };
            }


        }

        // 5. Establish session (using the same cookie logic as email/password signin)
        const sessionToken = dbUserId.toString(); // Replace with a proper secure token method
        cookies().set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
            sameSite: 'strict',
        });

        console.log('Google user signed in successfully:', dbUserId);
        return { success: true, userId: dbUserId };


    } catch (error) {
        console.error('Error handling Google OAuth callback:', error);
        // Handle error - redirect to an error page or signin page
        return { success: false, error: 'Authentication failed.' };
    }
}


// --- Future additions (Placeholders) ---

// export async function suggestStrongPassword() {
//   // Implement strong password suggestion logic (client-side is better for UI feedback)
// }

// export async function signInWithTwitter() {
//   // Implement Twitter OAuth flow
// }

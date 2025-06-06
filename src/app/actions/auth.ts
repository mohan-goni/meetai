'use server';

import 'dotenv/config'; // Ensure environment variables are loaded

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
import { auth } from '@/lib/lucia'; // Import the Lucia auth instance
import { generateCodeVerifier, generateState } from "arctic"; // Import for Google OAuth


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
const googleOAuth = google(auth, {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    scope: ['email', 'profile'],
});


// Define schemas for input validation
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
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
    return { success: false, error: parsed.error.formErrors.fieldErrors };
  }

  const { name, email, password } = parsed.data;

  try {
    const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existingUser.length > 0) {
      return { success: false, error: { email: ['Email already exists'] } };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.insert(usersTable).values({
      name,
      email,
      hashed_password: hashedPassword,
      email_verified: false,
      provider: 'email',
    }).returning({ insertedId: usersTable.id });

    if (newUser.length === 0) {
        return { success: false, error: { _form: ['Failed to create user.'] } };
    }

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
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    const user = users[0];

    if (!user || !user.hashed_password) {
      console.error('Signin failed: User not found or password missing for email:', email);
      return { success: false, error: { email: ['Invalid credentials'] } };
    }

    const passwordMatch = await bcrypt.compare(password, user.hashed_password);

    if (!passwordMatch) {
      console.error('Signin failed: Password mismatch for email:', email);
      return { success: false, error: { email: ['Invalid credentials'] } };
    }

    const sessionToken = user.id.toString();
    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
        sameSite: 'strict',
    });

    console.log('User signed in successfully:', user.id);
    redirect('/dashboard');

  } catch (error) {
    console.error('Error during signin action:', error);
    return { success: false, error: { _form: ['An unexpected error occurred during signin.'] } };
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    console.log('getCurrentUser: No session token found.');
    return null;
  }

  try {
    const userId = parseInt(sessionToken, 10);

    if (isNaN(userId)) {
        console.warn('getCurrentUser: Invalid session token format, not a number:', sessionToken);
        return null;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];

    if (!user) {
        console.warn('getCurrentUser: No user found for session token userId:', userId);
    }

    return user || null;

  } catch (error) {
    console.error('Error in getCurrentUser function:', error);
    return null;
  }
}


export async function signout() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    return { success: true };
}


export async function forgotPassword(formData: FormData) {
    const data = Object.fromEntries(formData.entries());
    const parsed = forgotPasswordSchema.safeParse(data);

    if (!parsed.success) {
        console.error('Forgot password validation failed:', parsed.error);
        return { success: false, error: parsed.error.formErrors.fieldErrors };
    }

    const { email } = parsed.data;

    try {
        const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
        const user = users[0];

         if (!user) {
            console.warn('Forgot password attempt for non-existent email: ' + email);
             return { success: true, message: 'If an account with that email exists, we sent a password reset link.' };
        }

        const resetToken = uuidv4();
        const expiresAt = addHours(new Date(), 1);

        await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));

        await db.insert(passwordResetTokensTable).values({
            token: resetToken,
            userId: user.id,
            expiresAt: expiresAt,
        });

        const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;


        if (!senderEmail) {
             console.error("Email sending failed: Sender email (EMAIL_FROM) is not configured.");
             return { success: true, message: 'If an account with that email exists, we sent a password reset link.' };
        }

        console.log(`Attempting to send password reset email to ${user.email} from ${senderEmail}`);

        try {
             const { data, error } = await resend.emails.send({
                 from: senderEmail,
                 to: [user.email],
                 subject: 'Password Reset Request',
                 text: `Please use the following link to reset your password: ${resetLink}\nThis link will expire in 1 hour.`,
                 html: `<p>Please use the following link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link will expire in 1 hour.</p>`,
             });

             if (error) {
                 console.error('Error sending password reset email:', error);
             } else {
                 console.log('Password reset email sent successfully:', data);
             }
        } catch (emailError) {
             console.error('Caught exception sending password reset email:', emailError);
        }


        console.log(`Password reset initiated for email: ${email}. Reset token generated, stored, and email conceptually sent.`);
        return { success: true, message: 'If an account with that email exists, we sent a password reset link.' };

    } catch (error) {
        console.error('Error during forgot password process:', error);
        return { success: false, error: { _form: ['An unexpected error occurred.'] } };
    }
}


export async function resetPassword(formData: FormData) {
    const data = Object.fromEntries(formData.entries());
    const parsed = resetPasswordSchema.safeParse(data);

    if (!parsed.success) {
        console.error('Reset password validation failed:', parsed.error);
        return { success: false, error: parsed.error.formErrors.fieldErrors };
    }

    const { token, password } = parsed.data;

    try {
        const now = new Date();

        const tokens = await db.select()
            .from(passwordResetTokensTable)
            .where(and(
                eq(passwordResetTokensTable.token, token),
                gt(passwordResetTokensTable.expiresAt, now)
            ))
            .limit(1);

        const validToken = tokens[0];

        if (!validToken) {
            return { success: false, error: { _form: ['Invalid or expired reset token.'] } };
        }

        const users = await db.select().from(usersTable).where(eq(usersTable.id, validToken.userId)).limit(1);
        const user = users[0];

        if (!user) {
             console.error(`User not found for valid token: ${token}`);
             return { success: false, error: { _form: ['An unexpected error occurred.'] } };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.update(usersTable)
            .set({ hashed_password: hashedPassword })
            .where(eq(usersTable.id, user.id));

        await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.token, token));

        console.log(`Password successfully reset for user ID: ${user.id}`);
        return { success: true, message: 'Your password has been successfully reset.' };

    } catch (error) {
        console.error('Error during reset password process:', error);
        return { success: false, error: { _form: ['An unexpected error occurred.'] } };
    }
}


export async function signInWithGoogle() {
    try {
        const state = generateState();
        const codeVerifier = generateCodeVerifier(); // Generate code verifier
        const url = await googleOAuth.getAuthorizationUrl(); // Pass code verifier and scopes

        const cookieStore = await cookies();
        cookieStore.set('google_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60,
            path: '/',
        });
        cookieStore.set('google_code_verifier', codeVerifier, { // Store code verifier
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60,
        });

        redirect(url.toString());

    } catch (error) {
        console.error('Error initiating Google OAuth:', error);
        redirect('/signin?error=google_oauth_failed');
    }
}

export async function handleGoogleOAuthCallback(searchParams: URLSearchParams): Promise<{ success: boolean; userId?: number; error?: string }> {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const storedState = (await cookies()).get('google_oauth_state')?.value;
    const storedCodeVerifier = (await cookies()).get('google_code_verifier')?.value; // Retrieve code verifier

    if (!code || !state || !storedState || !storedCodeVerifier || state !== storedState) { // Add storedCodeVerifier to validation
        console.error('Google OAuth callback failed: State or code verifier mismatch or missing.');
        return { success: false, error: 'Authentication failed (state or code verifier mismatch).' };
    }

    (await cookies()).delete('google_oauth_state');
    (await cookies()).delete('google_code_verifier'); // Delete code verifier cookie

    try {
        // validateCallback returns a GoogleUserAuth object, which has googleUser and googleTokens properties
        const { googleUser } = await googleOAuth.validateCallback(code); // Pass code verifier
        const userEmail = googleUser.email;
        const googleId = googleUser.sub; // Google's user ID is `sub` property in claims
        const userName = googleUser.name;

        if (!userEmail) {
            console.error('Google OAuth callback failed: Email not provided by Google.');
            return { success: false, error: 'Authentication failed (email missing from Google).' };
        }

        // Instead of getExistingUser/createUser directly from validateCallback, use your own DB logic
        const existingUser = await db.select().from(usersTable).where(eq(usersTable.provider_id, googleId)).limit(1);

        let dbUserId;

        if (existingUser.length > 0) {
            dbUserId = existingUser[0].id;
            console.log('Existing Google user found, signing in:', dbUserId);

        } else {
            console.log('New Google user, creating account...');

            try{
                const newUser = await auth.createUser({
                     key: {
                         providerId: 'google',
                         providerUserId: googleId,
                     },
                     attributes: {
                         email: userEmail,
                         name: userName || 'Google User',
                         provider: 'google',
                         provider_id: googleId,
                         email_verified: true,
                     },
                 });
                 dbUserId = newUser.userId;
                  console.log('New Google user created:', dbUserId);
            } catch (e){
                console.log(e)
                return { success: false, error: 'database error' };
            }


        }

        const session = await auth.createSession(dbUserId, {}); // Create a session for the user
        const sessionCookie = auth.createSessionCookie(session.id);
        (await cookies()).set(sessionCookie.name, sessionCookie.value, {
            path: sessionCookie.attributes.path,
            expires: sessionCookie.attributes.expires,
            maxAge: sessionCookie.attributes.maxAge,
            httpOnly: sessionCookie.attributes.httpOnly,
            secure: sessionCookie.attributes.secure,
            sameSite: sessionCookie.attributes.sameSite,
        });

        console.log('Google user signed in successfully:', dbUserId);
        return { success: true, userId: dbUserId };


    } catch (error) {
        console.error('Error handling Google OAuth callback:', error);
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

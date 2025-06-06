import { Lucia } from "lucia";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "@/db";
import { usersTable, sessionsTable } from "@/db/schema";

export const auth = new Lucia({
  adapter: new DrizzlePostgreSQLAdapter(db, sessionsTable, usersTable),
  sessionCookie: {
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      name: attributes.name,
      provider: attributes.provider,
      providerId: attributes.provider_id,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof auth;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  email: string;
  name: string;
  provider: string;
  provider_id: string | null;
} 
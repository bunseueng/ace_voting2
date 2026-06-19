// app/api/auth/[...nextauth]/route.ts (or route.js depending on your setup)
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Admin credentials (set in .env)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_HASHED_PASSWORD = process.env.ADMIN_HASHED_PASSWORD;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials;

        if (!ADMIN_EMAIL || !ADMIN_HASHED_PASSWORD) {
          throw new Error("Server auth not configured");
        }

        if (email !== ADMIN_EMAIL) {
          throw new Error("Unauthorized email");
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          ADMIN_HASHED_PASSWORD
        );
        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

        return { id: "admin-id", name: "Admin", email };
      },
    }),
  ],
  pages: {
    signIn: "/sign_in",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      return session;
    },
  },
});

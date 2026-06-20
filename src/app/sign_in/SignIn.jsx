"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader } from "lucide-react";

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });
      if (res?.error) {
        setError("Invalid username or password.");
        toast.error("Sign in failed.");
      } else {
        toast.success("Signed in.");
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-sm mx-auto mt-10 space-y-4 px-4"
    >
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <input
        type="text"
        name="username"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="border px-3 py-2 w-full"
        autoComplete="off"
        required
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border px-3 py-2 w-full"
        autoComplete="new-password"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-500 text-white py-2 px-4 flex items-center justify-center disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
}

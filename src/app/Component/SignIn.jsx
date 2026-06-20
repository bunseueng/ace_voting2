import { auth, signOut } from "@/auth";
import Link from "next/link";

export default async function SignIn() {
  const session = await auth();
  const user = session?.user;
  return (
    <>
      {user ? (
        <form
          action={async () => {
            "use server";

            await signOut();
          }}
        >
          <button
            type="submit"
            className="cursor-pointer rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Sign Out
          </button>
        </form>
      ) : (
        <Link
          href={"/sign_in"}
          className="block cursor-pointer rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Sign In
        </Link>
      )}
    </>
  );
}

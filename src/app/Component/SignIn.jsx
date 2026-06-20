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
          <button type="submit" className="cursor-pointer">Sign Out</button>
        </form>
      ) : (
        <Link
          href={"/sign_in"}
          className="cursor-pointer p-0 m-0 block text-sm md:text-lg"
        >
          <button type="button" className="cursor-pointer">Sign In</button>
        </Link>
      )}
    </>
  );
}

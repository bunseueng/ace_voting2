import React from "react";
import SignIn from "./SignIn";
import Link from "next/link";
import { auth } from "@/auth";

const Navbar = async () => {
  const session = await auth();
  const isAdmin = session?.user?.role === "Admin";
  return (
    <nav className="bg-white border-gray-200 dark:bg-gray-900">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <div
          href="https://flowbite.com/"
          className="flex items-center space-x-3 rtl:space-x-reverse"
        >
          <Link href="/" className="flex items-center">
            <img
              src="https://flowbite.com/docs/images/logo.svg"
              className="h-8"
              alt="Flowbite Logo"
            />
            <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">
              ACE
            </span>
          </Link>
        </div>

        <div className="block md:w-auto" id="navbar-default">
          <ul className="font-medium flex p-0 flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 bg-white dark:bg-gray-900 dark:border-gray-700">
            {isAdmin && (
              <>
                <li>
                  <a
                    href="/dashboard"
                    className="block text-sm md:text-lg bg-transparent md:p-0 dark:text-white text-blue-500 px-1"
                    aria-current="page"
                  >
                    Admin Dashboard
                  </a>
                </li>
                <li>
                  <a
                    href="/dashboard/poster"
                    className="block text-sm md:text-lg bg-transparent md:p-0 dark:text-white text-blue-500 px-1"
                    aria-current="page"
                  >
                    Create Poster
                  </a>
                </li>
              </>
            )}
            <li>
              <SignIn />
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

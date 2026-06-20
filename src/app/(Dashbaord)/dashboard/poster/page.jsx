import React from "react";
import { auth } from "@/auth"; // or wherever your auth comes from
import CreatePoster from "./CreatePoster";
import Navbar from "@/app/Component/Navbar";

const CreatePosterPage = async () => {
  const session = await auth();
  const userId = session?.user.name; // Also fetch posters to get their titles and status
  if (session?.user?.role !== "Admin") {
    return (
      <>
        <Navbar />
        <div className="text-center mt-20 text-red-500 text-xl font-semibold">
          You&apos;re not authorized to view this page.
        </div>
      </>
    );
  }
  return (
    <>
      <Navbar /> <CreatePoster userId={userId} />
    </>
  );
};

export default CreatePosterPage;

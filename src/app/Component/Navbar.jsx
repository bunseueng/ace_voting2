import { auth } from "@/auth";
import SignIn from "./SignIn";
import NavbarClient from "./NavbarClient";

const Navbar = async () => {
  const session = await auth();
  const isAdmin = session?.user?.role === "Admin";
  return <NavbarClient isAdmin={isAdmin} authSlot={<SignIn />} />;
};

export default Navbar;

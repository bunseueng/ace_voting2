import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import cloudinary, { cloudinaryConfigured } from "@/lib/cloudinary";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!cloudinaryConfigured()) {
      return NextResponse.json(
        { message: "Cloudinary is not configured on the server." },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ message: "No file provided." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${bytes.toString("base64")}`;

    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "ace_voting",
    });

    await prisma.setting.upsert({
      where: { key: "banner" },
      update: { value: uploaded.secure_url },
      create: { key: "banner", value: uploaded.secure_url },
    });

    revalidateTag("banner");
    return NextResponse.json({ url: uploaded.secure_url }, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Failed to upload banner", { status: 500 });
  }
}

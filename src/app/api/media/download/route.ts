import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFilePath } from "@/lib/storage";
import fs from "fs";
import { ZipArchive } from "archiver";
import { Readable } from "stream";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid or empty media IDs list" }, { status: 400 });
    }

    // Retrieve media items belonging to the user
    const mediaItems = await prisma.media.findMany({
      where: {
        id: { in: ids },
        userId: session.userId,
      },
    });

    if (mediaItems.length === 0) {
      return NextResponse.json({ error: "No media files found" }, { status: 404 });
    }

    // Set up archiving stream using ZipArchive class
    const archive = new ZipArchive({
      zlib: { level: 5 }, // moderate compression level for speed
    });

    // Create a readable stream for the response body
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Pipe archive output into our response writer
    archive.on("data", (chunk) => {
      writer.write(chunk);
    });

    archive.on("end", () => {
      writer.close();
    });

    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      writer.abort(err);
    });

    // Process files and append to archive
    // Using an async self-invoking function to process files without blocking the response creation
    (async () => {
      try {
        for (const item of mediaItems) {
          const filename = item.filename;

          if (item.url.startsWith("/uploads/")) {
            // Local file storage
            const filePath = getFilePath(item.url);
            if (fs.existsSync(filePath)) {
              archive.append(fs.createReadStream(filePath), { name: filename });
            } else {
              console.warn(`File not found on disk: ${filePath}`);
            }
          } else {
            // S3 or remote storage provider
            try {
              const res = await fetch(item.url);
              if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                archive.append(buffer, { name: filename });
              } else {
                console.warn(`Failed to fetch remote file: ${item.url}`);
              }
            } catch (err) {
              console.error(`Error fetching remote file: ${item.url}`, err);
            }
          }
        }
        await archive.finalize();
      } catch (err) {
        console.error("Failed to compile ZIP archive:", err);
        archive.destroy(err as any);
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=vividgallery_batch_${Date.now()}.zip`,
      },
    });
  } catch (error: any) {
    console.error("Batch download error:", error);
    return NextResponse.json(
      { error: "Batch download failed", details: error?.message },
      { status: 500 }
    );
  }
}

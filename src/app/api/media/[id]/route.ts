import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureMediaUrls } from "@/lib/mediaUrl";

// GET a specific media file details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const media = await prisma.media.findUnique({
      where: { id, userId: session.userId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        likes: true,
      },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const securedMedia = secureMediaUrls([media], session.userId)[0];
    return NextResponse.json({ success: true, media: securedMedia });
  } catch (error) {
    console.error("Fetch single media error:", error);
    return NextResponse.json(
      { error: "Failed to fetch media details" },
      { status: 500 }
    );
  }
}

// PUT (update) a specific media file (rename filename and edit tags)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { filename, tags, visibility, isFavorite } = body;

    // Verify ownership
    const media = await prisma.media.findUnique({
      where: { id, userId: session.userId },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found or unauthorized" }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof filename === "string") {
      updateData.filename = filename.trim();
    }
    if (typeof visibility === "string") {
      updateData.visibility = visibility;
    }
    if (typeof isFavorite === "boolean") {
      updateData.isFavorite = isFavorite;
    }

    // Process tag changes if tags array is provided
    if (Array.isArray(tags)) {
      // Clean and normalize tags
      const cleanTags = tags
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.length > 0);

      // Create tag records if they don't exist
      const tagRecords = await Promise.all(
        cleanTags.map(async (name: string) => {
          return prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          });
        })
      );

      // Remove existing tag associations
      await prisma.mediaTag.deleteMany({
        where: { mediaId: id },
      });

      // Add new associations
      if (tagRecords.length > 0) {
        await prisma.mediaTag.createMany({
          data: tagRecords.map((tag) => ({
            mediaId: id,
            tagId: tag.id,
          })),
        });
      }
    }

    // Perform database update
    const updatedMedia = await prisma.media.update({
      where: { id },
      data: updateData,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        likes: true,
      },
    });

    // Log update action
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "MEDIA_UPDATE",
        details: `Updated details for media ID ${id}: ${filename || "metadata"}`,
      },
    });

    const securedMedia = secureMediaUrls([updatedMedia], session.userId)[0];
    return NextResponse.json({ success: true, media: securedMedia });
  } catch (error) {
    console.error("Update media error:", error);
    return NextResponse.json(
      { error: "Failed to update media" },
      { status: 500 }
    );
  }
}

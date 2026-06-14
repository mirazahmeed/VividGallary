import { prisma } from "@/lib/db";

/**
 * Gets or creates the user's default "Random Media" album.
 * This album auto-collects uploads that aren't assigned to a specific album.
 * It cannot be deleted or renamed.
 */
export async function getOrCreateDefaultAlbum(userId: string) {
  let album = await prisma.album.findFirst({
    where: { userId, isDefault: true },
  });

  if (!album) {
    album = await prisma.album.create({
      data: {
        name: "Random Media",
        description: "Auto-collection for uploads without a specific album",
        isDefault: true,
        visibility: "PRIVATE",
        userId,
      },
    });
  }

  return album;
}

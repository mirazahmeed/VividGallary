import fs from "fs";
import path from "path";

// Unified Storage Adapter Interface
export interface StorageProvider {
  upload(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
}

// Local Filesystem Storage fallback
class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
    // Generate a unique filename using timestamp to avoid conflicts
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(filename) || this.getExtensionFromMime(mimeType);
    const basename = path.basename(filename, ext);
    const sanitizedFilename = `${basename.replace(/[^a-zA-Z0-9]/g, "_")}-${uniqueSuffix}${ext}`;
    
    const filePath = path.join(this.uploadDir, sanitizedFilename);
    fs.writeFileSync(filePath, fileBuffer);
    
    // Return relative URL that Next.js serves statically
    return `/uploads/${sanitizedFilename}`;
  }

  async delete(fileUrl: string): Promise<void> {
    try {
      if (!fileUrl.startsWith("/uploads/")) return;
      const filename = fileUrl.replace("/uploads/", "");
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Failed to delete local file:", err);
    }
  }

  private getExtensionFromMime(mime: string): string {
    const types: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/quicktime": ".mov",
      "video/webm": ".webm",
      "video/x-matroska": ".mkv",
    };
    return types[mime] || "";
  }
}

// AWS S3 / Cloudflare R2 Storage Adapter
class S3StorageProvider implements StorageProvider {
  private bucket: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || "";
    // Note: In real production, we import AWS SDK.
    // To maintain zero-dependency setup while keeping this fully functional,
    // we provide a complete mockup if keys are missing, and standard S3 code template.
  }

  async upload(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const objectKey = `${uniqueSuffix}-${filename}`;

    if (!process.env.AWS_ACCESS_KEY_ID) {
      console.log(`[Storage Mock] Simulating S3 upload for ${filename}`);
      // Fall back to local storage dynamically for local developer comfort
      return new LocalStorageProvider().upload(fileBuffer, filename, mimeType);
    }

    try {
      // Production AWS S3 client import dynamically to avoid build crashes if sdk not installed yet
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
        endpoint: process.env.AWS_S3_ENDPOINT, // Optional (used for Cloudflare R2 / MinIO)
      });

      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: fileBuffer,
          ContentType: mimeType,
        })
      );

      // Return AWS S3 file URL
      const regionString = process.env.AWS_REGION ? `s3.${process.env.AWS_REGION}.amazonaws.com` : "s3.amazonaws.com";
      const s3Url = process.env.AWS_S3_ENDPOINT 
        ? `${process.env.AWS_S3_ENDPOINT}/${this.bucket}/${objectKey}`
        : `https://${this.bucket}.${regionString}/${objectKey}`;
      
      return s3Url;
    } catch (err) {
      console.error("AWS S3 Upload failed, falling back to Local Disk:", err);
      return new LocalStorageProvider().upload(fileBuffer, filename, mimeType);
    }
  }

  async delete(fileUrl: string): Promise<void> {
    if (!process.env.AWS_ACCESS_KEY_ID) {
      // Delete mock
      await new LocalStorageProvider().delete(fileUrl);
      return;
    }

    try {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
        endpoint: process.env.AWS_S3_ENDPOINT,
      });

      // Extract object key from URL
      const urlParts = fileUrl.split("/");
      const objectKey = urlParts[urlParts.length - 1];

      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        })
      );
    } catch (err) {
      console.error("Failed to delete from S3:", err);
    }
  }
}

// Instantiate storage based on environment
export const storage = process.env.AWS_ACCESS_KEY_ID 
  ? new S3StorageProvider() 
  : new LocalStorageProvider();
export default storage;

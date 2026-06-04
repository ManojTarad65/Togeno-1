import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/types";
import { supabaseAdmin } from "@/config";
import { sendSuccess } from "@/utils/response";
import { ApiError } from "@/utils/errors";

const BUCKET_NAME = "community-images";
const POST_MEDIA_BUCKET = "post-media";
const PRODUCT_IMAGES_BUCKET = "product-images";
const SHIPMENT_LABELS_BUCKET = "shipment-labels";

// Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POST_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]);
const LABEL_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

// Max sizes in bytes
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_POST_MEDIA_SIZE = 50 * 1024 * 1024; // 50MB

function getExtFromMime(mimetype: string): string {
  if (mimetype === "image/png") return "png";
  if (mimetype === "image/webp") return "webp";
  if (mimetype === "video/mp4") return "mp4";
  if (mimetype === "video/quicktime") return "mov";
  return "jpg";
}

/**
 * Ensures the storage bucket exists (creates it if not).
 * Called once on first upload attempt.
 */
let bucketChecked = false;
async function ensureBucket() {
  if (bucketChecked) return;
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_COVER_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });
  }
  bucketChecked = true;
}

class UploadController {
  /**
   * POST /communities/:id/upload-image
   * Upload a community avatar or cover image.
   *
   * Expects multipart/form-data with:
   *   - file: the image file
   *   - type: "avatar" | "cover"
   */
  async uploadCommunityImage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id: communityId } = req.params;
      const imageType = req.body?.type as string | undefined;

      if (!imageType || !["avatar", "cover"].includes(imageType)) {
        throw ApiError.badRequest('Query param "type" must be "avatar" or "cover"');
      }

      // The file is populated by multer middleware
      const file = (req as any).file;
      if (!file) {
        throw ApiError.badRequest("No file provided");
      }

      // Validate MIME type
      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        throw ApiError.badRequest(
          `Invalid file type "${file.mimetype}". Allowed: jpg, png, webp`
        );
      }

      // Validate size based on type
      const maxSize = imageType === "avatar" ? MAX_AVATAR_SIZE : MAX_COVER_SIZE;
      if (file.size > maxSize) {
        const maxMB = maxSize / (1024 * 1024);
        throw ApiError.badRequest(
          `File too large. Maximum size for ${imageType} is ${maxMB}MB`
        );
      }

      // Ensure bucket exists
      await ensureBucket();

      // Determine file extension from mimetype
      const ext = file.mimetype === "image/png"
        ? "png"
        : file.mimetype === "image/webp"
          ? "webp"
          : "jpg";

      const filePath = `communities/${communityId}/${imageType}.${ext}`;

      // Upload to Supabase Storage (upsert to replace existing)
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        throw ApiError.internal(`Upload failed: ${uploadError.message}`);
      }

      // Get the public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      // Append cache-busting timestamp
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update the community record in the database
      const fieldName = imageType === "avatar" ? "image_url" : "cover_image_url";
      const { error: dbError } = await supabaseAdmin
        .from("communities")
        .update({ [fieldName]: publicUrl })
        .eq("id", communityId);

      if (dbError) {
        throw ApiError.internal(`Database update failed: ${dbError.message}`);
      }

      sendSuccess(res, { url: publicUrl }, 200, "Image uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /posts/:id/upload-media
   * Upload an image or video for a post.
   *
   * Expects multipart/form-data with:
   *   - file: the media file
   *   - altText: optional alt text
   *   - displayOrder: optional display order (default 0)
   */
  async uploadPostMedia(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id: postId } = req.params;
      const file = (req as any).file;
      if (!file) {
        throw ApiError.badRequest("No file provided");
      }

      if (!POST_MEDIA_TYPES.has(file.mimetype)) {
        throw ApiError.badRequest(
          `Invalid file type "${file.mimetype}". Allowed: jpg, png, webp, mp4, mov`
        );
      }

      if (file.size > MAX_POST_MEDIA_SIZE) {
        throw ApiError.badRequest("File too large. Maximum size is 50MB");
      }

      // Ensure bucket exists
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      if (!buckets?.some((b) => b.name === POST_MEDIA_BUCKET)) {
        await supabaseAdmin.storage.createBucket(POST_MEDIA_BUCKET, {
          public: true,
          fileSizeLimit: MAX_POST_MEDIA_SIZE,
        });
      }

      const isVideo = file.mimetype.startsWith("video/");
      const ext = getExtFromMime(file.mimetype);

      const filePath = `posts/${postId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(POST_MEDIA_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        throw ApiError.internal(`Upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(POST_MEDIA_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const displayOrder = Number(req.body?.displayOrder ?? 0);
      const altText = req.body?.altText ?? null;

      const { data: mediaRow, error: dbError } = await supabaseAdmin
        .from("post_media")
        .insert({
          post_id: postId,
          media_url: publicUrl,
          media_type: isVideo ? "video" : "image",
          alt_text: altText,
          display_order: displayOrder,
        })
        .select()
        .single();

      if (dbError) {
        throw ApiError.internal(`Failed to save media record: ${dbError.message}`);
      }

      sendSuccess(res, {
        id: mediaRow.id,
        mediaUrl: mediaRow.media_url,
        mediaType: mediaRow.media_type,
        displayOrder: mediaRow.display_order,
      }, 201, "Media uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /products/:id/upload-image
   * Upload an image for a product.
   *
   * Expects multipart/form-data with:
   *   - file: the image file (jpg, png, webp — max 5MB)
   *   - isPrimary: optional boolean string ("true"/"false")
   *   - altText: optional alt text
   *   - displayOrder: optional integer
   */
  async uploadProductImage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id: productId } = req.params;
      const file = (req as any).file;
      if (!file) throw ApiError.badRequest("No file provided");

      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        throw ApiError.badRequest(
          `Invalid file type "${file.mimetype}". Allowed: jpg, png, webp`
        );
      }

      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) throw ApiError.badRequest("File too large. Maximum size is 5MB");

      // Ensure bucket exists
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      if (!buckets?.some((b) => b.name === PRODUCT_IMAGES_BUCKET)) {
        await supabaseAdmin.storage.createBucket(PRODUCT_IMAGES_BUCKET, {
          public: true,
          fileSizeLimit: MAX_SIZE,
          allowedMimeTypes: ALLOWED_TYPES,
        });
      }

      const ext = getExtFromMime(file.mimetype);
      const filePath = `products/${productId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });

      if (uploadError) throw ApiError.internal(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabaseAdmin.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const isPrimary = req.body?.isPrimary === "true";
      const displayOrder = Number(req.body?.displayOrder ?? 0);
      const altText = req.body?.altText ?? null;

      const { data: imageRow, error: dbError } = await supabaseAdmin
        .from("product_images")
        .insert({
          product_id: productId,
          image_url: publicUrl,
          alt_text: altText,
          is_primary: isPrimary,
          display_order: displayOrder,
        })
        .select()
        .single();

      if (dbError) throw ApiError.internal(`Failed to save image record: ${dbError.message}`);

      sendSuccess(res, {
        id: imageRow.id,
        imageUrl: imageRow.image_url,
        altText: imageRow.alt_text,
        isPrimary: imageRow.is_primary,
        displayOrder: imageRow.display_order,
      }, 201, "Image uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/shipments/:id/upload-label
   * Upload a shipping label (PDF or image) for a shipment.
   * Admin only — updates shipments.label_url so brands can download it.
   */
  async uploadShipmentLabel(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id: shipmentId } = req.params;
      const file = (req as any).file;
      if (!file) throw ApiError.badRequest("No file provided");

      if (!LABEL_TYPES.has(file.mimetype)) {
        throw ApiError.badRequest(
          `Invalid file type "${file.mimetype}". Allowed: pdf, jpg, png`
        );
      }

      const MAX_LABEL_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_LABEL_SIZE) throw ApiError.badRequest("File too large. Maximum size is 10MB");

      // Ensure bucket exists
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      if (!buckets?.some((b) => b.name === SHIPMENT_LABELS_BUCKET)) {
        await supabaseAdmin.storage.createBucket(SHIPMENT_LABELS_BUCKET, {
          public: true,
          fileSizeLimit: MAX_LABEL_SIZE,
        });
      }

      const ext = file.mimetype === "application/pdf" ? "pdf"
        : file.mimetype === "image/png" ? "png" : "jpg";
      const filePath = `labels/${shipmentId}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(SHIPMENT_LABELS_BUCKET)
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });

      if (uploadError) throw ApiError.internal(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabaseAdmin.storage
        .from(SHIPMENT_LABELS_BUCKET)
        .getPublicUrl(filePath);

      const labelUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabaseAdmin
        .from("shipments")
        .update({ label_url: labelUrl })
        .eq("id", shipmentId);

      if (dbError) throw ApiError.internal(`Database update failed: ${dbError.message}`);

      sendSuccess(res, { labelUrl }, 200, "Label uploaded successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /communities/:id/remove-image
   * Remove a community avatar or cover image.
   *
   * Expects JSON body: { type: "avatar" | "cover" }
   */
  async removeCommunityImage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id: communityId } = req.params;
      const { type: imageType } = req.body;

      if (!imageType || !["avatar", "cover"].includes(imageType)) {
        throw ApiError.badRequest('Body param "type" must be "avatar" or "cover"');
      }

      // Try to remove files with all possible extensions
      const extensions = ["jpg", "png", "webp"];
      const filePaths = extensions.map(
        (ext) => `communities/${communityId}/${imageType}.${ext}`
      );

      await supabaseAdmin.storage.from(BUCKET_NAME).remove(filePaths);

      // Clear the URL in the database
      const fieldName = imageType === "avatar" ? "image_url" : "cover_image_url";
      const { error: dbError } = await supabaseAdmin
        .from("communities")
        .update({ [fieldName]: null })
        .eq("id", communityId);

      if (dbError) {
        throw ApiError.internal(`Database update failed: ${dbError.message}`);
      }

      sendSuccess(res, null, 200, "Image removed successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();

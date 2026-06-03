"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, X, ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────
export interface ImageUploadProps {
  /** Current image URL (existing or just uploaded) */
  value?: string | null;
  /** Called when user selects a file — parent handles the actual upload */
  onFileSelect: (file: File) => Promise<void>;
  /** Called when user removes the current image */
  onRemove?: () => void;
  /** "avatar" = square, "cover" = wide banner */
  variant?: "avatar" | "cover";
  /** Label shown above the component */
  label?: string;
  /** Whether an upload is currently in progress */
  isUploading?: boolean;
  /** External error message to display */
  error?: string | null;
  /** Disable all interactions */
  disabled?: boolean;
}

// ─── Validation helpers ─────────────────────────────────────────────
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = ".jpg, .png, .webp";

function getMaxSize(variant: "avatar" | "cover"): number {
  return variant === "avatar" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

function validateFile(
  file: File,
  variant: "avatar" | "cover"
): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Invalid file type. Accepted: ${ALLOWED_EXTENSIONS}`;
  }
  const max = getMaxSize(variant);
  if (file.size > max) {
    return `File too large. Max ${formatBytes(max)}`;
  }
  return null;
}

// ─── Client-side image resize (canvas) ──────────────────────────────
async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down proportionally if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          const resized = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(resized);
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

// ─── Component ──────────────────────────────────────────────────────
export function ImageUpload({
  value,
  onFileSelect,
  onRemove,
  variant = "avatar",
  label,
  isUploading = false,
  error: externalError,
  disabled = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const displayError = externalError || validationError;
  const displayImage = localPreview || value;

  // Dimensions for resizing
  const targetWidth = variant === "avatar" ? 512 : 1200;
  const targetHeight = variant === "avatar" ? 512 : 400;

  // ── Process selected file ──
  const processFile = useCallback(
    async (file: File) => {
      setValidationError(null);

      const error = validateFile(file, variant);
      if (error) {
        setValidationError(error);
        return;
      }

      // Show instant local preview
      const previewUrl = URL.createObjectURL(file);
      setLocalPreview(previewUrl);

      try {
        // Resize before uploading
        const resized = await resizeImage(file, targetWidth, targetHeight);
        await onFileSelect(resized);
      } catch (err) {
        setLocalPreview(null);
        setValidationError(
          err instanceof Error ? err.message : "Upload failed"
        );
      }
    },
    [variant, targetWidth, targetHeight, onFileSelect]
  );

  // ── Drag & Drop handlers ──
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !isUploading) setIsDragOver(true);
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled || isUploading) return;

      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [disabled, isUploading, processFile]
  );

  // ── Click-to-select handler ──
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so re-selecting same file works
      e.target.value = "";
    },
    [processFile]
  );

  // ── Remove handler ──
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setLocalPreview(null);
      setValidationError(null);
      onRemove?.();
    },
    [onRemove]
  );

  // ── Layout classes based on variant ──
  const containerClasses = cn(
    "relative group cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden",
    isDragOver
      ? "border-emerald-500 bg-emerald-500/10"
      : displayError
        ? "border-red-500/40 bg-red-500/5"
        : "border-[#2a2a2a] hover:border-emerald-500/50 bg-[#111111]",
    disabled && "opacity-50 cursor-not-allowed",
    variant === "avatar" ? "aspect-square w-full max-w-[200px]" : "aspect-[3/1] w-full"
  );

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-zinc-300">{label}</label>
      )}

      <div
        className={containerClasses}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleInputChange}
          disabled={disabled || isUploading}
        />

        {/* ── Uploading overlay ── */}
        {isUploading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
            <span className="text-sm text-emerald-400 font-medium">
              Uploading...
            </span>
          </div>
        )}

        {/* ── Image preview ── */}
        {displayImage && !isUploading ? (
          <>
            <img
              src={displayImage}
              alt={variant === "avatar" ? "Community avatar" : "Community cover"}
              className={cn(
                "w-full h-full object-cover",
                variant === "avatar" && "rounded-xl"
              )}
            />

            {/* Hover overlay with actions */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" />
                Replace
              </button>

              {onRemove && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors"
                  onClick={handleRemove}
                >
                  <X className="h-4 w-4" />
                  Remove
                </button>
              )}
            </div>
          </>
        ) : (
          /* ── Empty state / drop zone ── */
          !isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <div className="h-12 w-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center mb-3">
                <ImageIcon className="h-6 w-6 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">
                {isDragOver ? "Drop image here" : "Click or drag to upload"}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {ALLOWED_EXTENSIONS} &middot; Max{" "}
                {formatBytes(getMaxSize(variant))}
              </p>
              {variant === "avatar" && (
                <p className="text-xs text-zinc-600">Resized to 512×512</p>
              )}
              {variant === "cover" && (
                <p className="text-xs text-zinc-600">Resized to 1200×400</p>
              )}
            </div>
          )
        )}
      </div>

      {/* ── Validation / Error message ── */}
      {displayError && (
        <div className="flex items-center gap-1.5 text-red-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}

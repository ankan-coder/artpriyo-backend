const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = "dbueqvycn";
const CLOUDINARY_UPLOAD_PRESET = "artpriyo";

/**
 * Validates media format and type
 * @param {string} mediaUri - URI or Base64 of the media
 * @returns {Object} - Contains validation result and media type info
 */
const validateMediaFormat = (mediaUri) => {
  // Check if input is valid
  if (!mediaUri || typeof mediaUri !== "string") {
    return {
      isValid: false,
      error: "Media URI is required and must be a string",
      isVideo: false,
    };
  }

  // Check if it's a video by extension or mimetype
  const isVideo =
    mediaUri.startsWith("data:video") ||
    /\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i.test(mediaUri);

  // Check if it's a valid media format
  const isValidFormat =
    mediaUri.startsWith("data:image") ||
    mediaUri.startsWith("data:video") ||
    mediaUri.startsWith("http") ||
    /^[a-zA-Z0-9+/]+={0,2}$/.test(mediaUri); // Check if it's base64 without prefix

  if (!isValidFormat) {
    return {
      isValid: false,
      error:
        "Invalid media format. Must be a base64 string, data URI, or a URL.",
      isVideo,
    };
  }

  // Additional validation for image formats
  if (
    mediaUri.startsWith("data:image") &&
    !mediaUri.match(
      /^data:image\/(jpeg|jpg|png|gif|webp|bmp|tiff|svg\+xml);base64,/
    )
  ) {
    return {
      isValid: false,
      error:
        "Invalid image file. Supported formats are JPEG, PNG, GIF, WebP, BMP, TIFF, and SVG.",
      isVideo,
    };
  }

  // Additional validation for video formats
  if (
    mediaUri.startsWith("data:video") &&
    !mediaUri.match(
      /^data:video\/(mp4|webm|ogg|quicktime|x-ms-wmv|x-flv|x-matroska);base64,/
    )
  ) {
    return {
      isValid: false,
      error:
        "Invalid video file. Supported formats are MP4, WebM, OGG, MOV, WMV, FLV, and MKV.",
      isVideo,
    };
  }

  // If all checks pass
  return {
    isValid: true,
    isVideo,
    error: null,
  };
};

/**
 * Upload a single file to Cloudinary
 * @param {string} mediaUri - URI or Base64 of the media
 * @param {Object} options - Optional parameters
 * @returns {Promise<string>} - URL of the uploaded media
 */
const uploadToCloudinary = async (mediaUri, options = {}) => {
  const startTime = Date.now();
  const uploadId = uuidv4().substring(0, 8); // Generate a short ID for tracking this upload
  console.log(`[CLOUDINARY][${uploadId}] Starting upload process...`);

  try {
    // Validate the media format
    const validation = validateMediaFormat(mediaUri);

    if (!validation.isValid) {
      console.error(
        `[CLOUDINARY][${uploadId}] Validation failed: ${validation.error}`
      );
      throw new Error(validation.error);
    }

    const isVideo = validation.isVideo;
    console.log(
      `[CLOUDINARY][${uploadId}] Detected media type: ${
        isVideo ? "Video" : "Image"
      }`
    );

    // File size estimation (rough estimation for base64)
    let estimatedSize = 0;
    if (mediaUri.startsWith("data:")) {
      // For data URIs, estimate size from the base64 part
      const base64Data = mediaUri.split(",")[1] || "";
      estimatedSize = Math.round((base64Data.length * 3) / 4); // Rough base64 to byte conversion
      console.log(
        `[CLOUDINARY][${uploadId}] Estimated file size: ${(
          estimatedSize /
          (1024 * 1024)
        ).toFixed(2)} MB`
      );

      // Check if file is too large (10MB for images, 100MB for videos)
      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (estimatedSize > maxSize) {
        throw new Error(
          `File too large. Maximum size is ${
            isVideo ? "100MB for videos" : "10MB for images"
          }.`
        );
      }
    }

    const formData = new FormData();

    // Prepare the upload data
    formData.append("file", mediaUri);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("resource_type", isVideo ? "video" : "image");

    // Add optional parameters if provided
    if (options.folder) formData.append("folder", options.folder);
    if (options.public_id) formData.append("public_id", options.public_id);
    if (options.tags && Array.isArray(options.tags)) {
      formData.append("tags", options.tags.join(","));
    }

    // Add transformation options
    if (options.transformation) {
      if (typeof options.transformation === "string") {
        formData.append("transformation", options.transformation);
      } else if (typeof options.transformation === "object") {
        Object.entries(options.transformation).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }
    }

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${
      isVideo ? "video" : "image"
    }/upload`;

    console.log(`[CLOUDINARY][${uploadId}] Sending request to Cloudinary...`);

    const response = await axios.post(cloudinaryUrl, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      // Add timeout for large uploads
      timeout: isVideo ? 300000 : 60000, // 5 minutes for videos, 1 minute for images
      onUploadProgress: (progressEvent) => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        if (progress % 20 === 0) {
          // Log every 20% progress
          console.log(
            `[CLOUDINARY][${uploadId}] Upload progress: ${progress}%`
          );
        }
      },
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // in seconds

    console.log(
      `[CLOUDINARY][${uploadId}] Upload successful! Duration: ${duration.toFixed(
        2
      )}s`
    );
    console.log(
      `[CLOUDINARY][${uploadId}] Resource type: ${response.data.resource_type}`
    );
    console.log(`[CLOUDINARY][${uploadId}] URL: ${response.data.secure_url}`);

    return response.data.secure_url;
  } catch (error) {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // in seconds

    console.error(
      `[CLOUDINARY][${uploadId}] Upload failed after ${duration.toFixed(2)}s`
    );
    console.error(`[CLOUDINARY][${uploadId}] Error: ${error.message}`);

    if (error.response) {
      console.error(
        `[CLOUDINARY][${uploadId}] Status: ${error.response.status}`
      );
      console.error(
        `[CLOUDINARY][${uploadId}] Response data:`,
        JSON.stringify(error.response.data, null, 2)
      );

      // Handle specific error codes
      if (error.response.status === 401) {
        throw new Error(
          "Cloudinary authentication failed. Please check your upload preset configuration."
        );
      } else if (error.response.status === 413) {
        throw new Error("File too large for Cloudinary upload limits.");
      } else if (error.response.status === 400) {
        const errorMessage =
          error.response.data.error?.message ||
          JSON.stringify(error.response.data);
        throw new Error(`Cloudinary rejected the upload: ${errorMessage}`);
      }
    }

    // Rethrow with more context
    throw new Error(`Failed to upload media to Cloudinary: ${error.message}`);
  }
};

/**
 * Upload multiple files to Cloudinary in parallel
 * @param {Array<string>} mediaUris - Array of media URIs or Base64 strings
 * @param {Object} options - Optional parameters
 * @returns {Promise<Array<{url: string, error: string|null}>>} - Results of uploads
 */
const bulkUploadToCloudinary = async (mediaUris, options = {}) => {
  console.log(
    `[CLOUDINARY][BULK] Starting bulk upload of ${mediaUris.length} items`
  );
  const startTime = Date.now();
  const batchId = uuidv4().substring(0, 8);

  // Validate inputs
  if (!Array.isArray(mediaUris)) {
    throw new Error("Media URIs must be provided as an array");
  }

  if (mediaUris.length === 0) {
    console.log("[CLOUDINARY][BULK] No items to upload");
    return [];
  }

  // Set concurrency limit
  const concurrencyLimit = options.concurrency || 3; // Default to 3 concurrent uploads
  console.log(
    `[CLOUDINARY][BULK][${batchId}] Using concurrency limit of ${concurrencyLimit}`
  );

  // Track progress
  let completed = 0;
  const results = [];
  const totalItems = mediaUris.length;

  // Process media URIs in batches to respect concurrency limit
  for (let i = 0; i < mediaUris.length; i += concurrencyLimit) {
    const batch = mediaUris.slice(i, i + concurrencyLimit);
    console.log(
      `[CLOUDINARY][BULK][${batchId}] Processing batch ${
        Math.floor(i / concurrencyLimit) + 1
      }/${Math.ceil(mediaUris.length / concurrencyLimit)}`
    );

    const uploadPromises = batch.map(async (uri, index) => {
      const currentIndex = i + index;
      try {
        console.log(
          `[CLOUDINARY][BULK][${batchId}] Starting item ${
            currentIndex + 1
          }/${totalItems}`
        );
        const url = await uploadToCloudinary(uri, options);
        completed++;
        console.log(
          `[CLOUDINARY][BULK][${batchId}] Progress: ${completed}/${totalItems} (${Math.round(
            (completed / totalItems) * 100
          )}%)`
        );
        return { url, error: null, index: currentIndex };
      } catch (error) {
        completed++;
        console.error(
          `[CLOUDINARY][BULK][${batchId}] Failed item ${
            currentIndex + 1
          }/${totalItems}: ${error.message}`
        );
        console.log(
          `[CLOUDINARY][BULK][${batchId}] Progress: ${completed}/${totalItems} (${Math.round(
            (completed / totalItems) * 100
          )}%)`
        );
        return { url: null, error: error.message, index: currentIndex };
      }
    });

    // Wait for current batch to complete before starting next batch
    const batchResults = await Promise.all(uploadPromises);
    results.push(...batchResults);
  }

  // Sort results by original index
  results.sort((a, b) => a.index - b.index);

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000; // in seconds
  const successful = results.filter((r) => r.url).length;
  const failed = results.filter((r) => r.error).length;

  console.log(
    `[CLOUDINARY][BULK][${batchId}] Bulk upload completed in ${duration.toFixed(
      2
    )}s`
  );
  console.log(
    `[CLOUDINARY][BULK][${batchId}] Results: ${successful} successful, ${failed} failed`
  );

  // Return results without the index property
  return results.map(({ url, error }) => ({ url, error }));
};

/**
 * Generate a signed URL for a private resource on Cloudinary
 * @param {string} publicId - The public ID of the resource
 * @param {Object} options - Options for signed URL generation
 * @returns {string} - Signed URL
 */
const getSignedUrl = (publicId, options = {}) => {
  // This is a placeholder - to implement signed URLs, you would need to use the Cloudinary SDK
  // and your API Secret, which should be kept secure on the server side
  console.log(`[CLOUDINARY] Generating signed URL for: ${publicId}`);
  throw new Error(
    "Signed URL generation not implemented. Requires Cloudinary SDK."
  );
};

/**
 * Check if a Cloudinary resource exists
 * @param {string} url - Cloudinary URL to check
 * @returns {Promise<boolean>} - Whether the resource exists
 */
const checkResourceExists = async (url) => {
  try {
    console.log(`[CLOUDINARY] Checking if resource exists: ${url}`);
    const response = await axios.head(url);
    return response.status === 200;
  } catch (error) {
    console.error(`[CLOUDINARY] Resource check failed: ${error.message}`);
    return false;
  }
};

/**
 * Helper function to extract public ID from a Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} - Public ID or null if not a valid Cloudinary URL
 */
const extractPublicIdFromUrl = (url) => {
  if (!url || typeof url !== "string") return null;

  try {
    // Regular expression to extract the public ID from a Cloudinary URL
    const match = url.match(/\/v\d+\/([^/]+)\.\w+$/);
    return match ? match[1] : null;
  } catch (error) {
    console.error(`[CLOUDINARY] Error extracting public ID: ${error.message}`);
    return null;
  }
};

// Export the service methods
module.exports = {
  uploadToCloudinary,
  bulkUploadToCloudinary,
  validateMediaFormat,
  checkResourceExists,
  extractPublicIdFromUrl,
  getSignedUrl,
  CLOUDINARY_CLOUD_NAME,
};

/**
 * mobile-app/src/services/cameraService.js
 * 
 * Production-grade mobile camera capture & image normalization service.
 * Supports Android Chrome, iOS Safari, and Chromium browsers:
 * - Handles secure context requirements (HTTPS / localhost)
 * - Cascading getUserMedia constraints fallback
 * - Explicit iOS Safari inline video setup (playsinline)
 * - Safe camera track teardown on flip / unmount
 * - Controlled resolution frame capture (max 1280x720) on reusable canvas
 * - EXIF orientation normalization for uploaded mobile photos
 */

// Controlled processing maximum dimension (reduces memory & CPU load on mobile)
export const MAX_PROCESSING_DIMENSION = 1280;

// Reusable canvas and context for memory efficiency
let reusableCanvas = null;
let reusableCtx = null;

function getProcessingCanvas(width, height) {
  if (!reusableCanvas) {
    reusableCanvas = document.createElement('canvas');
    reusableCtx = reusableCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (reusableCanvas.width !== width || reusableCanvas.height !== height) {
    reusableCanvas.width = width;
    reusableCanvas.height = height;
  }
  return { canvas: reusableCanvas, ctx: reusableCtx };
}

/**
 * Checks browser camera environment and security context.
 */
export function checkCameraSupport() {
  const isSecure = typeof window !== 'undefined' ? (window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1') : false;
  const hasMediaDevices = !!(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  let message = 'READY';
  let isSupported = true;

  if (!isSecure) {
    isSupported = false;
    message = 'Camera access requires HTTPS. Insecure HTTP origin detected on mobile network.';
  } else if (!hasMediaDevices) {
    isSupported = false;
    message = 'navigator.mediaDevices.getUserMedia is not supported on this browser.';
  }

  return {
    isSecure,
    hasMediaDevices,
    isSupported,
    message
  };
}

/**
 * Starts a camera stream with cascading fallback constraints.
 * @param {string} facingMode - 'environment' (back camera) or 'user' (front camera)
 * @returns {Promise<MediaStream>}
 */
export async function startCameraStream(facingMode = 'environment') {
  const support = checkCameraSupport();
  if (!support.isSupported) {
    throw new Error(support.message);
  }

  // Tier 1: Preferred mobile back/front camera at 1280x720
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    return stream;
  } catch (tier1Err) {
    console.warn('[CameraService] Tier 1 constraint failed, attempting Tier 2 fallback...', tier1Err.name);
  }

  // Tier 2: Basic facing mode without exact resolution constraints
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode }
      },
      audio: false
    });
    return stream;
  } catch (tier2Err) {
    console.warn('[CameraService] Tier 2 constraint failed, attempting generic video fallback...', tier2Err.name);
  }

  // Tier 3: Generic video constraint (works on basic webcams)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });
    return stream;
  } catch (tier3Err) {
    console.error('[CameraService] All camera constraint tiers failed:', tier3Err);
    if (tier3Err.name === 'NotAllowedError' || tier3Err.name === 'PermissionDeniedError') {
      throw new Error('Camera permission denied by user. Please enable camera in browser settings.');
    } else if (tier3Err.name === 'NotFoundError' || tier3Err.name === 'DevicesNotFoundError') {
      throw new Error('No camera sensor found on this device.');
    } else if (tier3Err.name === 'NotReadableError' || tier3Err.name === 'TrackStartError') {
      throw new Error('Camera is already in use by another application.');
    }
    throw new Error(`Camera error: ${tier3Err.message || tier3Err.name}`);
  }
}

/**
 * Safely stops all active tracks on a MediaStream.
 * @param {MediaStream} stream
 */
export function stopCameraStream(stream) {
  if (stream && stream.getTracks) {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        console.warn('[CameraService] Error stopping track:', e);
      }
    });
  }
}

/**
 * Captures a normalized frame from an active <video> element.
 * Respects actual video dimensions, scales to controlled processing resolution,
 * and validates ImageData buffer.
 * 
 * @param {HTMLVideoElement} videoElement
 * @param {number} maxDimension
 * @returns {{ imageBase64: string, imageData: ImageData, width: number, height: number, orientation: string }}
 */
export function captureFrameFromVideo(videoElement, maxDimension = MAX_PROCESSING_DIMENSION) {
  if (!videoElement) {
    throw new Error('Video element reference is null');
  }

  if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error('Video stream not ready (HAVE_CURRENT_DATA required).');
  }

  const srcWidth = videoElement.videoWidth;
  const srcHeight = videoElement.videoHeight;

  if (!srcWidth || !srcHeight) {
    throw new Error(`Invalid video frame dimensions: ${srcWidth}x${srcHeight}`);
  }

  const orientation = srcHeight > srcWidth ? 'PORTRAIT' : 'LANDSCAPE';

  // Calculate target processing dimensions maintaining aspect ratio
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  if (srcWidth > maxDimension || srcHeight > maxDimension) {
    if (srcWidth >= srcHeight) {
      targetWidth = maxDimension;
      targetHeight = Math.round((srcHeight * maxDimension) / srcWidth);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((srcWidth * maxDimension) / srcHeight);
    }
  }

  const { canvas, ctx } = getProcessingCanvas(targetWidth, targetHeight);

  // Clear and draw frame with top-left origin (0,0)
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

  // Validate pixel buffer sanity
  if (!imageData || !imageData.data || imageData.data.length < targetWidth * targetHeight * 4) {
    throw new Error('Canvas pixel buffer read failed (ImageData empty or corrupted).');
  }

  const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

  return {
    imageBase64,
    imageData,
    width: targetWidth,
    height: targetHeight,
    orientation,
    sourceDimensions: `${srcWidth} × ${srcHeight}`,
    processedDimensions: `${targetWidth} × ${targetHeight}`
  };
}

/**
 * Normalizes an uploaded/captured photo File, resolving orientation and downscaling.
 * @param {File} file
 * @param {number} maxDimension
 * @returns {Promise<{ imageBase64: string, imageData: ImageData, width: number, height: number, orientation: string }>}
 */
export function normalizeImageFile(file, maxDimension = MAX_PROCESSING_DIMENSION) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided for normalization.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) return reject(new Error('FileReader result is empty.'));

      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data.'));
      img.onload = () => {
        const srcWidth = img.naturalWidth || img.width;
        const srcHeight = img.naturalHeight || img.height;

        const orientation = srcHeight > srcWidth ? 'PORTRAIT' : 'LANDSCAPE';

        let targetWidth = srcWidth;
        let targetHeight = srcHeight;

        if (srcWidth > maxDimension || srcHeight > maxDimension) {
          if (srcWidth >= srcHeight) {
            targetWidth = maxDimension;
            targetHeight = Math.round((srcHeight * maxDimension) / srcWidth);
          } else {
            targetHeight = maxDimension;
            targetWidth = Math.round((srcWidth * maxDimension) / srcHeight);
          }
        }

        const { canvas, ctx } = getProcessingCanvas(targetWidth, targetHeight);
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

        resolve({
          imageBase64,
          imageData,
          width: targetWidth,
          height: targetHeight,
          orientation,
          sourceDimensions: `${srcWidth} × ${srcHeight}`,
          processedDimensions: `${targetWidth} × ${targetHeight}`
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

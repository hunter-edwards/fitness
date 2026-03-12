"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Camera, Upload, RotateCcw, Check, X, SwitchCamera } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CameraCaptureProps {
  onCapture: (base64: string, mediaType: "image/jpeg" | "image/png" | "image/webp") => void
  onCancel: () => void
}

const MAX_DIMENSION = 2048

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    stopStream()
    setCameraError(null)

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      streamRef.current = mediaStream

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      setCameraActive(true)
    } catch {
      setCameraError(
        "Camera access denied. Please enable camera permissions in your browser settings, or upload a photo instead."
      )
    }
  }, [facingMode, stopStream])

  useEffect(() => {
    startCamera()
    return () => stopStream()
  }, [startCamera, stopStream])

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas to video dimensions
    let width = video.videoWidth
    let height = video.videoHeight

    // Resize if too large
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    canvas.width = width
    canvas.height = height
    ctx.drawImage(video, 0, 0, width, height)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    const base64 = dataUrl.split(",")[1]

    setCapturedImage(dataUrl)
    setCapturedBase64(base64)
    stopStream()
    setCameraActive(false)
  }, [stopStream])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string

        // Resize via canvas if needed
        const img = new Image()
        img.onload = () => {
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext("2d")
          if (!ctx) return

          let width = img.width
          let height = img.height

          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const scale = MAX_DIMENSION / Math.max(width, height)
            width = Math.round(width * scale)
            height = Math.round(height * scale)
          }

          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)

          const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.85)
          const base64 = resizedDataUrl.split(",")[1]

          setCapturedImage(resizedDataUrl)
          setCapturedBase64(base64)
          stopStream()
          setCameraActive(false)
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    },
    [stopStream]
  )

  const retake = useCallback(() => {
    setCapturedImage(null)
    setCapturedBase64(null)
    startCamera()
  }, [startCamera])

  const confirm = useCallback(() => {
    if (!capturedBase64) return
    onCapture(capturedBase64, "image/jpeg")
  }, [capturedBase64, onCapture])

  const toggleCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* Viewfinder / Preview */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured food"
            className="h-full w-full object-contain"
          />
        ) : cameraError ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">{cameraError}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}

        {/* Camera switch button */}
        {cameraActive && !capturedImage && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 bg-black/40 text-white hover:bg-black/60"
            onClick={toggleCamera}
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Action buttons */}
      {capturedImage ? (
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={retake}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake
          </Button>
          <Button className="flex-1" onClick={confirm}>
            <Check className="h-4 w-4 mr-2" />
            Use This Photo
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          {cameraActive ? (
            <Button className="flex-1" onClick={takePhoto}>
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
          )}
          {!cameraActive && !cameraError && (
            <Button variant="outline" className="flex-1" onClick={startCamera}>
              <Camera className="h-4 w-4 mr-2" />
              Open Camera
            </Button>
          )}
        </div>
      )}

      {/* Always show upload option when camera is active */}
      {cameraActive && !capturedImage && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload from gallery instead
        </Button>
      )}
    </div>
  )
}

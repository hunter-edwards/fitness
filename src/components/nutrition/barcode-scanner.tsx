"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onCancel: () => void
}

// Declare BarcodeDetector for TypeScript
declare global {
  interface BarcodeDetectorOptions {
    formats: string[]
  }
  interface DetectedBarcode {
    rawValue: string
    format: string
  }
  // eslint-disable-next-line no-var
  var BarcodeDetector: {
    new (options?: BarcodeDetectorOptions): {
      detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
    }
  } | undefined
}

const BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
]

export function BarcodeScanner({ onScan, onCancel }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const scannerRef = useRef<string | null>(null) // html5-qrcode scanner id
  const scannedRef = useRef(false)

  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const handleDetection = useCallback(
    (barcode: string) => {
      if (scannedRef.current) return
      scannedRef.current = true
      stopStream()
      onScan(barcode)
    },
    [onScan, stopStream]
  )

  useEffect(() => {
    let mounted = true

    const startScanning = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setScanning(true)

        // Try native BarcodeDetector first
        if (typeof window !== "undefined" && window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({
            formats: BARCODE_FORMATS,
          })

          const scan = async () => {
            if (!videoRef.current || !mounted || scannedRef.current) return
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                handleDetection(barcodes[0].rawValue)
                return
              }
            } catch {
              // Ignore frame detection errors
            }
            animationRef.current = requestAnimationFrame(scan)
          }

          animationRef.current = requestAnimationFrame(scan)
        } else {
          // Fallback: use html5-qrcode
          try {
            const { Html5Qrcode } = await import("html5-qrcode")
            const scannerId = "barcode-scanner-region"
            scannerRef.current = scannerId

            // Stop the getUserMedia stream since html5-qrcode manages its own
            stream.getTracks().forEach((t) => t.stop())
            streamRef.current = null

            // Ensure the element exists
            if (!mounted) return

            const html5QrCode = new Html5Qrcode(scannerId)
            await html5QrCode.start(
              { facingMode: "environment" },
              {
                fps: 10,
                qrbox: { width: 300, height: 150 },
              },
              (decodedText) => {
                if (!scannedRef.current) {
                  scannedRef.current = true
                  html5QrCode.stop().catch(() => {})
                  onScan(decodedText)
                }
              },
              () => {
                // Ignore scan failures (no barcode in frame)
              }
            )
          } catch {
            if (mounted) {
              setError(
                "Barcode scanning is not supported in this browser. Please type the barcode number manually."
              )
            }
          }
        }
      } catch {
        if (mounted) {
          setError(
            "Camera access denied. Please enable camera permissions in your browser settings."
          )
        }
      }
    }

    startScanning()

    return () => {
      mounted = false
      stopStream()
    }
  }, [handleDetection, onScan, stopStream])

  return (
    <div className="flex flex-col gap-4">
      {/* Scanner viewfinder */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-black">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            {/* Native BarcodeDetector uses video element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{
                display:
                  typeof window !== "undefined" && !window.BarcodeDetector
                    ? "none"
                    : "block",
              }}
            />

            {/* html5-qrcode fallback container */}
            <div
              id="barcode-scanner-region"
              className="h-full w-full"
              style={{
                display:
                  typeof window !== "undefined" && window.BarcodeDetector
                    ? "none"
                    : "block",
              }}
            />

            {/* Scan overlay */}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Scan region indicator */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-primary/60 rounded-lg">
                  {/* Animated scan line */}
                  <div className="absolute inset-x-0 h-0.5 bg-primary animate-[scan_2s_ease-in-out_infinite]" />
                </div>
              </div>
            )}
          </>
        )}

        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Instructions */}
      <p className="text-center text-sm text-muted-foreground">
        {scanning
          ? "Point your camera at a barcode on the product"
          : error
            ? ""
            : "Starting camera..."}
      </p>

      {/* Cancel */}
      <Button variant="outline" onClick={onCancel}>
        <X className="h-4 w-4 mr-2" />
        Cancel
      </Button>

      <style jsx>{`
        @keyframes scan {
          0%,
          100% {
            top: 0;
          }
          50% {
            top: calc(100% - 2px);
          }
        }
      `}</style>
    </div>
  )
}

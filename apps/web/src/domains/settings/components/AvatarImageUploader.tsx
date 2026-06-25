import { Upload, ZoomIn, ZoomOut } from "lucide-react"
import { type ChangeEvent, type ReactNode, useCallback, useRef, useState } from "react"
import Cropper from "react-easy-crop"

import { Button } from "../../../shared/ui/button"
import { cn } from "../../../shared/ui/cn"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../shared/ui/dialog"
import { Slider } from "../../../shared/ui/slider"

type Point = {
  x: number
  y: number
}

type Area = {
  height: number
  width: number
  x: number
  y: number
}

type AvatarImageUploaderProps = {
  "aria-label"?: string
  children?: ReactNode
  className?: string
  disabled?: boolean
  onUpload: (blob: Blob) => Promise<void> | void
}

const acceptedFileTypes = ["image/jpeg", "image/png", "image/webp"]
const maxSize = 5 * 1024 * 1024

// Adapted from 0xRasla/shadcn-image-uploader for the compact settings-row avatar flow.
export function AvatarImageUploader({
  "aria-label": ariaLabel = "Upload avatar",
  children,
  className,
  disabled,
  onUpload,
}: AvatarImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [error, setError] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [zoom, setZoom] = useState(1)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!file) return

    setError("")
    if (!acceptedFileTypes.includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.")
      return
    }
    if (file.size > maxSize) {
      setError("Choose an image under 5 MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImage(String(reader.result))
      setIsCropDialogOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function cropImage() {
    if (!image || !croppedAreaPixels || isSaving) return

    setIsSaving(true)
    try {
      const blob = await cropToWebpBlob(image, croppedAreaPixels)
      await onUpload(blob)
      setIsCropDialogOpen(false)
      setImage(null)
      setZoom(1)
      setCrop({ x: 0, y: 0 })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Avatar upload failed.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className={cn("flex flex-col items-end gap-2", children ? undefined : className)}>
        <input
          ref={inputRef}
          accept={acceptedFileTypes.join(",")}
          className="hidden"
          onChange={handleFileChange}
          type="file"
        />
        {children ? (
          <button
            aria-label={ariaLabel}
            className={cn(
              "inline-flex rounded-full outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            disabled={disabled || isSaving}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {children}
          </button>
        ) : (
          <Button
            disabled={disabled || isSaving}
            onClick={() => inputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Upload className="size-4" />
            Upload
          </Button>
        )}
        {error ? <p className="max-w-48 text-right text-sm text-destructive">{error}</p> : null}
      </div>

      <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop avatar</DialogTitle>
          </DialogHeader>
          {image ? (
            <div className="flex flex-col gap-5">
              <div className="relative h-80 w-full overflow-hidden rounded-md bg-muted">
                <Cropper
                  aspect={1}
                  crop={crop}
                  image={image}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  zoom={zoom}
                />
              </div>
              <div className="flex items-center gap-4">
                <ZoomOut className="size-4 text-muted-foreground" />
                <Slider
                  max={3}
                  min={1}
                  onValueChange={(value) => setZoom(Array.isArray(value) ? (value[0] ?? 1) : value)}
                  step={0.1}
                  value={[zoom]}
                />
                <ZoomIn className="size-4 text-muted-foreground" />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  disabled={isSaving}
                  onClick={() => setIsCropDialogOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={isSaving} onClick={cropImage} type="button">
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

async function cropToWebpBlob(imageSrc: string, crop: Area) {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Unable to prepare image crop.")
  }

  canvas.width = 256
  canvas.height = 256
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.9)
  })

  if (!blob) {
    throw new Error("Unable to encode avatar image.")
  }

  return blob
}

async function loadImage(src: string) {
  const image = new Image()
  image.src = src
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("Unable to load selected image."))
  })
  return image
}

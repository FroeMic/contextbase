/**
 * RenameViewDialog Component
 *
 * Modal dialog to rename an existing saved view.
 */

import { type FormEvent, useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import type { DatatableView } from "../../state/saved-views/datatable-view-adapter.types"
import { useDialogInputFocus } from "./use-dialog-input-focus"

interface RenameViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewId: string | null
  views: DatatableView[]
  onRename: (newName: string) => Promise<void>
  isRenaming: boolean
}

export function RenameViewDialog({
  open,
  onOpenChange,
  viewId,
  views,
  onRename,
  isRenaming,
}: RenameViewDialogProps) {
  const view = views.find((v) => v.id === viewId)
  const currentName = view?.name ?? ""
  const [name, setName] = useState(currentName)
  const inputRef = useDialogInputFocus<HTMLInputElement>(open)

  // Reset form when dialog opens with new current name
  useEffect(() => {
    if (open) {
      setName(currentName)
    }
  }, [open, currentName])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName || trimmedName === currentName) {
      return
    }

    try {
      await onRename(trimmedName)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to rename view:", error)
      // Error handling is done in the hook's onError callback
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen)
        if (!newOpen) {
          setName(currentName)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename view</DialogTitle>
          <DialogDescription>Enter a new name for &quot;{currentName}&quot;</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="view-name">View name</Label>
              <Input
                ref={inputRef}
                id="view-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter view name"
                autoFocus
                maxLength={100}
                disabled={isRenaming}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isRenaming || !name.trim() || name.trim() === currentName}
            >
              {isRenaming ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

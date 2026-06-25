/**
 * CreateViewDialog Component
 *
 * Modal dialog to create a new saved view from current table state.
 */

import { type FormEvent, useState } from "react"
import { Button } from "../../components/ui/button"
import { Checkbox } from "../../components/ui/checkbox"
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
import { useDialogInputFocus } from "./use-dialog-input-focus"

interface CreateViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateView: (name: string, options?: { isUserDefault?: boolean }) => Promise<unknown>
  canSetDefaults: boolean
  isCreating: boolean
}

export function CreateViewDialog({
  open,
  onOpenChange,
  onCreateView,
  canSetDefaults,
  isCreating,
}: CreateViewDialogProps) {
  const [name, setName] = useState("")
  const [isUserDefault, setIsUserDefault] = useState(false)
  const inputRef = useDialogInputFocus<HTMLInputElement>(open)

  const reset = () => {
    setName("")
    setIsUserDefault(false)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    try {
      await onCreateView(trimmedName, {
        isUserDefault,
      })

      reset()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to create view:", error)
      // Error handling is done in the hook's onError callback
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen)
        if (!newOpen) {
          reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create saved view</DialogTitle>
          <DialogDescription>
            Save the current table configuration as a named view. This will capture filters,
            sorting, column layout, and display options.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View name</Label>
              <Input
                ref={inputRef}
                id="view-name"
                placeholder="My custom view"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                maxLength={100}
                disabled={isCreating}
              />
            </div>

            {canSetDefaults && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="set-default"
                  checked={isUserDefault}
                  onCheckedChange={(checked) => setIsUserDefault(checked === true)}
                  disabled={isCreating}
                />
                <Label htmlFor="set-default" className="text-sm font-normal cursor-pointer">
                  Set as my default view
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isCreating}>
              {isCreating ? "Creating..." : "Create view"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

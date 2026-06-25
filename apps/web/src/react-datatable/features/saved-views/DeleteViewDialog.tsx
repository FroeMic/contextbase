/**
 * DeleteViewDialog Component
 *
 * Confirmation dialog to delete a saved view.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog"
import type { DatatableView } from "../../state/saved-views/datatable-view-adapter.types"

interface DeleteViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewId: string | null
  views: DatatableView[]
  onConfirm: () => void
}

export function DeleteViewDialog({
  open,
  onOpenChange,
  viewId,
  views,
  onConfirm,
}: DeleteViewDialogProps) {
  const view = views.find((v) => v.id === viewId)
  const viewName = view?.name ?? ""
  const isShared = view?.isShared ?? false
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete saved view?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{viewName}&quot;? This action cannot be undone.
            {isShared && (
              <span className="block mt-2 font-medium text-amber-600">
                Warning: This view is shared with your workspace. Deleting it will remove it for
                everyone.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

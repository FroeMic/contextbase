interface ShouldShowSelectionCheckboxParams {
  canSelect: boolean
  isHovered: boolean
  isSelected: boolean
  showCheckboxOnHover: boolean
}

export function shouldShowSelectionCheckbox({
  canSelect,
  isHovered,
  isSelected,
  showCheckboxOnHover,
}: ShouldShowSelectionCheckboxParams): boolean {
  if (!canSelect) {
    return false
  }

  if (!showCheckboxOnHover) {
    return true
  }

  return isHovered || isSelected
}

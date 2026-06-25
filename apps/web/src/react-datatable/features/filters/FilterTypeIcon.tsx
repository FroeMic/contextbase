import {
  CalendarBlank,
  Gear,
  Hash,
  type Icon,
  ListBullets,
  TextT,
  ToggleLeft,
  Users,
} from "../../components/ui/icons"
import type { FilterType } from "../../types/filter.types"

interface FilterTypeIconProps {
  type: FilterType
  className?: string
}

/**
 * Icon component that maps filter types to appropriate Phosphor icons
 *
 * Filter Type Icons:
 * - text → TextT (text)
 * - number → Hash (#)
 * - date → CalendarBlank
 * - boolean → ToggleLeft (toggle switch)
 * - text-list → ListBullets (bullet list)
 * - id-list → Users (people icon)
 * - custom → Gear (gear icon)
 */
const ICON_MAP: Record<FilterType, Icon> = {
  text: TextT,
  number: Hash,
  date: CalendarBlank,
  boolean: ToggleLeft,
  "text-list": ListBullets,
  "id-list": Users,
  custom: Gear,
}

export const FilterTypeIcon = ({ type, className }: FilterTypeIconProps) => {
  const Icon = ICON_MAP[type]
  return <Icon className={className} />
}

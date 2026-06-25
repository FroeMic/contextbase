"use client"

import type { ClientFeatureFlagKey } from "@contextbase/core/domains/feature-flags/service"
import { Flag, RotateCcw } from "lucide-react"

import { Button } from "../../../shared/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../../../shared/ui/popover"
import { useOptionalFeatureFlagControls } from "./FeatureFlagProvider"
import { editableClientFeatureFlagKeys } from "./feature-flag-overrides"

const featureFlagLabels: Record<ClientFeatureFlagKey, string> = {
  "developer.browserFlagOverrides": "Browser override controls",
}

export function FeatureFlagOverrideDockButton() {
  const featureFlags = useOptionalFeatureFlagControls()
  if (!featureFlags?.overridesEnabled) return null

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="Feature flag overrides"
            className="text-muted-foreground hover:text-foreground"
            size="icon-xs"
            title="Feature flag overrides"
            type="button"
            variant="ghost"
          />
        }
      >
        <Flag className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-3" side="top">
        <PopoverHeader>
          <PopoverTitle>Feature flags</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          {editableClientFeatureFlagKeys.map((key) => (
            <FeatureFlagOverrideRow featureFlagKey={key} key={key} />
          ))}
        </div>
        <Button
          className="self-start"
          onClick={featureFlags.clearOverrides}
          size="xs"
          type="button"
          variant="ghost"
        >
          <RotateCcw className="size-3" />
          Clear overrides
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function FeatureFlagOverrideRow({ featureFlagKey }: { featureFlagKey: ClientFeatureFlagKey }) {
  const featureFlags = useOptionalFeatureFlagControls()
  if (!featureFlags) return null

  const hasOverride = Object.hasOwn(featureFlags.overrides, featureFlagKey)
  const override = featureFlags.overrides[featureFlagKey]
  const serverValue = featureFlags.serverValues[featureFlagKey]

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate font-medium text-sm">{featureFlagLabels[featureFlagKey]}</div>
        <div className="text-muted-foreground text-xs">Server {serverValue ? "on" : "off"}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-pressed={!hasOverride}
          onClick={() => featureFlags.setOverride(featureFlagKey, null)}
          size="xs"
          type="button"
          variant={!hasOverride ? "secondary" : "ghost"}
        >
          Auto
        </Button>
        <Button
          aria-pressed={hasOverride && override === true}
          onClick={() => featureFlags.setOverride(featureFlagKey, true)}
          size="xs"
          type="button"
          variant={hasOverride && override === true ? "secondary" : "ghost"}
        >
          On
        </Button>
        <Button
          aria-pressed={hasOverride && override === false}
          onClick={() => featureFlags.setOverride(featureFlagKey, false)}
          size="xs"
          type="button"
          variant={hasOverride && override === false ? "secondary" : "ghost"}
        >
          Off
        </Button>
      </div>
    </div>
  )
}

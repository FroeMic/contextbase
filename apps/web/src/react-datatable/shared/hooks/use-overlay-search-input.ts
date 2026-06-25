"use client"

import type * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { DATATABLE_INLINE_INPUT_CLASS } from "../styles/input-classes"

const MOBILE_OVERLAY_MEDIA_QUERY = "(max-width: 767px), (hover: none) and (pointer: coarse)"

export function useOverlaySearchInput(
  inputRef: React.RefObject<HTMLInputElement | null>,
  open = true,
) {
  const [suppressAutoFocus, setSuppressAutoFocus] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia(MOBILE_OVERLAY_MEDIA_QUERY)
    const update = () => setSuppressAutoFocus(mediaQuery.matches)

    update()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update)
      return () => mediaQuery.removeEventListener("change", update)
    }

    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  useEffect(() => {
    if (suppressAutoFocus || !open) {
      return
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select?.()
    })

    return () => cancelAnimationFrame(frame)
  }, [inputRef, open, suppressAutoFocus])

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault()

      if (suppressAutoFocus) {
        return
      }

      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select?.()
      })
    },
    [inputRef, suppressAutoFocus],
  )

  return {
    suppressAutoFocus,
    handleOpenAutoFocus,
    inputClassName: DATATABLE_INLINE_INPUT_CLASS,
  }
}

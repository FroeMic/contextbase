import { type RefObject, useEffect, useState } from "react"

interface ContainerSize {
  width: number
  height: number
}

/**
 * Hook to measure container dimensions using ResizeObserver
 *
 * Automatically updates when container is resized (e.g., window resize, sidebar toggle).
 * Returns { width: 0, height: 0 } until first measurement.
 *
 * @param containerRef - Ref to the container element to measure
 * @returns Current container dimensions
 */
export function useContainerSize(containerRef: RefObject<HTMLElement | null>): ContainerSize {
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const newSize = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        }
        setSize(newSize)
      }
    })

    observer.observe(element)

    // Initial measurement (ResizeObserver doesn't fire immediately)
    const initialSize = {
      width: element.clientWidth,
      height: element.clientHeight,
    }
    setSize(initialSize)

    return () => observer.disconnect()
  }, [containerRef])

  return size
}

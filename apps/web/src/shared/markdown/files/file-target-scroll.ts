export function scrollDeepLinkTargetIntoView(target: HTMLElement) {
  const scroll = () => target.scrollIntoView({ block: "center", behavior: "smooth" })
  scroll()
  if (typeof window === "undefined") return
  window.requestAnimationFrame(scroll)
  window.setTimeout(scroll, 180)
}

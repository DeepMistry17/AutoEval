import React, { useEffect, useRef, useState } from 'react'

/**
 * Locks normal scrolling and snaps the viewport to the nearest
 * <section> / <footer> whenever the user scrolls (wheel or touch).
 */
export function useFullPageScroll() {
  const isScrolling = useRef(false)

  useEffect(() => {
    const handleScrollEvent = (e: Event | undefined, deltaY: number) => {
      if (isScrolling.current) {
        if (e && (e as any).preventDefault) (e as any).preventDefault()
        return
      }

      const elements = Array.from(document.querySelectorAll('section, footer'))
      if (elements.length === 0) return

      const currentScroll = window.scrollY

      let closestIndex = 0
      let minDiff = Infinity
      elements.forEach((el, index) => {
        const diff = Math.abs((el as HTMLElement).offsetTop - currentScroll)
        if (diff < minDiff) {
          minDiff = diff
          closestIndex = index
        }
      })

      const direction = Math.sign(deltaY)
      if (direction === 0) return

      let nextIndex = closestIndex + direction
      nextIndex = Math.max(0, Math.min(nextIndex, elements.length - 1))

      if (nextIndex !== closestIndex) {
        if (e && (e as any).preventDefault) (e as any).preventDefault()
        isScrolling.current = true

        window.scrollTo({
          top: (elements[nextIndex] as HTMLElement).offsetTop,
          behavior: 'smooth',
        })

        setTimeout(() => {
          isScrolling.current = false
        }, 1000)
      } else {
        if (e && (e as any).preventDefault) (e as any).preventDefault()
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (isScrolling.current) {
        e.preventDefault()
        return
      }
      if (Math.abs(e.deltaY) < 15) return
      handleScrollEvent(e, e.deltaY)
    }

    let touchStartY = 0
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isScrolling.current) {
        e.preventDefault()
        return
      }
      const touchEndY = e.touches[0].clientY
      const deltaY = touchStartY - touchEndY

      if (Math.abs(deltaY) > 40) {
        handleScrollEvent(e, deltaY)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: false })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])
}

export function useParallax(speed = 0.12) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let ticking = false

    const update = () => {
      const rect = el.getBoundingClientRect()
      const windowH = window.innerHeight
      const elementCenter = rect.top + rect.height / 2
      const delta = (elementCenter - windowH / 2) / windowH
      setOffset(delta * speed * 100)
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => window.removeEventListener('scroll', onScroll)
  }, [speed])

  return {
    ref,
    style: {
      transform: `translateY(${offset}px)`,
      willChange: 'transform',
    } as React.CSSProperties,
  }
}

export function useHeroScroll() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let ticking = false

    const update = () => {
      const scrollY = window.scrollY
      const vh = window.innerHeight
      const p = Math.min(scrollY / vh, 1)
      setProgress(p)
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return progress
}
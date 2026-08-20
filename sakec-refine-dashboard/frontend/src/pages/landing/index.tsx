import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { CSSProperties, ReactNode, MouseEventHandler } from 'react'
import { useNavigate } from 'react-router-dom'
import './landing.css'
import { motion } from 'motion/react'
import { animate, AnimatePresence } from 'framer-motion'
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  Menu,
  X,
  Users,
  FileText,
  Sparkles,
  Search,
  Activity,
  Upload,
  KeyRound,
  Download,
  Brain,
  Send,
  Monitor,
  Server,
  Database,
  Layers,
  Cpu,
  Shield,
  Lock,
  EyeOff,
  Trash2,
  Mail,
  Building2,
  GraduationCap,
  BookOpen,
  Calendar
} from 'lucide-react'
import { Canvas, extend, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useFullPageScroll, useParallax, useHeroScroll } from './hooks'
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei'
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
  type RigidBodyProps
} from '@react-three/rapier'

// @ts-ignore
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
import * as THREE from 'three'

// @ts-ignore
import cardGLB from './assets/lanyard/card.glb'
// @ts-ignore
import lanyardPng from './assets/lanyard/lanyard.png'
// @ts-ignore
import lanyardMarkifySvg from './assets/lanyard/lanyard-markify.svg'

// Team ID Images
// @ts-ignore
import deepIdPng from './assets/lanyard/deep-id.png'
// @ts-ignore
import kushIdPng from './assets/lanyard/kush-id.png'
// @ts-ignore
import hetviIdPng from './assets/lanyard/hetvi-id.png'
// @ts-ignore
import pramiIdPng from './assets/lanyard/prami-id.png'

// @ts-ignore
import markifyLogo from './assets/markify-logo-transparent.png'
// @ts-ignore
import markifyLogoWhite from './assets/markify-logo-white.png'

extend({ MeshLineGeometry, MeshLineMaterial })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      meshLineGeometry: any;
      meshLineMaterial: any;
    }
  }
}



/* ----------------------------------------------------------------
   utils (merged from utils.js)
   ---------------------------------------------------------------- */

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

/* ----------------------------------------------------------------
   BorderGlow (merged from components/BorderGlow.jsx)
   ---------------------------------------------------------------- */

function parseHSL(hslStr: string) {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/)
  if (!match) return { h: 40, s: 80, l: 80 }
  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
  }
}

function buildGlowVars(glowColor: string, intensity: number) {
  const { h, s, l } = parseHSL(glowColor)
  const base = `${h}deg ${s}% ${l}%`
  const opacities = [100, 60, 50, 40, 30, 20, 10]
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10']
  const vars: Record<string, string> = {}
  for (let i = 0; i < opacities.length; i++) {
    vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`
  }
  return vars
}

const GRADIENT_POSITIONS = [
  '80% 55%',
  '69% 34%',
  '8% 6%',
  '41% 38%',
  '86% 85%',
  '82% 18%',
  '51% 4%',
]
const GRADIENT_KEYS = [
  '--gradient-one',
  '--gradient-two',
  '--gradient-three',
  '--gradient-four',
  '--gradient-five',
  '--gradient-six',
  '--gradient-seven',
]
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1]

function buildGradientVars(colors: string[]) {
  const vars: Record<string, string> = {}
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)]
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`
  }
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`
  return vars
}

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3)
}
function easeInCubic(x: number) {
  return x * x * x
}

function animateValue({
  start = 0,
  end = 100,
  duration = 1000,
  delay = 0,
  ease = easeOutCubic,
  onUpdate,
  onEnd,
}: {
  start?: number
  end?: number
  duration?: number
  delay?: number
  ease?: (x: number) => number
  onUpdate: (v: number) => void
  onEnd?: () => void
}) {
  const t0 = performance.now() + delay
  function tick() {
    const elapsed = performance.now() - t0
    const t = Math.min(elapsed / duration, 1)
    onUpdate(start + (end - start) * ease(t))
    if (t < 1) requestAnimationFrame(tick)
    else if (onEnd) onEnd()
  }
  setTimeout(() => requestAnimationFrame(tick), delay)
}

interface BorderGlowProps {
  children?: React.ReactNode
  className?: string
  edgeSensitivity?: number
  glowColor?: string
  backgroundColor?: string
  borderRadius?: number
  glowRadius?: number
  glowIntensity?: number
  coneSpread?: number
  animated?: boolean
  colors?: string[]
  fillOpacity?: number
}

const BorderGlow = ({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#120F17',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  fillOpacity = 0.5,
}: BorderGlowProps) => {
  const cardRef = useRef<HTMLDivElement | null>(null)

  const getCenterOfElement = useCallback((el: HTMLElement) => {
    const { width, height } = el.getBoundingClientRect()
    return [width / 2, height / 2]
  }, [])

  const getEdgeProximity = useCallback(
    (el: HTMLElement, x: number, y: number) => {
      const [cx, cy] = getCenterOfElement(el)
      const dx = x - cx
      const dy = y - cy
      let kx = Infinity
      let ky = Infinity
      if (dx !== 0) kx = cx / Math.abs(dx)
      if (dy !== 0) ky = cy / Math.abs(dy)
      return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1)
    },
    [getCenterOfElement]
  )

  const getCursorAngle = useCallback(
    (el: HTMLElement, x: number, y: number) => {
      const [cx, cy] = getCenterOfElement(el)
      const dx = x - cx
      const dy = y - cy
      if (dx === 0 && dy === 0) return 0
      const radians = Math.atan2(dy, dx)
      let degrees = radians * (180 / Math.PI) + 90
      if (degrees < 0) degrees += 360
      return degrees
    },
    [getCenterOfElement]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const card = cardRef.current
      if (!card) return

      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const edge = getEdgeProximity(card, x, y)
      const angle = getCursorAngle(card, x, y)

      card.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(3)}`)
      card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`)
    },
    [getEdgeProximity, getCursorAngle]
  )

  useEffect(() => {
    if (!animated || !cardRef.current) return
    const card = cardRef.current
    const angleStart = 110
    const angleEnd = 465
    card.classList.add('sweep-active')
    card.style.setProperty('--cursor-angle', `${angleStart}deg`)

    animateValue({
      duration: 500,
      onUpdate: (v) => card.style.setProperty('--edge-proximity', `${v}`),
    })
    animateValue({
      ease: easeInCubic,
      duration: 1500,
      end: 50,
      onUpdate: (v) => {
        card.style.setProperty(
          '--cursor-angle',
          `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`
        )
      },
    })
    animateValue({
      ease: easeOutCubic,
      delay: 1500,
      duration: 2250,
      start: 50,
      end: 100,
      onUpdate: (v) => {
        card.style.setProperty(
          '--cursor-angle',
          `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`
        )
      },
    })
    animateValue({
      ease: easeInCubic,
      delay: 2500,
      duration: 1500,
      start: 100,
      end: 0,
      onUpdate: (v) => card.style.setProperty('--edge-proximity', `${v}`),
      onEnd: () => card.classList.remove('sweep-active'),
    })
  }, [animated])

  const glowVars = buildGlowVars(glowColor, glowIntensity)

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`border-glow-card ${className}`}
      style={
        {
          '--card-bg': backgroundColor,
          '--edge-sensitivity': edgeSensitivity,
          '--border-radius': `${borderRadius}px`,
          '--glow-padding': `${glowRadius}px`,
          '--cone-spread': coneSpread,
          '--fill-opacity': fillOpacity,
          ...glowVars,
          ...buildGradientVars(colors),
        } as React.CSSProperties
      }
    >
      <span className="edge-light" />
      <div className="border-glow-inner">{children}</div>
    </div>
  )
}

/* ----------------------------------------------------------------
   WebThreads (merged from components/WebThreads.tsx)
   ---------------------------------------------------------------- */

type FanMode = 'center' | 'left' | 'right'

interface WebThreadsProps {
  color1?: string
  color2?: string
  color3?: string
  speed?: number
  threadCount?: number
  frequency?: number
  spread?: number
  taper?: number
  position?: number
  fanMode?: FanMode
  glow?: number
  falloff?: number
  thickness?: number
  brightness?: number
  opacity?: number
  mirror?: boolean
  shimmer?: boolean
  grain?: boolean
  grainIntensity?: number
  mouseInteraction?: boolean
  mouseStrength?: number
  className?: string
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [1, 1, 1]
  return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
}

const FAN_MODE: Record<FanMode, number> = { center: 0, left: 1, right: 2 }

const webThreadsVertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const webThreadsFragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uThreadCount;
uniform float uFrequency;
uniform float uSpread;
uniform float uTaper;
uniform float uPosition;
uniform float uFanMode;
uniform float uGlow;
uniform float uFalloff;
uniform float uThickness;
uniform float uBrightness;
uniform float uOpacity;
uniform float uMirror;
uniform float uShimmer;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uEnableMouse;
uniform float uMouseActive;
out vec4 fragColor;

#define TAU 6.28318530718
#define MAX_THREADS 10

float glow(float x, float str, float dist) {
  return dist / pow(max(x, 1e-4), str);
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float n = max(uThreadCount, 1.0);

  float pinchX = uFanMode < 0.5 ? 0.5 : (uFanMode < 1.5 ? 0.0 : 1.0);
  if (uEnableMouse > 0.5) {
    pinchX = mix(pinchX, uMouse.x, clamp(uMouseStrength, 0.0, 1.0) * uMouseActive);
  }

  float spreadDx = uSpread * abs(uv.x - pinchX);
  float baseT = iTime * uSpeed;
  float tauOverN = TAU / n;
  float mirror = uMirror > 0.5 ? sign(pinchX - uv.x) : 1.0;
  bool doShimmer = uShimmer > 0.5;
  float shimmerT = iTime * 1.7;
  float invThickness = 1.0 / max(uThickness, 0.01);
  float xFreq = uv.x * uFrequency;
  float yOff = uv.y - uPosition;
  float ciScale = n > 1.0 ? 1.0 / (n - 1.0) : 0.0;

  vec3 col = vec3(0.0);
  float gsum = 0.0;

  for (int idx = 0; idx < MAX_THREADS; idx++) {
    float i = float(idx);
    if (i >= n) break;

    float amplitude = spreadDx * (1.0 + i * uTaper);
    float shimmer = doShimmer ? sin(shimmerT + i * 1.3) * 0.35 : 0.0;
    float phase = (baseT + i * tauOverN) * mirror + shimmer;

    float sdf = abs(yOff + sin(xFreq + phase) * amplitude) * invThickness;

    float g = glow(sdf, uFalloff, uGlow);
    float ci = i * ciScale;
    vec3 threadCol = mix(uColor1, uColor2, ci);

    col += g * threadCol;
    gsum += g;
  }

  float coreAmt = smoothstep(0.5, 2.2, gsum);
  col = mix(col, uColor3 * gsum, coreAmt * 0.5);

  float bright = uBrightness;
  if (uEnableMouse > 0.5) {
    vec2 md = uv - uMouse;
    float d2 = dot(md, md);
    bright += clamp(uMouseStrength, 0.0, 1.0) * uMouseActive * exp(-d2 * 6.0) * 0.6;
  }
  col *= bright;

  float alpha = clamp(gsum, 0.0, 1.0) * uOpacity;

  vec3 outRgb = col * alpha;

  if (uGrain > 0.5) {
    float gv = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453) - 0.5) * uGrainIntensity;
    outRgb = clamp(outRgb + gv, 0.0, 1.0);
    alpha = clamp(alpha + gv, 0.0, 1.0);
  }

  fragColor = vec4(outRgb, alpha);
}
`

type WebThreadsCtx = {
  renderer: InstanceType<typeof Renderer>
  program: InstanceType<typeof Program>
  mesh: InstanceType<typeof Mesh>
}
const webThreadsCtxMap = new WeakMap<HTMLDivElement, WebThreadsCtx>()

const WebThreads: React.FC<WebThreadsProps> = ({
  color1 = '#5227FF',
  color2 = '#FF9FFC',
  color3 = '#FFFFFF',
  speed = 0.2,
  threadCount = 6,
  frequency = 5.0,
  spread = 0.18,
  taper = 1.0,
  position = 0.5,
  fanMode = 'center',
  glow = 0.02,
  falloff = 0.6,
  thickness = 1.1,
  brightness = 0.6,
  opacity = 1.0,
  mirror = true,
  shimmer = false,
  grain = true,
  grainIntensity = 0.05,
  mouseInteraction = true,
  mouseStrength = 0.3,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mouseRef = useRef<{ enabled: boolean; strength: number }>({ enabled: true, strength: 0.3 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    })

    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    container.appendChild(canvas)

    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex: webThreadsVertex,
      fragment: webThreadsFragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: 0.2 },
        uThreadCount: { value: 6 },
        uFrequency: { value: 5.0 },
        uSpread: { value: 0.18 },
        uTaper: { value: 1.0 },
        uPosition: { value: 0.5 },
        uFanMode: { value: 0 },
        uGlow: { value: 0.02 },
        uFalloff: { value: 0.6 },
        uThickness: { value: 1.1 },
        uBrightness: { value: 0.6 },
        uOpacity: { value: 1.0 },
        uMirror: { value: 1.0 },
        uShimmer: { value: 0.0 },
        uGrain: { value: 1.0 },
        uGrainIntensity: { value: 0.05 },
        uColor1: { value: new Float32Array([1, 1, 1]) },
        uColor2: { value: new Float32Array([1, 1, 1]) },
        uColor3: { value: new Float32Array([1, 1, 1]) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseStrength: { value: 0.3 },
        uEnableMouse: { value: 1.0 },
        uMouseActive: { value: 0 },
      },
    })

    const mesh = new Mesh(gl, { geometry, program })
    webThreadsCtxMap.set(container, { renderer, program, mesh })

    const setSize = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      renderer.setSize(w, h)
      const res = (program.uniforms.iResolution as { value: Float32Array }).value
      res[0] = gl.drawingBufferWidth
      res[1] = gl.drawingBufferHeight
      renderer.render({ scene: mesh })
    }

    const ro = new ResizeObserver(setSize)
    ro.observe(container)
    setSize()

    const currentMouse: [number, number] = [0.5, 0.5]
    const targetMouse: [number, number] = [0.5, 0.5]
    let currentActive = 0
    let targetActive = 0

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      targetMouse[0] = (e.clientX - rect.left) / rect.width
      targetMouse[1] = 1.0 - (e.clientY - rect.top) / rect.height
      targetActive = 1
    }
    const onMouseEnter = () => {
      targetActive = 1
    }
    const onMouseLeave = () => {
      targetActive = 0
    }
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseenter', onMouseEnter)
    canvas.addEventListener('mouseleave', onMouseLeave)

    let raf = 0
    let isVisible = true
    let isPageVisible = !document.hidden
    const t0 = performance.now()

    const loop = (t: number) => {
      ; (program.uniforms.iTime as { value: number }).value = (t - t0) * 0.001
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0])
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1])
      currentActive += 0.05 * (targetActive - currentActive)
      const mouse = (program.uniforms.uMouse as { value: Float32Array }).value
      mouse[0] = currentMouse[0]
      mouse[1] = currentMouse[1]
        ; (program.uniforms.uMouseActive as { value: number }).value = currentActive
        ; (program.uniforms.uEnableMouse as { value: number }).value = mouseRef.current.enabled ? 1.0 : 0.0
        ; (program.uniforms.uMouseStrength as { value: number }).value = mouseRef.current.strength
      renderer.render({ scene: mesh })
      raf = requestAnimationFrame(loop)
    }

    const tryStart = () => {
      if (isVisible && isPageVisible && raf === 0) raf = requestAnimationFrame(loop)
    }
    const tryStop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        isVisible ? tryStart() : tryStop()
      },
      { threshold: 0 }
    )
    io.observe(container)

    const onVisibility = () => {
      isPageVisible = !document.hidden
      isPageVisible ? tryStart() : tryStop()
    }
    document.addEventListener('visibilitychange', onVisibility)

    tryStart()

    return () => {
      tryStop()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseenter', onMouseEnter)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      webThreadsCtxMap.delete(container)
      try {
        container.removeChild(canvas)
      } catch { }
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ctx = webThreadsCtxMap.get(container)
    if (!ctx) return
    const { program } = ctx
    const u = program.uniforms as Record<string, { value: any }>

    u.uSpeed.value = speed
    u.uThreadCount.value = Math.round(threadCount)
    u.uFrequency.value = frequency
    u.uSpread.value = spread
    u.uTaper.value = taper
    u.uPosition.value = position
    u.uFanMode.value = FAN_MODE[fanMode] ?? 0
    u.uGlow.value = glow
    u.uFalloff.value = falloff
    u.uThickness.value = thickness
    u.uBrightness.value = brightness
    u.uOpacity.value = opacity
    u.uMirror.value = mirror ? 1.0 : 0.0
    u.uShimmer.value = shimmer ? 1.0 : 0.0
    u.uGrain.value = grain ? 1.0 : 0.0
    u.uGrainIntensity.value = grainIntensity
    const c1 = u.uColor1.value as Float32Array
    const rgb1 = hexToRgb(color1)
    c1[0] = rgb1[0]
    c1[1] = rgb1[1]
    c1[2] = rgb1[2]
    const c2 = u.uColor2.value as Float32Array
    const rgb2 = hexToRgb(color2)
    c2[0] = rgb2[0]
    c2[1] = rgb2[1]
    c2[2] = rgb2[2]
    const c3 = u.uColor3.value as Float32Array
    const rgb3 = hexToRgb(color3)
    c3[0] = rgb3[0]
    c3[1] = rgb3[1]
    c3[2] = rgb3[2]
    u.uMouseStrength.value = mouseStrength
    u.uEnableMouse.value = mouseInteraction ? 1.0 : 0.0
    mouseRef.current.enabled = mouseInteraction
    mouseRef.current.strength = mouseStrength
  }, [
    color1,
    color2,
    color3,
    speed,
    threadCount,
    frequency,
    spread,
    taper,
    position,
    fanMode,
    glow,
    falloff,
    thickness,
    brightness,
    opacity,
    mirror,
    shimmer,
    grain,
    grainIntensity,
    mouseInteraction,
    mouseStrength,
  ])

  return <div ref={containerRef} className={`web-threads-container ${className}`.trim()} />
}

/* ----------------------------------------------------------------
   ScrollReveal (merged from components/ScrollReveal.jsx)
   ---------------------------------------------------------------- */

interface ScrollRevealProps {
  children?: React.ReactNode
  className?: string
  delay?: number
}

function ScrollReveal({ children, className = '', delay = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('visible')
          }, delay)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  )
}

/* ----------------------------------------------------------------
   BlurText (merged from components/BlurText.jsx)
   ---------------------------------------------------------------- */

const buildKeyframes = (from: Record<string, any>, steps: Record<string, any>[]) => {
  const keys = new Set([
    ...Object.keys(from),
    ...steps.flatMap((s) => Object.keys(s)),
  ])

  const keyframes: Record<string, any[]> = {}
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])]
  })
  return keyframes
}

interface BlurTextProps {
  text?: string
  delay?: number
  initialDelay?: number
  className?: string
  animateBy?: 'words' | 'letters'
  direction?: 'top' | 'bottom'
  threshold?: number
  rootMargin?: string
  animationFrom?: Record<string, any>
  animationTo?: Record<string, any>[]
  easing?: (t: number) => number
  onAnimationComplete?: () => void
  stepDuration?: number
}

const BlurText = ({
  text = '',
  delay = 200,
  initialDelay = 0,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = (t: number) => t,
  onAnimationComplete,
  stepDuration = 0.35,
}: BlurTextProps) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('')
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(ref.current!)
        }
      },
      { threshold, rootMargin }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  const defaultFrom = useMemo(
    () =>
      direction === 'top'
        ? { filter: 'blur(10px)', opacity: 0, y: -50 }
        : { filter: 'blur(10px)', opacity: 0, y: 50 },
    [direction]
  )

  const defaultTo = useMemo(
    () => [
      {
        filter: 'blur(5px)',
        opacity: 0.5,
        y: direction === 'top' ? 5 : -5,
      },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ],
    [direction]
  )

  const fromSnapshot = animationFrom ?? defaultFrom
  const toSnapshots = animationTo ?? defaultTo

  const stepCount = toSnapshots.length + 1
  const totalDuration = stepDuration * (stepCount - 1)
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1)
  )

  return (
    <p
      ref={ref}
      className={className}
      style={{ display: 'flex', flexWrap: 'wrap' }}
    >
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots)

        const spanTransition = {
          duration: totalDuration,
          times,
          delay: (initialDelay + index * delay) / 1000,
          ease: easing,
        }

        return (
          <motion.span
            key={index}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={
              index === elements.length - 1 ? onAnimationComplete : undefined
            }
            style={{
              display: 'inline-block',
              willChange: 'transform, filter, opacity',
            }}
          >
            {segment === ' ' ? '\u00A0' : segment}
            {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
          </motion.span>
        )
      })}
    </p>
  )
}

/* ----------------------------------------------------------------
   SpotlightNavbar (merged from components/SpotlightNavbar.jsx)
   ---------------------------------------------------------------- */

interface NavItem {
  label: string
  href: string
  index: number
}

interface SpotlightNavbarProps {
  items?: NavItem[]
  className?: string
  onItemClick?: (item: NavItem, index: number) => void
  activeIndex?: number
}

function SpotlightNavbar({
  items = [],
  className,
  onItemClick,
  activeIndex = 0,
}: SpotlightNavbarProps) {
  const navRef = useRef<HTMLElement | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)

  // Refs for the "light" positions so we can animate them imperatively
  const spotlightX = useRef(0)
  const ambienceX = useRef(0)

  useEffect(() => {
    if (!navRef.current) return
    const nav = navRef.current

    const handleMouseMove = (e: MouseEvent) => {
      const rect = nav.getBoundingClientRect()
      const x = e.clientX - rect.left
      setHoverX(x)
      // Direct update for immediate feedback (no spring for the mouse itself, feels snappier)
      spotlightX.current = x
      nav.style.setProperty('--spotlight-x', `${x}px`)
    }

    const handleMouseLeave = () => {
      setHoverX(null)
      // When mouse leaves, spring the spotlight back to the active item
      const activeItem = nav.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
      if (activeItem) {
        const navRect = nav.getBoundingClientRect()
        const itemRect = activeItem.getBoundingClientRect()
        const targetX = itemRect.left - navRect.left + itemRect.width / 2

        animate(spotlightX.current, targetX, {
          type: 'spring',
          stiffness: 200,
          damping: 20,
          onUpdate: (v: number) => {
            spotlightX.current = v
            nav.style.setProperty('--spotlight-x', `${v}px`)
          },
        })
      }
    }

    nav.addEventListener('mousemove', handleMouseMove)
    nav.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      nav.removeEventListener('mousemove', handleMouseMove)
      nav.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [activeIndex])

  // Handle the "Ambience" (Active Item) Movement
  useEffect(() => {
    if (!navRef.current) return
    const nav = navRef.current
    const activeItem = nav.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null

    if (activeItem) {
      const navRect = nav.getBoundingClientRect()
      const itemRect = activeItem.getBoundingClientRect()
      const targetX = itemRect.left - navRect.left + itemRect.width / 2

      animate(ambienceX.current, targetX, {
        type: 'spring',
        stiffness: 200,
        damping: 20,
        onUpdate: (v: number) => {
          ambienceX.current = v
          nav.style.setProperty('--ambience-x', `${v}px`)
        },
      })
    }
  }, [activeIndex, items])

  const handleItemClick = (item: NavItem, index: number) => {
    onItemClick?.(item, index)
  }

  return (
    <div className={cn('relative flex justify-center pt-10', className)}>
      <nav
        ref={navRef}
        className={cn(
          'spotlight-nav',
          'relative h-12 rounded-full transition-all duration-300 overflow-hidden'
        )}
      >
        {/* Content */}
        <ul className="relative flex items-center h-full px-3 gap-1 z-[10]">
          {items.map((item, idx) => (
            <li key={idx} className="relative h-full flex items-center justify-center">
              <a
                href={item.href}
                data-index={idx}
                onClick={(e) => {
                  e.preventDefault()
                  handleItemClick(item, idx)
                }}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-full',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                  // Active vs Inactive Text
                  activeIndex === idx
                    ? 'text-white'
                    : 'text-white/40 hover:text-white'
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        {/* 1. The Moving Spotlight (Follows Mouse) */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 w-full h-full z-[1] opacity-0 transition-opacity duration-300"
          style={{
            opacity: hoverX !== null ? 1 : 0,
            background: `
              radial-gradient(
                120px circle at var(--spotlight-x) 100%, 
                var(--spotlight-color, rgba(255,255,255,0.08)) 0%, 
                transparent 50%
              )
            `,
          }}
        />

        {/* 2. The Active State Ambience (Stays on Active) */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 w-full h-[2px] z-[2]"
          style={{
            background: `
                  radial-gradient(
                    60px circle at var(--ambience-x) 0%, 
                    var(--ambience-color, rgba(255,255,255,0.8)) 0%, 
                    transparent 100%
                  )
                `,
          }}
        />
      </nav>

      <style>{`
        .spotlight-nav {
          --spotlight-color: rgba(255, 255, 255, 0.1);
          --ambience-color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 30px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  )
}

/* ----------------------------------------------------------------
   Navbar (merged from components/Navbar.jsx)
   ---------------------------------------------------------------- */

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Workflow', href: '#how-it-works' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Security', href: '#security' },
]

function MarkifyLogo() {
  return (
    <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="flex items-center gap-2 group relative z-50">
      <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center transition-transform group-hover:scale-105 overflow-hidden">
        <img 
          src={markifyLogo} 
          alt="Markify Logo" 
          className="w-full h-full object-contain"
          style={{
            /* HOW TO USE: */
            /* translate(Left/Right, Up/Down) */
            /* scale(Size Multiplier) */
            transform: 'translate(2px, -3px) scale(1)' 
          }}
        />
      </div>
      <span className="text-white text-lg sm:text-xl font-medium tracking-tight">
        Markify
      </span>
    </a>
  )
}

/* ----------------------------------------------------------------
   SpecularButton (merged from components/SpecularButton.jsx)
   ---------------------------------------------------------------- */
type ButtonSize = 'sm' | 'md' | 'lg';

export interface SpecularButtonProps {
  as?: React.ElementType | string;
  href?: string;
  children?: ReactNode;
  size?: ButtonSize;
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  target?: string;
  rel?: string;
}

interface ShaderProps {
  radius: number;
  lineColor: string;
  baseColor: string;
  intensity: number;
  shineSize: number;
  shineFade: number;
  thickness: number;
  speed: number;
  followMouse: boolean;
  proximity: number;
  autoAnimate: boolean;
}

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

const SpecularButton = ({
  as: Component = 'button',
  href,
  children = 'Get Started',
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  target,
  rel
}: SpecularButtonProps) => {
  const btnRef = useRef<HTMLElement>(null);
  const fxRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef<ShaderProps>({} as ShaderProps);

  propsRef.current = { radius, lineColor, baseColor, intensity, shineSize, shineFade, thickness, speed, followMouse, proximity, autoAnimate };

  useEffect(() => {
    const btn = btnRef.current;
    const fx = fxRef.current;
    if (!btn || !fx) return;

    const dpr = window.devicePixelRatio || 1;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uAngle: { value: 2.4 },
        uPx: { value: dpr },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.32, 0.32, 0.32] },
        uIntensity: { value: 1 },
        uShineSize: { value: 0.17 },
        uShineFade: { value: 0.7 },
        uThickness: { value: 1 },
        uBaseWidth: { value: dpr }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });
    fx.appendChild(gl.canvas);

    const sizeRef = { w: 1, h: 1 };
    const resize = () => {
      const w = btn.offsetWidth;
      const h = btn.offsetHeight;
      sizeRef.w = w;
      sizeRef.h = h;
      renderer.setSize(w + PAD * 2, h + PAD * 2);
      program.uniforms.uCenter.value = [(PAD + w / 2) * dpr, (PAD + h / 2) * dpr];
      program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(btn);
    resize();

    let pointerAngle: number | null = null;
    let proximityT = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
    };
    window.addEventListener('pointermove', onPointerMove);

    let angle = 2.4;
    let idleAngle = 2.4;
    let bright = 0;
    let last = performance.now();
    let raf = 0;

    const lineC = new Color();
    const baseC = new Color();

    const update = (now: number) => {
      raf = requestAnimationFrame(update);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = propsRef.current;

      idleAngle += p.speed * dt;
      const steer = p.followMouse && pointerAngle != null && (!p.autoAnimate || proximityT > 0);
      const target = steer ? (pointerAngle as number) : idleAngle;
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 7));

      const brightTarget = p.autoAnimate ? 1 : proximityT;
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));

      lineC.set(p.lineColor);
      baseC.set(p.baseColor);
      program.uniforms.uAngle.value = angle;
      program.uniforms.uRadius.value = Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
      program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
      program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
      program.uniforms.uIntensity.value = p.intensity * bright;
      program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
      program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
      program.uniforms.uThickness.value = p.thickness * dpr;
      renderer.render({ scene: mesh });
    };
    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return (
    <Component
      href={href}
      target={target}
      rel={rel}
      ref={btnRef as any}
      type={Component === 'button' ? type : undefined}
      disabled={Component === 'button' ? disabled : undefined}
      onClick={onClick}
      className={`specular-button specular-button--${size}${className ? ` ${className}` : ''}`}
      style={
        {
          '--sb-radius': `${radius}px`,
          '--sb-tint': tint,
          '--sb-tint-opacity': tintOpacity,
          '--sb-blur': `${blur}px`,
          '--sb-text-color': textColor
        } as CSSProperties
      }
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </Component>
  );
};

/* ----------------------------------------------------------------
   AccessModal
   ---------------------------------------------------------------- */

function AccessModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Replaced Tailwind backdrop-blur with native inline style for server compatibility */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
            style={{ 
              backdropFilter: 'blur(16px)', 
              WebkitBackdropFilter: 'blur(16px)' 
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#0B0806] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
          >
            {/* Replaced Tailwind blur-[80px] with native inline filter so it doesn't render as a hard box */}
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[50%] bg-[#f472b6]/20 pointer-events-none" 
              style={{ 
                filter: 'blur(80px)', 
                WebkitFilter: 'blur(80px)' 
              }}
            />
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-[#f472b6]" />
              </div>
              
              <h3 className="text-2xl font-medium text-white mb-2">Restricted Access</h3>
              
              <p className="text-white/60 mb-6 leading-relaxed">
                Currently, Markify is exclusively available for <strong>Shah and Anchor Kutchhi Engineering College</strong>.
              </p>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 w-full text-left text-sm text-white/70 space-y-3">
                <p>
                  To request access, please email us from your official college or organization email address.
                </p>
                <p>
                  If you belong to another institution, please attach a valid ID proof along with your request.
                </p>
              </div>
              
              <div className="flex w-full gap-4">
                <SpecularButton
                  as="button"
                  onClick={onClose}
                  size="md"
                  radius={999}
                  blur={4}
                  className="flex-1 liquid-glass hover:bg-white/5 transition-colors"
                >
                  Cancel
                </SpecularButton>
                <SpecularButton
                  as="a"
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=markify@sakec.ac.in&su=Requesting%20Access%20to%20Markify"
                  target="_blank"
                  rel="noreferrer"
                  size="md"
                  radius={999}
                  blur={4}
                  className="flex-1 liquid-glass !text-white/90 hover:!text-white transition-colors border-[#f472b6]/30 bg-[#f472b6]/10"
                >
                  Go to Mail
                </SpecularButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
function Navbar({ onSupportClick }: { onSupportClick?: () => void }) {
  const navigate = useNavigate(); // <-- Added router hook
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY
      const vh = window.innerHeight


      // Hide the main navbar when past half the hero section to prevent collision with floating nav
      if (current > vh / 2 - 50) {
        setVisible(false)
        setMobileOpen(false)
      } else {
        setVisible(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNavClick = () => {
    setMobileOpen(false)
  }

  return (
    <>
      <AccessModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="px-5 sm:px-6 md:px-12 lg:px-16 py-4 sm:py-5">
          {/* Changed to a 3-column Grid layout for perfect absolute centering */}
          <div className="grid grid-cols-2 md:grid-cols-3 items-center w-full relative">
            
            {/* Left Column: Logo */}
            <div className="flex justify-start">
              <MarkifyLogo />
            </div>

            {/* Center Column: Desktop Nav */}
            <div className="hidden md:flex justify-center">
              {/* Removed the background, border, and shadow for a clean look */}
              <nav className="flex items-center gap-1 px-3 py-1.5">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium px-4 py-2 rounded-full transition-all duration-300"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>

            {/* Right Column: Desktop CTA */}
            <div className="hidden md:flex justify-end items-center gap-4">
              <SpecularButton
                as="button"
                onClick={onSupportClick}
                size="sm"
                radius={999}
                blur={4}
                className="liquid-glass !text-white/80 hover:!text-white transition-colors"
              >
                Support
              </SpecularButton>
              <SpecularButton
                as="button"
                onClick={() => navigate('/login')}
                size="sm"
                radius={999}
                blur={4}
                className="liquid-glass !text-white/80 hover:!text-white transition-colors"
              >
                Log in
              </SpecularButton>
              <SpecularButton
                as="button"
                onClick={() => setIsModalOpen(true)}
                size="sm"
                radius={999}
                blur={4}
                className="liquid-glass hover:bg-white/10 transition-colors"
              >
                Get Access
              </SpecularButton>
            </div>

            {/* Mobile toggle (Remains in the right column on small screens) */}
            <div className="flex md:hidden justify-end">
              <button
                className="relative w-8 h-8 flex items-center justify-center text-white"
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-label="Toggle menu"
              >
                <Menu
                  className={`absolute w-5 h-5 transition-all duration-300 ${mobileOpen
                    ? 'opacity-0 rotate-90 scale-75'
                    : 'opacity-100 rotate-0 scale-100'
                    }`}
                />
                <X
                  className={`absolute w-5 h-5 transition-all duration-300 ${mobileOpen
                    ? 'opacity-100 rotate-0 scale-100'
                    : 'opacity-0 -rotate-90 scale-75'
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div
            className={`absolute top-full left-4 right-4 mt-2 bg-[#2C221C]/95 backdrop-blur-xl rounded-2xl p-6 z-50 transition-all duration-400 ${mobileOpen
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 -translate-y-2 scale-[0.96] pointer-events-none'
              }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-white text-base font-medium hover:text-white/80 transition-colors"
                  onClick={handleNavClick}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-4">
              <SpecularButton
                as="button"
                onClick={() => {
                  if (onSupportClick) onSupportClick();
                  setMobileOpen(false);
                }}
                size="sm"
                radius={999}
                blur={4}
                className="liquid-glass !text-white/90 hover:!text-white transition-colors"
              >
                Support
              </SpecularButton>
              <SpecularButton
                as="button"
                onClick={() => {
                  navigate('/login');
                  setMobileOpen(false);
                }}
                size="sm"
                radius={999}
                blur={4}
                className="liquid-glass !text-white/90 hover:!text-white transition-colors"
              >
                Log in
              </SpecularButton>
              <SpecularButton
                as="button"
                onClick={() => setIsModalOpen(true)}
                size="sm"
                radius={999}
                blur={4}
                className="liquid-glass hover:bg-white/10 transition-colors"
              >
                Get Access
              </SpecularButton>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}

/* ----------------------------------------------------------------
   HeroSection (merged from components/HeroSection.jsx)
   ---------------------------------------------------------------- */

function MouseGlow() {
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[1]"
      style={{
        background: `radial-gradient(700px circle at ${pos.x}px ${pos.y}px, rgba(255,200,150,0.06), transparent 50%)`,
      }}
    />
  )
}

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      <div
        className="absolute top-[20%] left-[20%] w-[500px] h-[500px] rounded-full blur-3xl"
        style={{
          background: 'rgba(210, 160, 110, 0.025)',
          animation: 'float-orbit-1 22s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[25%] right-[20%] w-[400px] h-[400px] rounded-full blur-3xl"
        style={{
          background: 'rgba(200, 140, 80, 0.025)',
          animation: 'float-orbit-2 28s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-[45%] right-[30%] w-[350px] h-[350px] rounded-full blur-3xl"
        style={{
          background: 'rgba(220, 180, 130, 0.02)',
          animation: 'float-orbit-1 32s ease-in-out infinite reverse',
        }}
      />
    </div>
  )
}

function HeroSection() {
  const progress = useHeroScroll()

  // Content: fades out and shifts up as you scroll
  const contentOpacity = Math.max(1 - progress * 2.5, 0) // fades by 40% scroll
  const contentShift = progress * -80 // moves up 80px by full scroll

  // Video: subtle zoom as you scroll
  const videoScale = 1 + progress * 0.08

  return (
    <section className="h-screen w-full overflow-hidden relative flex flex-col">
      {/* Background video — subtle zoom on scroll */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260703_053131_1ec3dd1c-d627-44fb-ab20-6e1fce41b0d5.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          transform: `scale(${videoScale})`,
          willChange: 'transform',
        }}
      />

      {/* Subtle dark overlay */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Interactive layers */}
      <MouseGlow />
      <FloatingOrbs />

      {/* Bottom gradient for smooth page transition */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#080604] z-[2]" />

      {/* Hero content — parallax shift + fade out on scroll */}
      <div
        className="relative z-10 flex flex-col h-full items-center justify-center px-5 sm:px-6 pb-32 sm:pb-48 md:pb-64"
        style={{
          opacity: contentOpacity,
          transform: `translateY(${contentShift}px)`,
          willChange: 'transform, opacity',
        }}
      >
        <div className="text-center max-w-3xl flex flex-col items-center w-full">
          <BlurText
            text="Markify"
            delay={100}
            animateBy="letters"
            direction="top"
            /* Reverted to the elegant, tighter margin */
            className="text-white text-5xl sm:text-6xl md:text-7xl lg:text-[6rem] font-medium tracking-[0.03em] mb-4 sm:mb-6 justify-center"
          />
          {/* Tighter gap to group the motto together visually */}
          <div className="flex flex-col items-center gap-1 sm:gap-2">
            <BlurText
              text="Bridge the gaps."
              delay={100}
              initialDelay={1000}
              animateBy="words"
              direction="top"
              /* Refined line-height (1.1) to prevent overlap without adding dead space */
              className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-[1.1] tracking-[-0.02em] justify-center"
            />
            <BlurText
              text="Ditch the grindwork."
              delay={100}
              initialDelay={1400}
              animateBy="words"
              direction="top"
              className="text-white/60 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-[1.1] tracking-[-0.02em] justify-center"
            />
          </div>

          <p className="text-white/70 text-sm sm:text-base md:text-lg leading-relaxed max-w-md mx-auto mt-6 sm:mt-8">
            Markify unifies your complete grading workflow, so the faculties
            spends less energy on repetitive assessment and more on actual
            teaching.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   FeaturesSection (merged from components/FeaturesSection.jsx)
   ---------------------------------------------------------------- */

const FEATURES = [
  {
    icon: Users,
    title: 'Seamless Sync',
    description:
      'Automatically syncs class rosters, assignments, and rubrics directly from your classroom platform.',
  },
  {
    icon: FileText,
    title: 'Smart Ingestion',
    description:
      'Converts Word, PowerPoint, and image submissions into standardized PDFs for consistent evaluation.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Grading',
    description:
      'Evaluates submissions against deterministic rubrics using a vision-language model - right on your servers.',
  },
  {
    icon: Search,
    title: 'Intra-cohort Similarity Detection',
    description:
      'Cross-references submissions within cohorts to flag duplication and collusion. No external APIs required.',
  },
  {
    icon: Activity,
    title: 'Live Telemetry',
    description:
      'Real-time dashboard updates powered by event-driven notifications. No polling, no manual refreshes.',
  },
  {
    icon: Upload,
    title: 'One-Click Export',
    description:
      'Push verified grades directly to the gradebook or download a comprehensive Excel report instantly.',
  },
]

function FeaturesSection() {
  const heading = useParallax(0.12)

  return (
    <section
      id="features"
      className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-5 sm:px-6 md:px-12 lg:px-16 relative overflow-hidden min-h-[100dvh] flex flex-col justify-center"
    >
      <div className="max-w-6xl mx-auto relative z-10">
        <div ref={heading.ref} style={heading.style} className="text-center mb-16 sm:mb-20">
          <BlurText
            text="Capabilities"
            className="text-white/40 text-xs sm:text-sm font-medium tracking-[0.2em] uppercase mb-4 justify-center"
            delay={30}
            direction="bottom"
            animateBy="letters"
            stepDuration={0.3}
          />
          <BlurText
            text="Everything you need"
            className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
            delay={50}
            direction="bottom"
          />
          <BlurText
            text="to automate grading"
            className="text-white/50 text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
            delay={50}
            direction="bottom"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FEATURES.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 80}>
              <BorderGlow
                className="h-full w-full"
                edgeSensitivity={30}
                glowColor="40 80 80"
                backgroundColor="#080604"
                borderRadius={16}
                glowRadius={40}
                glowIntensity={1.0}
                coneSpread={25}
                animated={false}
                colors={['#c084fc', '#f472b6', '#38bdf8']}
              >
                <div className="p-6 sm:p-8 h-full flex flex-col">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-5">
                    <feature.icon
                      className="w-5 h-5 text-white/50"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="text-white text-base sm:text-lg font-medium mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-white/45 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </BorderGlow>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   HowItWorksSection (merged from components/HowItWorksSection.jsx)
   ---------------------------------------------------------------- */

const STEPS = [
  {
    number: '01',
    icon: KeyRound,
    title: 'Authenticate & Sync',
    description:
      'Sign in securely via institutional OAuth. Markify syncs your classes, rosters, and rubrics automatically.',
  },
  {
    number: '02',
    icon: Download,
    title: 'Fetch & Normalize',
    description:
      'Pull student submissions on demand. All file types - Word, PPT, images - are converted to standardized PDFs.',
  },
  {
    number: '03',
    icon: Brain,
    title: 'AI Evaluation',
    description:
      'An asynchronous pipeline evaluates each submission against your rubric. Scores and feedback appear live on your dashboard.',
  },
  {
    number: '04',
    icon: Send,
    title: 'Review & Publish',
    description:
      'Review AI-generated scores, override if needed, then push verified grades to the gradebook with one click.',
  },
]

function HowItWorksSection() {
  const heading = useParallax(0.12)

  return (
    <section
      id="how-it-works"
      className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-5 sm:px-6 md:px-12 lg:px-16 relative overflow-hidden min-h-[100dvh] flex flex-col justify-center"
    >
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section heading with BlurText */}
        <div ref={heading.ref} style={heading.style} className="text-center mb-16 sm:mb-20">
          <BlurText
            text="Workflow"
            className="text-white/40 text-xs sm:text-sm font-medium tracking-[0.2em] uppercase mb-4 justify-center"
            delay={30}
            direction="bottom"
            animateBy="letters"
            stepDuration={0.3}
          />
          <BlurText
            text="Four steps."
            className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
            delay={50}
            direction="bottom"
          />
          <BlurText
            text="Zero friction."
            className="text-white/50 text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
            delay={50}
            direction="bottom"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.number} delay={i * 120}>
              <BorderGlow
                className="rounded-2xl h-full w-full"
                edgeSensitivity={30}
                glowColor="40 80 80"
                backgroundColor="#0A0807"
                borderRadius={16}
                glowRadius={40}
                glowIntensity={1.0}
                coneSpread={25}
                animated={false}
                colors={['#c084fc', '#f472b6', '#38bdf8']}
              >
                <div className="p-6 sm:p-8 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-white/15 text-3xl font-light tracking-tight">
                      {step.number}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                      <step.icon
                        className="w-4 h-4 text-white/50"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                  <h3 className="text-white text-base sm:text-lg font-medium mb-2">
                    {step.title}
                  </h3>
                  <p className="text-white/45 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </BorderGlow>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   ArchitectureSection (merged from components/ArchitectureSection.jsx)
   ---------------------------------------------------------------- */

const ARCH_LAYERS = [
  {
    icon: Monitor,
    label: 'Educator Dashboard',
    sublabel: 'Real-time grading interface with live WebSocket updates',
  },
  {
    icon: Server,
    label: 'API Gateway',
    sublabel: 'Authentication, routing, and event-driven telemetry',
  },
  {
    icon: Database,
    label: 'Data Layer',
    sublabel: 'Persistent storage with async notification triggers',
  },
  {
    icon: Layers,
    label: 'Orchestration Engine',
    sublabel: 'Automated pipeline for file normalization and evaluation',
  },
  {
    icon: Cpu,
    label: 'AI Inference',
    sublabel: 'On-premise vision-language model for rubric-based scoring',
  },
]

function ArchitectureSection() {
  const heading = useParallax(0.12)

  return (
    <section
      id="architecture"
      className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-5 sm:px-6 md:px-12 lg:px-16 relative overflow-hidden min-h-[100dvh] flex flex-col justify-center"
    >
      <div className="max-w-3xl mx-auto relative z-10 w-full">
        {/* Section heading with BlurText */}
        <div ref={heading.ref} style={heading.style} className="text-center mb-8 sm:mb-12">
          <BlurText
            text="Architecture"
            className="text-white/40 text-xs sm:text-sm font-medium tracking-[0.2em] uppercase mb-4 justify-center"
            delay={30}
            direction="bottom"
            animateBy="letters"
            stepDuration={0.3}
          />
          <BlurText
            text="Built for your"
            className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
            delay={50}
            direction="bottom"
          />
          <BlurText
            text="infrastructure"
            className="text-white/50 text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
            delay={50}
            direction="bottom"
          />
        </div>

        <div className="space-y-3">
          {ARCH_LAYERS.map((layer, i) => (
            <ScrollReveal key={layer.label} delay={i * 100}>
              <div className="relative">
                <BorderGlow
                  className="rounded-xl"
                  edgeSensitivity={30}
                  glowColor="40 80 80"
                  backgroundColor="#080604"
                  borderRadius={12}
                  glowRadius={40}
                  glowIntensity={1.0}
                  coneSpread={25}
                  animated={false}
                  colors={['#c084fc', '#f472b6', '#38bdf8']}
                >
                  <div className="p-4 sm:p-5 flex items-center gap-4 sm:gap-6">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
                      <layer.icon
                        className="w-5 h-5 text-white/50"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white text-sm sm:text-base font-medium">
                        {layer.label}
                      </h3>
                      <p className="text-white/40 text-xs sm:text-sm mt-0.5">
                        {layer.sublabel}
                      </p>
                    </div>
                  </div>
                </BorderGlow>

                {/* Connecting line between layers */}
                {i < ARCH_LAYERS.length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className="w-px h-2 bg-gradient-to-b from-white/10 to-white/[0.03]" />
                  </div>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={600}>
          <div className="mt-6 text-center">
            <p className="text-white/30 text-xs sm:text-sm leading-relaxed">
              Fully containerized &middot; On-premise deployment &middot; Zero external data exposure
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   SecuritySection (merged from components/SecuritySection.jsx)
   ---------------------------------------------------------------- */

const SECURITY_POINTS = [
  {
    icon: Shield,
    title: 'On-Premise Deployment',
    description:
      'Every component runs on your own servers. Student data never touches third-party cloud infrastructure.',
  },
  {
    icon: Lock,
    title: 'Domain-Locked Auth',
    description:
      'OAuth authentication with strict domain validation. Only verified institutional accounts can access the system.',
  },
  {
    icon: EyeOff,
    title: 'No External APIs',
    description:
      'Intra-cohort Similarity Detection and AI inference happen entirely on local hardware. Zero data leaves your network.',
  },
  {
    icon: Trash2,
    title: 'Automatic Cleanup',
    description:
      'Processed files are automatically purged after grading sync. No stale student data accumulates on disk.',
  },
]

function SecuritySection() {
  const heading = useParallax(0.12)

  return (
    <section
      id="security"
      className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-5 sm:px-6 md:px-12 lg:px-16 relative overflow-hidden min-h-[100dvh] flex flex-col justify-center"
    >
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Section heading with BlurText */}
        <div ref={heading.ref} style={heading.style} className="text-center mb-16 sm:mb-20">
          <BlurText
            text="Security"
            className="text-white/40 text-xs sm:text-sm font-medium tracking-[0.2em] uppercase mb-4 justify-center"
            delay={30}
            direction="bottom"
            animateBy="letters"
            stepDuration={0.3}
          />
          <BlurText
            text="Your data never leaves"
            className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
            delay={50}
            direction="bottom"
          />
          <BlurText
            text="your servers"
            className="text-white/50 text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
            delay={50}
            direction="bottom"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-4xl mx-auto">
          {SECURITY_POINTS.map((point, i) => (
            <ScrollReveal key={point.title} delay={i * 100}>
              <BorderGlow
                className="rounded-2xl h-full w-full"
                edgeSensitivity={30}
                glowColor="40 80 80"
                backgroundColor="#0A0807"
                borderRadius={16}
                glowRadius={40}
                glowIntensity={1.0}
                coneSpread={25}
                animated={false}
                colors={['#c084fc', '#f472b6', '#38bdf8']}
              >
                <div className="p-6 sm:p-8 h-full flex flex-col">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-5">
                    <point.icon
                      className="w-5 h-5 text-white/50"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="text-white text-base sm:text-lg font-medium mb-2">
                    {point.title}
                  </h3>
                  <p className="text-white/45 text-sm leading-relaxed">
                    {point.description}
                  </p>
                </div>
              </BorderGlow>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   Footer (merged from components/Footer.jsx)
   ---------------------------------------------------------------- */

function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <AccessModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <footer className="relative z-[1]">
        {/* CTA banner */}
        <div className="py-24 sm:py-32 px-5 sm:px-6 md:px-12 lg:px-16">
          <BorderGlow
            /* Changed backdrop-blur-xl to our native footer-glow-blur class */
            className="max-w-3xl mx-auto footer-glow-blur shadow-2xl"
            edgeSensitivity={30}
            glowColor="200 80 80"
            backgroundColor="rgba(0, 0, 0, 0.4)"
            borderRadius={40}
            glowRadius={40}
            glowIntensity={1.0}
            coneSpread={25}
            animated={true}
            fillOpacity={0}
            colors={['#c084fc', '#f472b6', '#38bdf8']}
          >
          {/* ... rest of the component remains exactly the same ... */}
            <div className="text-center p-10 sm:p-16 rounded-[2.5rem]">
              <BlurText
                text="Ready to automate"
                className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center"
                delay={50}
                direction="bottom"
              />
              <BlurText
                text="your grading?"
                className="text-white/50 text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] justify-center mb-6 sm:mb-8"
                delay={50}
                direction="bottom"
              />
              <ScrollReveal delay={200}>
                <p className="text-white/45 text-sm sm:text-base leading-relaxed mb-8 sm:mb-10 max-w-md mx-auto">
                  Deploy Markify on your infrastructure and let your faculty focus
                  on what matters most.
                </p>
                <SpecularButton
                  as="button"
                  onClick={() => setIsModalOpen(true)}
                  size="md"
                  radius={999}
                  blur={4}
                  className="inline-block liquid-glass hover:bg-white/10 transition-colors"
                >
                  Get Access
                </SpecularButton>
              </ScrollReveal>
            </div>
          </BorderGlow>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 px-5 sm:px-6 md:px-12 lg:px-16 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img 
                src={markifyLogoWhite} 
                alt="Markify Logo" 
                className="w-5 h-5 object-contain opacity-50"
                style={{
                  /* Tweak these numbers until it sits perfectly next to the text */
                  transform: 'translate(5px, -2px) scale(1.3)' 
                }} 
              />
              <span className="text-white/40 text-sm">
                markify@sakec.ac.in
              </span>
            </div>
            <p className="text-white/25 text-xs">
              {/* CHANGED: Replaced © with &copy; */}
              &copy; {new Date().getFullYear()} Markify. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}

/* ----------------------------------------------------------------
   LightRays Component
   ---------------------------------------------------------------- */

export type RaysOrigin =
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'right'
  | 'left'
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left';

interface LightRaysProps {
  raysOrigin?: RaysOrigin;
  raysColor?: string;
  raysSpeed?: number;
  lightSpread?: number;
  rayLength?: number;
  pulsating?: boolean;
  fadeDistance?: number;
  saturation?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  noiseAmount?: number;
  distortion?: number;
  className?: string;
}

const DEFAULT_COLOR = '#ffffff';



const getAnchorAndDir = (
  origin: RaysOrigin,
  w: number,
  h: number
): { anchor: [number, number]; dir: [number, number] } => {
  const outside = 0.2;
  switch (origin) {
    case 'top-left':
      return { anchor: [0, -outside * h], dir: [0, 1] };
    case 'top-right':
      return { anchor: [w, -outside * h], dir: [0, 1] };
    case 'left':
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case 'right':
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case 'bottom-left':
      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-center':
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-right':
      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
    default: // "top-center"
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
};

type Vec2 = [number, number];
type Vec3 = [number, number, number];

interface Uniforms {
  iTime: { value: number };
  iResolution: { value: Vec2 };
  rayPos: { value: Vec2 };
  rayDir: { value: Vec2 };
  raysColor: { value: Vec3 };
  raysSpeed: { value: number };
  lightSpread: { value: number };
  rayLength: { value: number };
  pulsating: { value: number };
  fadeDistance: { value: number };
  saturation: { value: number };
  mousePos: { value: Vec2 };
  mouseInfluence: { value: number };
  noiseAmount: { value: number };
  distortion: { value: number };
}

const LightRays: React.FC<LightRaysProps> = ({
  raysOrigin = 'top-center',
  raysColor = DEFAULT_COLOR,
  raysSpeed = 1,
  lightSpread = 1,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1.0,
  saturation = 1.0,
  followMouse = true,
  mouseInfluence = 0.1,
  noiseAmount = 0.0,
  distortion = 0.0,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef<Uniforms | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const animationIdRef = useRef<number | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }

    const initializeWebGL = async () => {
      if (!containerRef.current) return;

      await new Promise(resolve => setTimeout(resolve, 10));

      if (!containerRef.current) return;

      const renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true
      });
      rendererRef.current = renderer;

      const gl = renderer.gl;
      gl.canvas.style.width = '100%';
      gl.canvas.style.height = '100%';

      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      containerRef.current.appendChild(gl.canvas);

      const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

      const frag = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor  = color;
}`;

      const uniforms: Uniforms = {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },

        rayPos: { value: [0, 0] },
        rayDir: { value: [0, 1] },

        raysColor: { value: hexToRgb(raysColor) },
        raysSpeed: { value: raysSpeed },
        lightSpread: { value: lightSpread },
        rayLength: { value: rayLength },
        pulsating: { value: pulsating ? 1.0 : 0.0 },
        fadeDistance: { value: fadeDistance },
        saturation: { value: saturation },
        mousePos: { value: [0.5, 0.5] },
        mouseInfluence: { value: mouseInfluence },
        noiseAmount: { value: noiseAmount },
        distortion: { value: distortion }
      };
      uniformsRef.current = uniforms;

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms
      });
      const mesh = new Mesh(gl, { geometry, program });
      meshRef.current = mesh;

      const updatePlacement = () => {
        if (!containerRef.current || !renderer) return;

        renderer.dpr = Math.min(window.devicePixelRatio, 2);

        const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
        renderer.setSize(wCSS, hCSS);

        const dpr = renderer.dpr;
        const w = wCSS * dpr;
        const h = hCSS * dpr;

        uniforms.iResolution.value = [w, h];

        const { anchor, dir } = getAnchorAndDir(raysOrigin, w, h);
        uniforms.rayPos.value = anchor;
        uniforms.rayDir.value = dir;
      };

      const loop = (t: number) => {
        if (!rendererRef.current || !uniformsRef.current || !meshRef.current) {
          return;
        }

        uniforms.iTime.value = t * 0.001;

        if (followMouse && mouseInfluence > 0.0) {
          const smoothing = 0.92;

          smoothMouseRef.current.x = smoothMouseRef.current.x * smoothing + mouseRef.current.x * (1 - smoothing);
          smoothMouseRef.current.y = smoothMouseRef.current.y * smoothing + mouseRef.current.y * (1 - smoothing);

          uniforms.mousePos.value = [smoothMouseRef.current.x, smoothMouseRef.current.y];
        }

        try {
          renderer.render({ scene: mesh });
          animationIdRef.current = requestAnimationFrame(loop);
        } catch (error) {
          console.warn('WebGL rendering error:', error);
          return;
        }
      };

      window.addEventListener('resize', updatePlacement);
      updatePlacement();
      animationIdRef.current = requestAnimationFrame(loop);

      cleanupFunctionRef.current = () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = null;
        }

        window.removeEventListener('resize', updatePlacement);

        if (renderer) {
          try {
            const canvas = renderer.gl.canvas;
            const loseContextExt = renderer.gl.getExtension('WEBGL_lose_context');
            if (loseContextExt) {
              loseContextExt.loseContext();
            }

            if (canvas && canvas.parentNode) {
              canvas.parentNode.removeChild(canvas);
            }
          } catch (error) {
            console.warn('Error during WebGL cleanup:', error);
          }
        }

        rendererRef.current = null;
        uniformsRef.current = null;
        meshRef.current = null;
      };
    };

    initializeWebGL();

    return () => {
      if (cleanupFunctionRef.current) {
        cleanupFunctionRef.current();
        cleanupFunctionRef.current = null;
      }
    };
  }, [
    isVisible,
    raysOrigin,
    raysColor,
    raysSpeed,
    lightSpread,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    followMouse,
    mouseInfluence,
    noiseAmount,
    distortion
  ]);

  useEffect(() => {
    if (!uniformsRef.current || !containerRef.current || !rendererRef.current) return;

    const u = uniformsRef.current;
    const renderer = rendererRef.current;

    u.raysColor.value = hexToRgb(raysColor);
    u.raysSpeed.value = raysSpeed;
    u.lightSpread.value = lightSpread;
    u.rayLength.value = rayLength;
    u.pulsating.value = pulsating ? 1.0 : 0.0;
    u.fadeDistance.value = fadeDistance;
    u.saturation.value = saturation;
    u.mouseInfluence.value = mouseInfluence;
    u.noiseAmount.value = noiseAmount;
    u.distortion.value = distortion;

    const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
    const dpr = renderer.dpr;
    const { anchor, dir } = getAnchorAndDir(raysOrigin, wCSS * dpr, hCSS * dpr);
    u.rayPos.value = anchor;
    u.rayDir.value = dir;
  }, [
    raysColor,
    raysSpeed,
    lightSpread,
    raysOrigin,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    mouseInfluence,
    noiseAmount,
    distortion
  ]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !rendererRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current = { x, y };
    };

    if (followMouse) {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [followMouse]);

  return <div ref={containerRef} className={`light-rays-container ${className}`.trim()} />;
};


/* ----------------------------------------------------------------
   Support Page Components
   ---------------------------------------------------------------- */

type Side = 'left' | 'right';

export interface OptionWheelProps {
  items?: string[];
  defaultSelected?: number;
  onChange?: (index: number, item: string) => void;
  textColor?: string;
  activeColor?: string;
  side?: Side;
  fontSize?: number;
  spacing?: number;
  curve?: number;
  tilt?: number;
  blur?: number;
  fade?: number;
  minOpacity?: number;
  smoothing?: number;
  inset?: number;
  loop?: boolean;
  draggable?: boolean;
  soundUrl?: string;
  soundVolume?: number;
  className?: string;
}

interface WheelConfig {
  count: number;
  items: string[];
  rowH: number;
  curve: number;
  tilt: number;
  blur: number;
  fade: number;
  minOpacity: number;
  side: Side;
  loop: boolean;
  smoothing: number;
  draggable: boolean;
  soundUrl: string;
  soundVolume: number;
}

const DEFAULT_ITEMS = [
  'Ambient',
  'House',
  'Techno',
  'Jazz',
  'Lo-Fi',
  'Synthwave',
  'Trance',
  'Funk',
  'Disco',
  'Hip-Hop',
  'Chillwave',
  'Drum & Bass'
];

const OptionWheel = ({
  items = DEFAULT_ITEMS,
  defaultSelected = 3,
  onChange,
  textColor = '#a6a6a6',
  activeColor = '#ffffff',
  side = 'left',
  fontSize = 3,
  spacing = 1.4,
  curve = 1,
  tilt = 6,
  blur = 2,
  fade = 0.25,
  minOpacity = 0.05,
  smoothing = 200,
  inset = 80,
  loop = false,
  draggable = true,
  soundUrl = '',
  soundVolume = 0.5,
  className = ''
}: OptionWheelProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef(defaultSelected);
  const targetRef = useRef(defaultSelected);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const cfgRef = useRef<WheelConfig>({} as WheelConfig);
  const onChangeRef = useRef(onChange);
  const selectedRef = useRef(defaultSelected);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ y: number; start: number; id: number } | null>(null);
  const dragMovedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef('');
  const lastTickRef = useRef(0);
  const [selectedIndex, setSelectedIndex] = useState(defaultSelected);
  const [isDragging, setIsDragging] = useState(false);

  const remPx = typeof window !== 'undefined' ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16 : 16;

  onChangeRef.current = onChange;
  cfgRef.current = {
    count: items.length,
    items,
    rowH: Math.max(fontSize * spacing * remPx, 1),
    curve,
    tilt,
    blur,
    fade,
    minOpacity,
    side,
    loop,
    smoothing,
    draggable,
    soundUrl,
    soundVolume
  };

  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const cfg = cfgRef.current;
    const tau = Math.max(cfg.smoothing, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    const target = targetRef.current;
    const cur = posRef.current;
    let next = cur + (target - cur) * k;
    const settled = Math.abs(target - next) < 0.001;
    if (settled) next = target;
    posRef.current = next;

    const els = itemRefs.current;
    const n = cfg.count;
    const mirror = cfg.side === 'right' ? -1 : 1;
    const tiltRad = (cfg.tilt * Math.PI) / 180;
    const R = tiltRad > 0.0005 ? cfg.rowH / tiltRad : 0;
    for (let i = 0; i < n; i++) {
      const el = els[i];
      if (!el) continue;
      let d = i - next;
      if (cfg.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }
      const dist = Math.abs(d);
      let x = 0;
      let y = d * cfg.rowH;
      let rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        y = R * Math.sin(ang);
        x = -mirror * R * (1 - Math.cos(ang)) * cfg.curve;
        rot = (mirror * ang * 180) / Math.PI;
      }
      el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
      el.style.opacity = String(Math.max(cfg.minOpacity, 1 - dist * cfg.fade));
      el.style.filter = cfg.blur > 0 ? `blur(${(dist * cfg.blur).toFixed(2)}px)` : 'none';
      el.style.setProperty('--ow-p', Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
    }

    rafRef.current = settled ? null : requestAnimationFrame(runFrame);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const playTick = useCallback(() => {
    const { soundUrl, soundVolume } = cfgRef.current;
    if (!soundUrl) return;
    const now = performance.now();
    if (now - lastTickRef.current < 70) return;
    lastTickRef.current = now;
    if (!audioRef.current || audioUrlRef.current !== soundUrl) {
      audioRef.current = new Audio(soundUrl);
      audioRef.current.preload = 'auto';
      audioUrlRef.current = soundUrl;
    }
    const audio = audioRef.current;
    audio.volume = Math.min(Math.max(soundVolume, 0), 1);
    audio.currentTime = 0;
    audio.play()?.catch(() => { });
  }, []);

  const applyTarget = useCallback(
    (value: number, snap: boolean) => {
      const cfg = cfgRef.current;
      let v = value;
      if (!cfg.loop) v = Math.min(Math.max(v, 0), Math.max(cfg.count - 1, 0));
      if (snap) v = Math.round(v);
      targetRef.current = v;
      const idx = ((Math.round(v) % cfg.count) + cfg.count) % cfg.count;
      if (idx !== selectedRef.current) {
        selectedRef.current = idx;
        setSelectedIndex(idx);
        onChangeRef.current?.(idx, cfg.items[idx]);
        playTick();
      }
      startLoop();
    },
    [startLoop, playTick]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cfg = cfgRef.current;
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
      const step = Math.max(-1, Math.min(1, delta / cfg.rowH));
      applyTarget(targetRef.current + step, false);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => applyTarget(targetRef.current, true), 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [applyTarget]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!cfgRef.current.draggable) return;
    dragRef.current = { y: e.clientY, start: targetRef.current, id: e.pointerId };
    dragMovedRef.current = false;
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (!dragMovedRef.current && Math.abs(dy) > 4) {
        dragMovedRef.current = true;
        rootRef.current?.setPointerCapture(drag.id);
      }
      if (dragMovedRef.current) applyTarget(drag.start - dy / cfgRef.current.rowH, false);
    },
    [applyTarget]
  );

  const handlePointerEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    if (dragMovedRef.current) applyTarget(targetRef.current, true);
  }, [applyTarget]);

  const handleItemClick = useCallback(
    (index: number) => {
      if (dragMovedRef.current) return;
      const cfg = cfgRef.current;
      const cur = targetRef.current;
      let d = index - (((cur % cfg.count) + cfg.count) % cfg.count);
      if (cfg.loop && cfg.count > 1) {
        if (d > cfg.count / 2) d -= cfg.count;
        else if (d < -cfg.count / 2) d += cfg.count;
      }
      applyTarget(cur + d, true);
    },
    [applyTarget]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let delta: number | null = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1;
      if (delta == null) return;
      e.preventDefault();
      applyTarget(Math.round(targetRef.current) + delta, true);
    },
    [applyTarget]
  );

  useEffect(() => {
    applyTarget(targetRef.current, false);
  }, [items, fontSize, spacing, curve, tilt, blur, fade, minOpacity, side, loop, smoothing, applyTarget]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      audioRef.current?.pause();
    },
    []
  );

  return (
    <div
      ref={rootRef}
      role="listbox"
      tabIndex={0}
      aria-label="Option wheel"
      className={`option-wheel${side === 'right' ? ' option-wheel--right' : ''}${isDragging ? ' option-wheel--dragging' : ''}${className ? ` ${className}` : ''}`}
      style={
        {
          '--ow-text-color': textColor,
          '--ow-active-color': activeColor,
          '--ow-font-size': `${fontSize}rem`,
          '--ow-inset': `${inset}px`
        } as CSSProperties
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      {items.map((label, index) => (
        <div
          key={`${label}-${index}`}
          ref={el => {
            itemRefs.current[index] = el;
          }}
          role="option"
          aria-selected={selectedIndex === index}
          className={`option-wheel__item${selectedIndex === index ? ' option-wheel__item--selected' : ''}`}
          onClick={() => handleItemClick(index)}
        >
          {label}
        </div>
      ))}
    </div>
  );
};

const DEVELOPERS = [
{
    name: "Deep Mistry",
    image: deepIdPng,
    college: "Shah & Anchor Kutchhi Engineering College",
    department: "Artificial Intelligence & Data Science",
    degree: "B.Tech (4th Year)",
    gradYear: "Class of 2027",
    linkedin: "https://www.linkedin.com/in/deepmistry2806",
    github: "https://github.com/DeepMistry17",
    email: "deepmistry1705@gmail.com",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Deep"
  },
  {
    name: "Kush Gohel",
    image: kushIdPng,
    college: "Shah & Anchor Kutchhi Engineering College",
    department: "Artificial Intelligence & Data Science",
    degree: "B.Tech (4th Year)",
    gradYear: "Class of 2027",
    linkedin: "https://www.linkedin.com/in/kushgohel/",
    github: "https://github.com/kush17746",
    email: "kushgohel811@gmail.com",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kush"
  },
  {
    name: "Hetvi Joshi",
    image: hetviIdPng,
    college: "Shah & Anchor Kutchhi Engineering College",
    department: "Computer Engineering",
    degree: "B.Tech (4th Year)",
    gradYear: "Class of 2027",
    linkedin: " https://www.linkedin.com/in/hetvijoshi17/",
    github: "https://github.com/hetvijoshi2005",
    email: "hetvijoshi1728@gmaill.com",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hetvi"
  },
  {
    name: "Prami Shah",
    image: pramiIdPng,
    college: "Shah & Anchor Kutchhi Engineering College",
    department: "Artificial Intelligence & Data Science",
    degree: "B.Tech (4th Year)",
    gradYear: "Class of 2027",
    linkedin: "https://www.linkedin.com/in/prami-shah-186070287/",
    github: "https://github.com/PramiShah",
    email: "pramishah16@gmail.com",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Prami"
  }
];

const DEVELOPER_NAMES = DEVELOPERS.map(dev => dev.name);

/* ----------------------------------------------------------------
   Lanyard (merged from React Bits Lanyard component)
   ---------------------------------------------------------------- */

const BLANK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Adjusted UV bounds to account for the 3D model's beveled edges
const FRONT_UV_RECT = { x: 0, y: 0, w: 0.5, h: 0.756 }; 
const BACK_UV_RECT = { x: 0.5, y: 0, w: 0.5, h: 0.758 };

interface LanyardProps {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
  frontImage?: string | null;
  backImage?: string | null;
  imageFit?: 'cover' | 'contain' | 'fill';
  lanyardImage?: string | null;
  lanyardWidth?: number;
}

function LanyardComponent({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
  frontImage = null,
  backImage = null,
  imageFit = 'cover',
  lanyardImage = null,
  lanyardWidth = 1
}: LanyardProps) {
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = (): void => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="lanyard-wrapper">
      <Canvas
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <LanyardBand
            isMobile={isMobile}
            frontImage={frontImage}
            backImage={backImage}
            imageFit={imageFit}
            lanyardImage={lanyardImage}
            lanyardWidth={lanyardWidth}
          />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

interface LanyardBandProps {
  maxSpeed?: number;
  minSpeed?: number;
  isMobile?: boolean;
  frontImage?: string | null;
  backImage?: string | null;
  imageFit?: 'cover' | 'contain' | 'fill';
  lanyardImage?: string | null;
  lanyardWidth?: number;
}

type LanyardRigidBody = RapierRigidBody & {
  lerped?: THREE.Vector3;
};

function LanyardBand({
  maxSpeed = 50,
  minSpeed = 0,
  isMobile = false,
  frontImage = null,
  backImage = null,
  imageFit = 'cover',
  lanyardImage = null,
  lanyardWidth = 1
}: LanyardBandProps) {
  const band = useRef<THREE.Mesh<InstanceType<typeof MeshLineGeometry>, InstanceType<typeof MeshLineMaterial>>>(null!);
  const fixed = useRef<RapierRigidBody>(null!);
  const j1 = useRef<LanyardRigidBody>(null!);
  const j2 = useRef<LanyardRigidBody>(null!);
  const j3 = useRef<RapierRigidBody>(null!);
  const card = useRef<RapierRigidBody>(null!);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const segmentProps: RigidBodyProps = {
    type: 'dynamic',
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4
  };

  const anchorX = 0;

  const getLerped = (body: LanyardRigidBody): THREE.Vector3 => {
    if (!body.lerped) {
      body.lerped = new THREE.Vector3().copy(body.translation());
    }
    return body.lerped;
  };

  const { nodes, materials } = useGLTF(cardGLB) as any;
  const texture = useTexture(lanyardImage || lanyardPng);
  const frontTex = useTexture(frontImage || BLANK_PIXEL);
  const backTex = useTexture(backImage || BLANK_PIXEL);

  const cardMap = useMemo(() => {
    const baseMap = materials.base.map as THREE.Texture;
    if (!frontImage && !backImage) return baseMap;

    const baseImg = baseMap.image as any;
    const W = baseImg.width;
    const H = baseImg.height;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return baseMap;
    ctx.drawImage(baseImg, 0, 0, W, H);

    const drawFitted = (img: any, rect: typeof FRONT_UV_RECT) => {
      const rx = rect.x * W;
      const ry = rect.y * H;
      const rw = rect.w * W;
      const rh = rect.h * H;

      let dw = rw;
      let dh = rh;
      let dx = rx;
      let dy = ry;

      if (imageFit !== 'fill') {
        const pick = imageFit === 'contain' ? Math.min : Math.max;
        const scale = pick(rw / img.width, rh / img.height);
        dw = img.width * scale;
        dh = img.height * scale;
        dx = rx + (rw - dw) / 2;
        dy = ry + (rh - dh) / 2;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    };

    if (frontImage && frontTex.image) drawFitted(frontTex.image, FRONT_UV_RECT);
    if (backImage && backTex.image) drawFitted(backTex.image, BACK_UV_RECT);

    const composite = new THREE.CanvasTexture(canvas);
    composite.colorSpace = THREE.SRGBColorSpace;
    composite.flipY = baseMap.flipY;
    composite.anisotropy = 16;
    composite.needsUpdate = true;
    return composite;
  }, [frontImage, backImage, imageFit, frontTex, backTex, materials.base.map]);
  
  // NEW: Force the strap texture to slide down towards the hook (Type-Safe Version)
  const shiftedStrapTexture = useMemo(() => {
    if (!texture.image) return texture;
    
    // Explicitly tell TypeScript this is an image element
    const img = texture.image as HTMLImageElement; 
    
    const canvas = document.createElement('canvas');
    const w = img.width;
    const h = img.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return texture;

    // Adjust this decimal to slide the text (e.g., 0.2, 0.4, 0.6)
    const shiftOffset = 0.2; 
    const shiftPx = w * shiftOffset;

    // Use the strongly-typed 'img' variable here
    ctx.drawImage(img, shiftPx, 0, w, h);
    ctx.drawImage(img, shiftPx - w, 0, w, h);

    const newTex = new THREE.CanvasTexture(canvas);
    newTex.wrapS = newTex.wrapT = THREE.RepeatWrapping;
    newTex.colorSpace = THREE.SRGBColorSpace;
    newTex.anisotropy = 16;
    return newTex;
  }, [texture]);

  const [curve] = useState(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
  );
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.45, 0]
  ]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => { document.body.style.cursor = 'auto'; };
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && typeof dragged !== 'boolean') {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach(ref => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z
      });
    }
    if (fixed.current) {
      [j1, j2].forEach(ref => {
        const lerped = getLerped(ref.current);
        const clampedDistance = Math.max(0.1, Math.min(1, lerped.distanceTo(ref.current.translation())));
        lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)));
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(getLerped(j2.current));
      curve.points[2].copy(getLerped(j1.current));
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, true);
    }
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  
  return (
    <>
      <group position={[anchorX, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0.866]} ref={j1} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.0, 0, 1.732]} ref={j2} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 2.598]} ref={j3} {...segmentProps} type="dynamic">
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, -1.45, 2.598]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e: ThreeEvent<PointerEvent>) => {
              (e.target as Element).releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())));
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={cardMap}
                map-anisotropy={16}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.8}
              />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={shiftedStrapTexture} /* <-- Replace 'texture' with 'shiftedStrapTexture' */
          repeat={[-1.4, 1]}
          lineWidth={lanyardWidth}
        />
      </mesh>
    </>
  );
}

interface ElectricBorderProps {
  children?: ReactNode;
  color?: string;
  speed?: number;
  chaos?: number;
  borderRadius?: number;
  className?: string;
  style?: CSSProperties;
}

const ElectricBorder: React.FC<ElectricBorderProps> = ({
  children,
  color = '#fafafaff',
  speed = 1,
  chaos = 0.12,
  borderRadius = 24,
  className,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const random = useCallback((x: number): number => {
    return (Math.sin(x * 12.9898) * 43758.5453) % 1;
  }, []);

  const noise2D = useCallback(
    (x: number, y: number): number => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;

      const a = random(i + j * 57);
      const b = random(i + 1 + j * 57);
      const c = random(i + (j + 1) * 57);
      const d = random(i + 1 + (j + 1) * 57);

      const ux = fx * fx * (3.0 - 2.0 * fx);
      const uy = fy * fy * (3.0 - 2.0 * fy);

      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    },
    [random]
  );

  const octavedNoise = useCallback(
    (
      x: number,
      octaves: number,
      lacunarity: number,
      gain: number,
      baseAmplitude: number,
      baseFrequency: number,
      time: number,
      seed: number,
      baseFlatness: number
    ): number => {
      let y = 0;
      let amplitude = baseAmplitude;
      let frequency = baseFrequency;

      for (let i = 0; i < octaves; i++) {
        let octaveAmplitude = amplitude;
        if (i === 0) {
          octaveAmplitude *= baseFlatness;
        }
        y += octaveAmplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
        frequency *= lacunarity;
        amplitude *= gain;
      }

      return y;
    },
    [noise2D]
  );

  const getCornerPoint = useCallback(
    (
      centerX: number,
      centerY: number,
      radius: number,
      startAngle: number,
      arcLength: number,
      progress: number
    ): { x: number; y: number } => {
      const angle = startAngle + progress * arcLength;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    },
    []
  );

  const getRoundedRectPoint = useCallback(
    (t: number, left: number, top: number, width: number, height: number, radius: number): { x: number; y: number } => {
      const straightWidth = width - 2 * radius;
      const straightHeight = height - 2 * radius;
      const cornerArc = (Math.PI * radius) / 2;
      const totalPerimeter = 2 * straightWidth + 2 * straightHeight + 4 * cornerArc;
      const distance = t * totalPerimeter;

      let accumulated = 0;

      if (distance <= accumulated + straightWidth) {
        const progress = (distance - accumulated) / straightWidth;
        return { x: left + radius + progress * straightWidth, y: top };
      }
      accumulated += straightWidth;

      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        return getCornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, progress);
      }
      accumulated += cornerArc;

      if (distance <= accumulated + straightHeight) {
        const progress = (distance - accumulated) / straightHeight;
        return { x: left + width, y: top + radius + progress * straightHeight };
      }
      accumulated += straightHeight;

      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        return getCornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, progress);
      }
      accumulated += cornerArc;

      if (distance <= accumulated + straightWidth) {
        const progress = (distance - accumulated) / straightWidth;
        return { x: left + width - radius - progress * straightWidth, y: top + height };
      }
      accumulated += straightWidth;

      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        return getCornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, progress);
      }
      accumulated += cornerArc;

      if (distance <= accumulated + straightHeight) {
        const progress = (distance - accumulated) / straightHeight;
        return { x: left, y: top + height - radius - progress * straightHeight };
      }
      accumulated += straightHeight;

      const progress = (distance - accumulated) / cornerArc;
      return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, progress);
    },
    [getCornerPoint]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const octaves = 10;
    const lacunarity = 1.6;
    const gain = 0.7;
    const amplitude = chaos;
    const frequency = 10;
    const baseFlatness = 0;
    const displacement = 60;
    const borderOffset = 60;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width + borderOffset * 2;
      const height = rect.height + borderOffset * 2;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      return { width, height };
    };

    let { width, height } = updateSize();
    let lastDpr = Math.min(window.devicePixelRatio || 1, 2);

    const drawElectricBorder = (currentTime: number) => {
      if (!canvas || !ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (dpr !== lastDpr) {
        lastDpr = dpr;
        const newSize = updateSize();
        width = newSize.width;
        height = newSize.height;
      }

      const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000;
      timeRef.current += deltaTime * speed;
      lastFrameTimeRef.current = currentTime;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const scale = displacement;
      const left = borderOffset;
      const top = borderOffset;
      const borderWidth = width - 2 * borderOffset;
      const borderHeight = height - 2 * borderOffset;
      const maxRadius = Math.min(borderWidth, borderHeight) / 2;
      const radius = Math.min(borderRadius, maxRadius);

      const approximatePerimeter = 2 * (borderWidth + borderHeight) + 2 * Math.PI * radius;
      const sampleCount = Math.floor(approximatePerimeter / 2);

      ctx.beginPath();

      for (let i = 0; i <= sampleCount; i++) {
        const progress = i / sampleCount;

        const point = getRoundedRectPoint(progress, left, top, borderWidth, borderHeight, radius);

        const xNoise = octavedNoise(
          progress * 8,
          octaves,
          lacunarity,
          gain,
          amplitude,
          frequency,
          timeRef.current,
          0,
          baseFlatness
        );
        const yNoise = octavedNoise(
          progress * 8,
          octaves,
          lacunarity,
          gain,
          amplitude,
          frequency,
          timeRef.current,
          1,
          baseFlatness
        );

        const displacedX = point.x + xNoise * scale;
        const displacedY = point.y + yNoise * scale;

        if (i === 0) {
          ctx.moveTo(displacedX, displacedY);
        } else {
          ctx.lineTo(displacedX, displacedY);
        }
      }

      ctx.closePath();
      ctx.stroke();

      animationRef.current = requestAnimationFrame(drawElectricBorder);
    };

    const resizeObserver = new ResizeObserver(() => {
      const newSize = updateSize();
      width = newSize.width;
      height = newSize.height;
    });
    resizeObserver.observe(container);

    animationRef.current = requestAnimationFrame(drawElectricBorder);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [color, speed, chaos, borderRadius, octavedNoise, getRoundedRectPoint]);

  const vars = {
    '--electric-border-color': color,
    borderRadius
  } as CSSProperties;

  return (
    <div ref={containerRef} className={`electric-border ${className ?? ''}`} style={{ ...vars, ...style }}>
      <div className="eb-canvas-container">
        <canvas ref={canvasRef} className="eb-canvas" />
      </div>
      <div className="eb-layers">
        <div className="eb-glow-1" />
        <div className="eb-glow-2" />
        <div className="eb-background-glow" />
      </div>
      <div className="eb-content">{children}</div>
    </div>
  );
};

function SupportPage({ onBack }: { onBack: () => void }) {
  const initialDev = 0; 
  const [selectedDev, setSelectedDev] = useState(initialDev);
  const [lanyardKey, setLanyardKey] = useState(0);

  const handleDevChange = useCallback((index: number, _item: string) => {
    setSelectedDev(index);
    // Remount lanyard with a new key to trigger entrance animation
    setLanyardKey(prev => prev + 1);
  }, []);

  return (
    <div className="h-screen flex flex-col relative z-10 overflow-hidden">
      {/* Inside the SupportPage function */}
      <div className="absolute inset-0 z-0 pointer-events-auto lanyard-animate-in" key={lanyardKey}>
      <LanyardComponent
        position={[0, 0, 13]}
        gravity={[0, -40, 0]}
        lanyardImage={lanyardMarkifySvg}
        frontImage={DEVELOPERS[selectedDev].image}
        backImage={lanyardPng} /* <-- Maps your lanyard.png to the back of the card */
        imageFit="fill"       /* <-- Change this back from "cover" to "fill" */
      />
    </div>

      {/* Header */}
      <div className="px-5 sm:px-6 md:px-12 lg:px-16 py-6 flex justify-between items-center border-b border-white/5 pointer-events-auto flex-shrink-0 relative z-10">
        <MarkifyLogo />
        <div className="flex gap-4 items-center">
          <SpecularButton
            as="a"
            href="https://mail.google.com/mail/?view=cm&fs=1&to=markify@sakec.ac.in&su=Markify%20Admin%20Support"
            target="_blank"
            rel="noreferrer"
            size="sm"
            radius={999}
            blur={4}
            className="liquid-glass hover:bg-white/10 transition-colors"
          >
            Contact Admin
          </SpecularButton>
          <SpecularButton
            as="button"
            onClick={onBack}
            size="sm"
            radius={999}
            blur={4}
            className="liquid-glass hover:bg-white/10 transition-colors"
          >
            Back to Home
          </SpecularButton>
        </div>
      </div>

      {/* Main content: 3-column layout */}
      <div className="flex-1 w-full min-h-0 pointer-events-none flex flex-col md:flex-row relative z-10">
        {/* Left side: OptionWheel */}
        <div className="w-full md:w-1/3 min-h-0 relative pointer-events-auto">
          <OptionWheel
            items={DEVELOPER_NAMES}
            defaultSelected={initialDev}
            textColor="#a6a6a6"
            activeColor="#ffffff"
            side="left"
            fontSize={5}
            spacing={1.6}
            curve={1}
            tilt={6}
            blur={6}
            fade={0.5}
            smoothing={200}
            inset={120}
            loop={true}
            draggable
            onChange={handleDevChange}
          />
        </div>

        {/* Middle side: Transparent gap so Lanyard events pass through */}
        <div className="w-full md:w-1/3 min-h-0 relative pointer-events-none" />

        {/* Right side: Developer Profile Card */}
        <div className="w-full md:w-1/3 min-h-0 relative pointer-events-auto flex items-center justify-center p-6">
          <ElectricBorder
            className="w-full max-w-sm animate-in fade-in zoom-in duration-500"
            color="#ffffff"
            speed={0.5}
            chaos={0.06}
            borderRadius={24}
            key={selectedDev}
          >
            <div className="w-full p-8 flex flex-col items-center text-center gap-6 rounded-[24px] glass-panel">
              {/* Name & Title */}
              <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight text-white">{DEVELOPERS[selectedDev].name}</h2>
                <span className="text-sm font-medium text-blue-400 uppercase tracking-widest">Core Developer</span>
              </div>

              <div className="w-full h-px bg-white/10" />

              {/* Academic Info */}
              <div className="flex flex-col gap-3 w-full text-left">
                <div className="flex items-start gap-3 text-white/70">
                  <Building2 className="w-5 h-5 shrink-0 text-white/50" />
                  <span className="text-sm leading-tight">{DEVELOPERS[selectedDev].college}</span>
                </div>
                <div className="flex items-start gap-3 text-white/70">
                  <GraduationCap className="w-5 h-5 shrink-0 text-white/50" />
                  <span className="text-sm leading-tight">{DEVELOPERS[selectedDev].department}</span>
                </div>
                <div className="flex items-start gap-3 text-white/70">
                  <BookOpen className="w-5 h-5 shrink-0 text-white/50" />
                  <span className="text-sm leading-tight">{DEVELOPERS[selectedDev].degree}</span>
                </div>
                <div className="flex items-start gap-3 text-white/70">
                  <Calendar className="w-5 h-5 shrink-0 text-white/50" />
                  <span className="text-sm leading-tight">{DEVELOPERS[selectedDev].gradYear}</span>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />
              
              
              

              {/* Social Links */}
              <div className="flex gap-4">
                <a href={DEVELOPERS[selectedDev].github} target="_blank" rel="noreferrer" className="w-11 h-11 flex items-center justify-center shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                 {/* Official Solid GitHub Logo */}
                 <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="w-5 h-5">
                   <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                 </svg>
                </a>
                <a href={DEVELOPERS[selectedDev].linkedin} target="_blank" rel="noreferrer" className="w-11 h-11 flex items-center justify-center shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                    <rect x="2" y="9" width="4" height="12"></rect>
                    <circle cx="4" cy="4" r="2"></circle>
                  </svg>
                </a>
                {/* Developer Mail Icon */}
                <a 
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${DEVELOPERS[selectedDev].email}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-11 h-11 flex items-center justify-center shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors border-none outline-none"
                >
                  <Mail className="w-5 h-5" />
                </a>
              </div>
              
              
              
              
              
            </div>
          </ElectricBorder>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   App (merged from App.jsx) — root component
   ---------------------------------------------------------------- */

const navItems: NavItem[] = [
  { label: 'Features', href: '#features', index: 1 },
  { label: 'Workflow', href: '#how-it-works', index: 2 },
  { label: 'Architecture', href: '#architecture', index: 3 },
  { label: 'Security', href: '#security', index: 4 },
]

export const LandingPage = () => {
  useFullPageScroll()

  const [activeIndex, setActiveIndex] = useState(0)
  const [showNav, setShowNav] = useState(false)
  const [currentPage, setCurrentPage] = useState<'home' | 'support'>('home')
  
  useEffect(() => {
    /* 1. Force manual scroll restoration so the browser doesn't jump down */
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    /* 2. Scroll to top immediately */
    window.scrollTo(0, 0);
    
    /* 3. Strip any #hash from the URL cleanly */
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    /* Your existing scrollbar hide logic */
    document.documentElement.classList.add('hide-scrollbar');
    return () => {
      document.documentElement.classList.remove('hide-scrollbar');
    };
  }, []);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const vh = window.innerHeight

      // Show floating nav after scrolling past half of hero section
      setShowNav(scrollY > vh / 2)

      // Find closest section
      const elements = Array.from(document.querySelectorAll('section, footer'))
      if (!elements.length) return

      let closestIndex = 0
      let minDiff = Infinity
      elements.forEach((el, i) => {
        const diff = Math.abs((el as HTMLElement).offsetTop - scrollY)
        if (diff < minDiff) {
          minDiff = diff
          closestIndex = i
        }
      })

      // Map DOM index to Navbar index (DOM index 1 is Navbar index 0)
      setActiveIndex(Math.max(0, closestIndex - 1))
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNavItemClick = (item: NavItem) => {
    const elements = Array.from(document.querySelectorAll('section, footer'))
    if (elements[item.index]) {
      window.scrollTo({
        top: (elements[item.index] as HTMLElement).offsetTop,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="landing-root">
      {/* Floating Navbar */}
      <div
        className={`fixed top-4 sm:top-5 inset-x-0 w-full flex justify-center z-[100] transition-all duration-500 pointer-events-none ${
          showNav ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
        }`}
      >
        <div className="pointer-events-auto">
          <SpotlightNavbar
            items={navItems}
            activeIndex={activeIndex}
            onItemClick={handleNavItemClick}
            className="pt-0"
          />
        </div>
      </div>

      {/* Dynamic background based on page */}
      <div className="fixed inset-0 z-0" style={{ background: '#080604' }}>
        {currentPage === 'home' ? (
          <>
            <WebThreads
              color1="#16171a"
              color2="#4d4b4b"
              color3="#94a3b8"
              speed={0.35}
              threadCount={4}
              frequency={3.5}
              spread={0.18}
              taper={2.8}
              position={0.51}
              fanMode="center"
              glow={0.03}
              falloff={0.6}
              thickness={0.9}
              brightness={1}
              opacity={1.0}
              mirror={false}
              shimmer={false}
              grain={false}
              grainIntensity={0}
              mouseInteraction={true}
              mouseStrength={0.2}
            />
            {/* Dark gradient overlay to tone down the animation brightness */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/30 to-black/80 pointer-events-none" />
          </>
        ) : (
          <LightRays
            raysOrigin="top-center"
            raysColor="#ffffff"
            raysSpeed={1.5}
            lightSpread={0.8}
            rayLength={1.2}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0.1}
            distortion={0.05}
          />
        )}
      </div>

      {currentPage === 'support' ? (
        <SupportPage onBack={() => setCurrentPage('home')} />
      ) : (
        <>
          <Navbar onSupportClick={() => setCurrentPage('support')} />
          <main className="relative z-[1]">
            <HeroSection />
            <FeaturesSection />
            <HowItWorksSection />
            <ArchitectureSection />
            <SecuritySection />
          </main>
          <Footer />
        </>
      )}
    </div>
  )
}

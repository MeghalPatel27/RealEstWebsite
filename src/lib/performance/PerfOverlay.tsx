import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { perf } from './dev'
import type { PerfSnapshot } from './types'

const ROWS: Array<{ label: string; key: keyof PerfSnapshot | string; format?: (s: PerfSnapshot) => string }> = [
  { label: 'FPS', key: 'fps', format: (s) => `${s.fps.current.toFixed(0)} (avg ${s.fps.average.toFixed(0)}, min ${s.fps.min.toFixed(0)}, max ${s.fps.max.toFixed(0)})` },
  { label: 'Frame Time', key: 'frame', format: (s) => `${s.frame.frameTimeMs.toFixed(1)} ms` },
  { label: 'Dropped Frames', key: 'frame', format: (s) => String(s.frame.droppedFrames) },
  { label: 'Long Tasks', key: 'system', format: (s) => String(s.system.longTaskCount) },
  { label: 'React Renders', key: 'reactRenderCount', format: (s) => String(s.reactRenderCount) },
  { label: 'Video Time', key: 'video', format: (s) => `${s.video.currentTime.toFixed(2)}s` },
  { label: 'Video Target', key: 'video', format: (s) => `${s.video.targetTime.toFixed(2)}s` },
  { label: 'Seek Count', key: 'video', format: (s) => String(s.video.seekCount) },
  { label: 'Seek Latency', key: 'video', format: (s) => `last ${s.video.lastSeekLatencyMs.toFixed(1)}ms · avg ${s.video.avgSeekLatencyMs.toFixed(1)}ms` },
  { label: 'Playback Rate', key: 'video', format: (s) => `${s.video.playbackRate.toFixed(2)}×` },
  { label: 'Resolution', key: 'video', format: (s) => s.video.resolution || '—' },
  { label: 'Video Source', key: 'video', format: (s) => s.video.source.split('/').pop() ?? '—' },
  { label: 'ReadyState', key: 'video', format: (s) => String(s.video.readyState) },
  { label: 'Buffered', key: 'video', format: (s) => `${s.video.bufferedPercent.toFixed(0)}%` },
  { label: 'Decode Health', key: 'video', format: (s) => s.video.decodeHealth },
  { label: 'Sync Mode', key: 'video', format: (s) => s.video.syncMode },
  { label: 'Scroll Progress', key: 'scroll', format: (s) => s.scroll.scrollProgress.toFixed(4) },
  { label: 'Film Progress', key: 'scroll', format: (s) => s.scroll.filmProgress.toFixed(4) },
  { label: 'Active Section', key: 'scroll', format: (s) => s.scroll.activeSection },
  { label: 'Lenis Velocity', key: 'scroll', format: (s) => s.scroll.lenisVelocity.toFixed(3) },
  { label: 'Lenis Direction', key: 'scroll', format: (s) => String(s.scroll.lenisDirection) },
  { label: 'Scroll Speed', key: 'scroll', format: (s) => `${(s.scroll.scrollSpeed * 1000).toFixed(4)}/s` },
  { label: 'RAF Duration', key: 'frame', format: (s) => `${s.frame.rafDurationMs.toFixed(2)} ms` },
  { label: 'GSAP Tick', key: 'frame', format: (s) => `${s.frame.gsapTickMs.toFixed(2)} ms` },
  { label: 'JS Frame Cost', key: 'frame', format: (s) => `${s.frame.jsFrameCostMs.toFixed(2)} ms` },
  { label: 'Style Recalc (est.)', key: 'pipeline', format: (s) => `${s.pipeline.styleRecalcMs.toFixed(2)} ms` },
  { label: 'Layout (est.)', key: 'pipeline', format: (s) => `${s.pipeline.layoutMs.toFixed(2)} ms` },
  { label: 'Paint (est.)', key: 'pipeline', format: (s) => `${s.pipeline.paintMs.toFixed(2)} ms` },
  { label: 'Composite (est.)', key: 'pipeline', format: (s) => `${s.pipeline.compositeMs.toFixed(2)} ms` },
  { label: 'Memory', key: 'system', format: (s) => `${s.system.memoryMb.toFixed(1)} MB` },
  { label: 'JS Heap', key: 'system', format: (s) => `${s.system.jsHeapMb.toFixed(1)} MB` },
  { label: 'Heap Growth', key: 'system', format: (s) => `${s.system.heapGrowthMb >= 0 ? '+' : ''}${s.system.heapGrowthMb.toFixed(1)} MB` },
  { label: 'Listeners (est.)', key: 'system', format: (s) => (s.system.listenerCountEstimate < 0 ? 'use DevTools' : String(s.system.listenerCountEstimate)) },
  { label: 'GSAP Animations', key: 'system', format: (s) => String(s.system.activeAnimationCount) },
  { label: 'Active RAF', key: 'system', format: (s) => String(s.system.activeRafCount) },
  { label: 'Layers (est.)', key: 'system', format: (s) => String(s.system.layerCountEstimate) },
  { label: 'DPR', key: 'environment', format: (s) => String(s.environment.devicePixelRatio) },
  { label: 'Viewport', key: 'environment', format: (s) => s.environment.viewport },
  { label: 'Browser', key: 'environment', format: (s) => s.environment.browser },
  { label: 'GPU', key: 'environment', format: (s) => s.environment.gpuVendor },
  { label: 'Reduced Motion', key: 'environment', format: (s) => (s.environment.reducedMotion ? 'yes' : 'no') },
  { label: 'Touch', key: 'environment', format: (s) => (s.environment.touchDevice ? 'yes' : 'no') },
  { label: 'Battery Saver', key: 'environment', format: (s) => (s.environment.batterySaver ? 'yes' : 'no') },
  { label: 'Save-Data', key: 'environment', format: (s) => (s.environment.saveData ? 'yes' : 'no') },
  { label: 'Network', key: 'environment', format: (s) => s.environment.networkType },
  { label: 'Perf Mode', key: 'environment', format: (s) => s.environment.performanceMode.toUpperCase() },
]

function modeColor(mode: string): string {
  switch (mode) {
    case 'GOOD':
      return '#4ade80'
    case 'DEGRADED':
      return '#fbbf24'
    case 'CRITICAL':
      return '#f87171'
    default:
      return '#94a3b8'
  }
}

export function DevPerfOverlay() {
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [hidden, setHidden] = useState(false)
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [position, setPosition] = useState({ left: 12, top: 12 })

  useEffect(() => {
    if (!import.meta.env.DEV) return

    let rafId = 0
    let frame = 0

    const tick = () => {
      frame += 1
      if (frame % 2 === 0) {
        const snapshot = perf.getSnapshot()
        const body = bodyRef.current
        if (body && !collapsed) {
          const mode = snapshot.environment.performanceMode.toUpperCase()
          const header = body.querySelector<HTMLElement>('[data-perf-mode]')
          if (header) {
            header.textContent = mode
            header.style.color = modeColor(mode)
          }

          const rows = body.querySelectorAll<HTMLElement>('[data-perf-row]')
          rows.forEach((row, i) => {
            const spec = ROWS[i]
            if (!spec?.format) return
            const valueEl = row.querySelector<HTMLElement>('[data-perf-value]')
            if (valueEl) valueEl.textContent = spec.format(snapshot)
          })
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [collapsed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`' && e.shiftKey) setHidden((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    const panel = panelRef.current
    if (!panel) return
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: position.left,
      top: position.top,
    }
    panel.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    setPosition({
      left: Math.max(0, dragRef.current.left + dx),
      top: Math.max(0, dragRef.current.top + dy),
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    panelRef.current?.releasePointerCapture(e.pointerId)
  }

  if (!import.meta.env.DEV || hidden) return null

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        zIndex: 99999,
        width: collapsed ? 200 : 300,
        maxHeight: collapsed ? 'auto' : 'min(72vh, 640px)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 10,
        lineHeight: 1.35,
        color: '#e2e8f0',
        background: 'rgba(8, 10, 14, 0.92)',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          borderBottom: collapsed ? 'none' : '1px solid rgba(148,163,184,0.15)',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, letterSpacing: '0.08em', fontSize: 9, color: '#94a3b8' }}>
            PERF
          </span>
          <span data-perf-mode style={{ fontWeight: 700, fontSize: 9 }}>
            IDLE
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            onClick={() => setCollapsed((v) => !v)}
            style={btnStyle}
          >
            {collapsed ? '▢' : '—'}
          </button>
          <button
            type="button"
            aria-label="Hide panel (Shift+`)"
            onClick={() => setHidden(true)}
            style={btnStyle}
          >
            ×
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          ref={bodyRef}
          style={{
            padding: '6px 8px 8px',
            overflowY: 'auto',
            maxHeight: 'calc(min(72vh, 640px) - 40px)',
            pointerEvents: 'none',
          }}
        >
          {ROWS.map((row) => (
            <div
              key={row.label}
              data-perf-row
              style={{
                display: 'grid',
                gridTemplateColumns: '108px 1fr',
                gap: 6,
                padding: '2px 0',
                borderBottom: '1px solid rgba(148,163,184,0.06)',
              }}
            >
              <span style={{ color: '#64748b' }}>{row.label}</span>
              <span data-perf-value style={{ color: '#cbd5e1', wordBreak: 'break-all' }}>
                —
              </span>
            </div>
          ))}
          <p style={{ margin: '8px 2px 0', color: '#475569', fontSize: 9 }}>
            Shift+` toggle · window.__PERF__
          </p>
        </div>
      )}
    </div>
  )
}

const btnStyle: CSSProperties = {
  width: 22,
  height: 22,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 4,
  background: 'rgba(15,23,42,0.6)',
  color: '#cbd5e1',
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: 1,
  pointerEvents: 'auto',
}

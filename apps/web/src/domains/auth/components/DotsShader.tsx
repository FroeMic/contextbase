import { useEffect, useMemo, useRef } from "react"

export interface DotsShaderProps {
  colors?: number[][]
  dotSize?: number
  maxFps?: number
  opacities?: number[]
  totalSize?: number
}

const DEFAULT_SHADER_SOURCE = `
float intro_offset = distance(u_resolution / 2.0 / u_total_size, st2) * 0.01 + (random(st2) * 0.15);
opacity *= step(intro_offset, u_time);
opacity *= clamp((1.0 - step(intro_offset + 0.1, u_time)) * 1.25, 1.0, 1.25);
`

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    console.error("Failed to create shader")
    return null
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`Failed to compile shader: ${gl.getShaderInfoLog(shader)}`)
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function createBuffer(gl: WebGL2RenderingContext, arr: BufferSource) {
  const buffer = gl.createBuffer()
  const bufferType =
    arr instanceof Uint16Array || arr instanceof Uint32Array
      ? gl.ELEMENT_ARRAY_BUFFER
      : gl.ARRAY_BUFFER

  gl.bindBuffer(bufferType, buffer)
  gl.bufferData(bufferType, arr, gl.STATIC_DRAW)

  return buffer
}

export function DotsShader({
  colors = [[93, 227, 255]],
  dotSize = 1,
  maxFps = 30,
  opacities = [0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.8, 0.8, 0.8, 1],
  totalSize = 3,
}: DotsShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const fragmentSource = useMemo(
    () => `#version 300 es
precision mediump float;

in vec2 fragCoord;

uniform float u_time;
uniform float u_opacities[10];
uniform vec3 u_colors[6];
uniform float u_total_size;
uniform float u_dot_size;
uniform vec2 u_resolution;

out vec4 fragColor;

float PHI = 1.61803398874989484820459;

float random(vec2 xy) {
  return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
}

void main() {
  vec2 st = fragCoord.xy;
  st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
  st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

  float opacity = step(0.0, st.x);
  opacity *= step(0.0, st.y);

  vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

  float frequency = 5.0;
  float show_offset = random(st2);
  float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency) + 1.0);

  opacity *= u_opacities[int(rand * 10.0)];
  opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
  opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

  vec3 color = u_colors[int(show_offset * 6.0)];

  ${DEFAULT_SHADER_SOURCE}

  fragColor = vec4(color, opacity);
  fragColor.rgb *= fragColor.a;
}
`,
    [],
  )

  const uniforms = useMemo(() => {
    const normalizedColors =
      colors.length === 2
        ? [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]]
        : colors.length === 3
          ? [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]]
          : [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]]

    return {
      u_colors: normalizedColors.map((color) => [
        (color?.[0] ?? 255) / 255,
        (color?.[1] ?? 255) / 255,
        (color?.[2] ?? 255) / 255,
      ]),
      u_dot_size: dotSize,
      u_opacities: opacities,
      u_total_size: totalSize,
    }
  }, [colors, dotSize, opacities, totalSize])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const glCanvas = document.createElement("canvas")
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    const gl = glCanvas.getContext("webgl2")
    const ctx2d = canvas.getContext("2d")

    if (!gl || !ctx2d) return
    const canvasElement = canvas
    const glContext = gl
    const context2d = ctx2d

    const vertexShader = createShader(
      glContext,
      glContext.VERTEX_SHADER,
      `#version 300 es
precision mediump float;

in vec2 coordinates;

uniform vec2 u_resolution;

out vec2 fragCoord;

void main(void) {
  gl_Position = vec4(coordinates, 0.0, 1.0);
  fragCoord = (coordinates + 1.0) * 0.5 * u_resolution;
  fragCoord.y = u_resolution.y - fragCoord.y;
}
`,
    )
    const fragmentShader = createShader(glContext, glContext.FRAGMENT_SHADER, fragmentSource)

    if (!vertexShader || !fragmentShader) return

    const glProgram = glContext.createProgram()
    if (!glProgram) return

    glContext.attachShader(glProgram, vertexShader)
    glContext.attachShader(glProgram, fragmentShader)
    glContext.linkProgram(glProgram)

    if (!glContext.getProgramParameter(glProgram, glContext.LINK_STATUS)) {
      console.error(`Failed to compile WebGL program: ${glContext.getProgramInfoLog(glProgram)}`)
      return
    }

    // biome-ignore lint/correctness/useHookAtTopLevel: WebGLRenderingContext.useProgram is not a React hook.
    glContext.useProgram(glProgram)

    const positionsBuffer = createBuffer(glContext, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]))
    const coordinatesAttrLocation = glContext.getAttribLocation(glProgram, "coordinates")
    glContext.enableVertexAttribArray(coordinatesAttrLocation)
    glContext.vertexAttribPointer(coordinatesAttrLocation, 2, glContext.FLOAT, false, 0, 0)

    const resolutionAttrLocation = glContext.getUniformLocation(glProgram, "u_resolution")
    const timeAttrLocation = glContext.getUniformLocation(glProgram, "u_time")

    glContext.uniform3fv(
      glContext.getUniformLocation(glProgram, "u_colors"),
      uniforms.u_colors.flat(),
    )
    glContext.uniform1fv(
      glContext.getUniformLocation(glProgram, "u_opacities"),
      uniforms.u_opacities,
    )
    glContext.uniform1f(
      glContext.getUniformLocation(glProgram, "u_total_size"),
      uniforms.u_total_size,
    )
    glContext.uniform1f(glContext.getUniformLocation(glProgram, "u_dot_size"), uniforms.u_dot_size)

    glContext.enable(glContext.BLEND)
    glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE)
    glContext.disable(glContext.DEPTH_TEST)

    function resize() {
      const width = Math.max(1, canvasElement.offsetWidth)
      const height = Math.max(1, canvasElement.offsetHeight)

      canvasElement.width = width * dpr
      canvasElement.height = height * dpr
      glCanvas.width = width * dpr
      glCanvas.height = height * dpr
      glContext.uniform2f(resolutionAttrLocation, width, height)
    }

    let frame = 0
    let lastSecondPassed: number | null = null
    let lastFrameTime = 0

    function run(now: number) {
      const secondsPassed = now / 1000
      if (lastSecondPassed === null) lastSecondPassed = secondsPassed

      if (maxFps !== Infinity && now - lastFrameTime < 1000 / maxFps) {
        frame = window.requestAnimationFrame(run)
        return
      }

      lastFrameTime = now
      glContext.viewport(0, 0, glContext.canvas.width, glContext.canvas.height)
      glContext.uniform1f(timeAttrLocation, secondsPassed - lastSecondPassed)
      glContext.clear(glContext.COLOR_BUFFER_BIT | glContext.DEPTH_BUFFER_BIT)
      glContext.drawArrays(glContext.TRIANGLE_STRIP, 0, 4)
      context2d.clearRect(0, 0, canvasElement.width, canvasElement.height)
      context2d.drawImage(glCanvas, 0, 0)
      frame = window.requestAnimationFrame(run)
    }

    resize()
    frame = window.requestAnimationFrame(run)

    const resizeObserver = new window.ResizeObserver(resize)
    resizeObserver.observe(canvasElement)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      glContext.deleteShader(vertexShader)
      glContext.deleteShader(fragmentShader)
      glContext.deleteProgram(glProgram)
      glContext.deleteBuffer(positionsBuffer)
    }
  }, [fragmentSource, maxFps, uniforms])

  return <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
}

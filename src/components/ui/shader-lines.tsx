"use client"

import { useEffect, useRef, useState } from "react"

import * as THREE from 'three';

export function ShaderAnimation() {
  const [webglSupported, setWebglSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  });

  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    camera: THREE.Camera | null
    scene: THREE.Scene | null
    renderer: THREE.WebGLRenderer | null
    uniforms: any
    animationId: number | null
  }>({
    camera: null,
    scene: null,
    renderer: null,
    uniforms: null,
    animationId: null,
  })

  const initThreeJS = () => {
    if (!containerRef.current) return

    const container = containerRef.current
    container.innerHTML = ""

    try {
      const camera = new THREE.Camera()
      camera.position.z = 1

      const scene = new THREE.Scene()
      const geometry = new THREE.PlaneGeometry(2, 2)

      const uniforms = {
        time: { value: 1.0 },
        resolution: { value: new THREE.Vector2() },
      }

      // Vertex shader
      const vertexShader = `
        void main() {
          gl_Position = vec4( position, 1.0 );
        }
      `

      // Fragment shader
      const fragmentShader = `
        #define TWO_PI 6.2831853072
        #define PI 3.14159265359

        precision highp float;
        uniform vec2 resolution;
        uniform float time;
          
        float random (in float x) {
            return fract(sin(x)*1e4);
        }
        float random (vec2 st) {
            return fract(sin(dot(st.xy,
                                 vec2(12.9898,78.233)))*
                43758.5453123);
        }
        
        varying vec2 vUv;

        void main(void) {
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
          
          vec2 fMosaicScal = vec2(4.0, 2.0);
          vec2 vScreenSize = vec2(256,256);
          uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
          uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);       
          
          float t = time*0.06+random(uv.x)*0.4;
          float lineWidth = 0.0008;

          vec3 color = vec3(0.0);
          for(int j = 0; j < 3; j++){
            for(int i=0; i < 5; i++){
              color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*1.0 - length(uv));        
            }
          }

          gl_FragColor = vec4(color[2],color[1],color[0],1.0);
        }
      `

      // Create material
      const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
      })

      // Create mesh and add to scene
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

      // Initialize renderer (could fail if WebGL is disabled or unsupported)
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
      renderer.setPixelRatio(window.devicePixelRatio)
      container.appendChild(renderer.domElement)

      // Store references
      sceneRef.current = {
        camera,
        scene,
        renderer,
        uniforms,
        animationId: null,
      }

      // Handle resize
      const onWindowResize = () => {
        if (!renderer || !uniforms.resolution.value) return
        const rect = container.getBoundingClientRect()
        renderer.setSize(rect.width, rect.height)
        uniforms.resolution.value.x = renderer.domElement.width
        uniforms.resolution.value.y = renderer.domElement.height
      }

      onWindowResize()
      window.addEventListener("resize", onWindowResize, false)

      // Animation loop (wrapped in try/catch to protect against asynchronous driver/rendering crashes)
      const animate = () => {
        try {
          sceneRef.current.animationId = requestAnimationFrame(animate)
          uniforms.time.value += 0.05
          renderer.render(scene, camera)
        } catch (error) {
          console.warn("WebGL render failed asynchronously, falling back to clean CSS gradient:", error)
          if (sceneRef.current.animationId) {
            cancelAnimationFrame(sceneRef.current.animationId)
          }
          setWebglSupported(false)
        }
      }

      animate()
    } catch (error) {
      console.warn("WebGL initialization failed, falling back to clean CSS gradient:", error)
      setTimeout(() => {
        setWebglSupported(false)
      }, 0)
    }
  }

  useEffect(() => {
    if (webglSupported) {
      initThreeJS()
    }

    return () => {
      // Cleanup
      if (sceneRef.current.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId)
      }
      if (sceneRef.current.renderer) {
        sceneRef.current.renderer.dispose()
      }
    }
  }, [webglSupported])

  if (!webglSupported) {
    return (
      <div className="w-full h-full absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0c0f1d] animate-pulse duration-10000" />
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full absolute inset-0 z-0" 
    />
  )
}

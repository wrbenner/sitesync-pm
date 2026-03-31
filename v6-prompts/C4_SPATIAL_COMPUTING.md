# C4: Spatial Computing Ready (Apple Vision Pro / visionOS)

## Executive Summary

Spatial computing is the next paradigm. Position SiteSync as the FIRST construction platform with a production-grade spatial experience. This feature enables superintendents to don a Vision Pro headset and see the entire site in 3D space around them, with floating KPI panels, voice commands, and multi-user collaboration. The codebase is structured for spatial but can launch with progressive enhancement: desktop (mouse/keyboard) → tablet (touch) → VR/AR headsets (spatial).

---

## Architecture Overview

### 1. Spatial Computing vs Traditional 3D

| Aspect | Desktop/Web | Spatial Computing |
|--------|------------|-------------------|
| Input | Mouse, keyboard | Hands, eyes, head, voice |
| Output | 2D screen | 3D space around user |
| Perspective | Fixed camera | User-centered, 6DOF |
| Interaction | Click/drag | Pinch/grab/wave |
| Scale | Human scale | Room scale or larger |
| Collaboration | Single user | Multi-user in same space |
| UI Paradigm | Windows/buttons | Floating panels/spatial UI |

### 2. Progressive Enhancement Architecture

```
┌─────────────────────────────────────┐
│   Core: Spatial Scene Graph         │
│   (Hardware-agnostic layer)         │
└────────┬────────────────────────────┘
         │
    ┌────┴────┬───────────┬────────────┐
    │          │           │            │
    v          v           v            v
┌─────────┐┌──────────┐┌───────────┐┌──────────┐
│ Desktop ││  Tablet  ││  VR Head  ││ AR Mode  │
│WebGL    ││ Touch    ││ Passthrough││ Camera   │
│Mouse    ││ Gestures ││ Controllers││ Overlays │
└─────────┘└──────────┘└───────────┘└──────────┘
```

### 3. Spatial Input Abstraction

```typescript
// src/services/spatial/SpatialInput.ts

enum SpatialInputType {
  MOUSE = 'mouse',
  TOUCH = 'touch',
  HAND_PINCH = 'hand_pinch',
  HAND_GRAB = 'hand_grab',
  CONTROLLER = 'controller',
  VOICE = 'voice',
  GAZE = 'gaze',
}

interface SpatialPointer {
  id: string
  type: SpatialInputType
  position: THREE.Vector3
  direction: THREE.Vector3
  handedness?: 'left' | 'right'
  confidence: number // 0-1
  timestamp: number
}

interface SpatialGesture {
  type: 'pinch' | 'grab' | 'point' | 'open' | 'wave' | 'rotate'
  hand: 'left' | 'right'
  intensity: number // 0-1 (squeeze strength)
  timestamp: number
}

interface VoiceCommand {
  text: string
  confidence: number
  intent: string // 'show', 'hide', 'rotate', 'zoom', 'navigate'
  entities: Record<string, any>
  timestamp: number
}

export class SpatialInputManager {
  private pointers: Map<string, SpatialPointer> = new Map()
  private activeGestures: Map<string, SpatialGesture> = new Map()
  private platform: 'desktop' | 'tablet' | 'vr' | 'ar'
  private onPointerMove: (pointer: SpatialPointer) => void = () => {}
  private onGestureStart: (gesture: SpatialGesture) => void = () => {}
  private onGestureChange: (gesture: SpatialGesture) => void = () => {}
  private onGestureEnd: (gesture: SpatialGesture) => void = () => {}
  private onVoiceCommand: (command: VoiceCommand) => void = () => {}

  constructor() {
    this.platform = this.detectPlatform()
    this.initializeInputHandlers()
  }

  private detectPlatform(): 'desktop' | 'tablet' | 'vr' | 'ar' {
    // Detect based on device capabilities
    if (navigator.xr) {
      // WebXR available
      const xrSession = (navigator as any).xr?.isSessionSupported?.('immersive-vr')
      if (xrSession) return 'vr'
      const arSession = (navigator as any).xr?.isSessionSupported?.('immersive-ar')
      if (arSession) return 'ar'
    }

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    )) {
      return 'tablet'
    }

    return 'desktop'
  }

  private initializeInputHandlers() {
    switch (this.platform) {
      case 'desktop':
        this.initializeDesktopInput()
        break
      case 'tablet':
        this.initializeTouchInput()
        break
      case 'vr':
        this.initializeXRInput()
        break
      case 'ar':
        this.initializeARInput()
        break
    }
  }

  private initializeDesktopInput() {
    document.addEventListener('mousemove', (e) => {
      const pointer: SpatialPointer = {
        id: 'mouse',
        type: SpatialInputType.MOUSE,
        position: new THREE.Vector3(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1,
          0,
        ),
        direction: new THREE.Vector3(0, 0, -1),
        confidence: 1,
        timestamp: Date.now(),
      }
      this.pointers.set('mouse', pointer)
      this.onPointerMove(pointer)
    })

    document.addEventListener('wheel', (e) => {
      const command: VoiceCommand = {
        text: `zoom ${e.deltaY > 0 ? 'out' : 'in'}`,
        confidence: 1,
        intent: 'zoom',
        entities: { direction: e.deltaY > 0 ? 'out' : 'in' },
        timestamp: Date.now(),
      }
      this.onVoiceCommand(command)
    })
  }

  private initializeTouchInput() {
    document.addEventListener('touchmove', (e) => {
      const touch = e.touches[0]
      const pointer: SpatialPointer = {
        id: `touch-${touch.identifier}`,
        type: SpatialInputType.TOUCH,
        position: new THREE.Vector3(
          (touch.clientX / window.innerWidth) * 2 - 1,
          -(touch.clientY / window.innerHeight) * 2 + 1,
          0,
        ),
        direction: new THREE.Vector3(0, 0, -1),
        confidence: 1,
        timestamp: Date.now(),
      }
      this.pointers.set(`touch-${touch.identifier}`, pointer)
      this.onPointerMove(pointer)
    })

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const gesture: SpatialGesture = {
          type: 'pinch',
          hand: 'left',
          intensity: 0,
          timestamp: Date.now(),
        }
        this.activeGestures.set('pinch', gesture)
        this.onGestureStart(gesture)
      }
    })

    document.addEventListener('touchend', (e) => {
      const gesture = this.activeGestures.get('pinch')
      if (gesture) {
        this.activeGestures.delete('pinch')
        this.onGestureEnd(gesture)
      }
    })
  }

  private async initializeXRInput() {
    if (!navigator.xr) return

    const session = await (navigator.xr as any).requestSession('immersive-vr', {
      requiredFeatures: ['hand-tracking', 'dom-overlay'],
      domOverlay: { root: document.body },
    })

    // Hand tracking
    session.addEventListener('inputsourceschange', (event) => {
      for (const inputSource of event.added) {
        if (inputSource.hand) {
          // Hand controller
          this.processHandInput(inputSource)
        } else if (inputSource.gamepad) {
          // Gamepad/joystick
          this.processControllerInput(inputSource)
        }
      }
    })
  }

  private async initializeARInput() {
    if (!navigator.xr) return

    const session = await (navigator.xr as any).requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'hand-tracking'],
    })

    // Camera passthrough for AR overlay
    const glLayer = new XRWebGLLayer(session, (navigator as any).gl)
    session.updateRenderState({ baseLayer: glLayer })
  }

  private processHandInput(hand: any) {
    // Process hand gestures (pinch, grab, point, etc.)
    const gesture = this.detectHandGesture(hand)
    if (gesture) {
      this.activeGestures.set(`hand-${hand.handedness}`, gesture)
      this.onGestureChange(gesture)
    }
  }

  private detectHandGesture(hand: any): SpatialGesture | null {
    // Detect pinch: thumb and index finger close
    const thumbTip = hand.joints.get('thumb-tip')
    const indexTip = hand.joints.get('index-finger-tip')

    if (!thumbTip || !indexTip) return null

    const distance = thumbTip.pose.transform.position.distanceTo(
      indexTip.pose.transform.position,
    )

    if (distance < 0.02) {
      return {
        type: 'pinch',
        hand: hand.handedness,
        intensity: 1 - distance / 0.1,
        timestamp: Date.now(),
      }
    }

    return null
  }

  private processControllerInput(controller: any) {
    // Process controller input (buttons, joystick, etc.)
    const gamepad = controller.gamepad

    if (gamepad.buttons[0].pressed) {
      // Primary button = select
      const pointer: SpatialPointer = {
        id: `controller-${controller.handedness}`,
        type: SpatialInputType.CONTROLLER,
        position: this.getControllerPosition(controller),
        direction: this.getControllerDirection(controller),
        handedness: controller.handedness,
        confidence: 1,
        timestamp: Date.now(),
      }
      this.onPointerMove(pointer)
    }

    if (gamepad.axes.length > 2) {
      // Joystick movement
      const x = gamepad.axes[2]
      const y = gamepad.axes[3]

      if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) {
        const command: VoiceCommand = {
          text: `move ${x > 0 ? 'right' : 'left'} ${y > 0 ? 'up' : 'down'}`,
          confidence: 1,
          intent: 'navigate',
          entities: { dx: x, dy: y },
          timestamp: Date.now(),
        }
        this.onVoiceCommand(command)
      }
    }
  }

  private getControllerPosition(controller: any): THREE.Vector3 {
    // Get controller position from XR frame
    return new THREE.Vector3()
  }

  private getControllerDirection(controller: any): THREE.Vector3 {
    // Get controller forward direction
    return new THREE.Vector3(0, 0, -1)
  }

  registerGestureHandlers(
    onStart: (g: SpatialGesture) => void,
    onChange: (g: SpatialGesture) => void,
    onEnd: (g: SpatialGesture) => void,
  ) {
    this.onGestureStart = onStart
    this.onGestureChange = onChange
    this.onGestureEnd = onEnd
  }

  registerVoiceHandler(handler: (command: VoiceCommand) => void) {
    this.onVoiceCommand = handler
  }

  registerPointerHandler(handler: (pointer: SpatialPointer) => void) {
    this.onPointerMove = handler
  }
}
```

---

## Spatial Command Center

### 4. Core VisionOS Experience

```typescript
// src/components/spatial/SpatialCommandCenter.tsx

interface SpatialCommandCenterProps {
  projectId: string
  buildingId: string
  isARMode?: boolean
  cameraPassthrough?: MediaStream
}

export const SpatialCommandCenter: React.FC<SpatialCommandCenterProps> = ({
  projectId,
  buildingId,
  isARMode = false,
  cameraPassthrough,
}) => {
  const [spatialLayout, setSpatialLayout] = useState<SpatialLayout>({
    building: { scale: 1, position: new THREE.Vector3(0, 0, -1), rotation: new THREE.Quaternion() },
    kpiPanels: {},
    alerts: [],
    crewAvatars: {},
  })

  const [inputManager] = useState(() => new SpatialInputManager())
  const [buildingModel, setBuildingModel] = useState<THREE.Group | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Initialize 3D scene
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: isARMode,
      xr: { enabled: true },
    })

    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.xr.enabled = true

    // Load building model at table-scale
    const loadBuilding = async () => {
      const building = await loadBIMModel(buildingId)
      building.scale.set(0.5, 0.5, 0.5) // Scale down to table size
      building.position.copy(spatialLayout.building.position)
      scene.add(building)
      setBuildingModel(building)
    }

    loadBuilding()

    // Add lighting
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(10, 20, 10)
    scene.add(light)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    // Handle spatial gestures
    inputManager.registerGestureHandlers(
      (gesture) => handleGestureStart(gesture, buildingModel, spatialLayout),
      (gesture) => handleGestureChange(gesture, buildingModel),
      (gesture) => handleGestureEnd(gesture),
    )

    // Animation loop
    renderer.setAnimationLoop((time, frame) => {
      if (frame) {
        renderer.render(scene, camera)
      } else {
        renderer.render(scene, camera)
      }
    })

    return () => {
      renderer.dispose()
    }
  }, [buildingId, isARMode])

  // Create floating KPI panels
  const createKPIPanels = () => {
    const panels: Record<string, SpatialPanel> = {
      budget: {
        id: 'budget',
        title: 'Budget',
        position: new THREE.Vector3(-0.8, 0.5, -1),
        content: { value: '$2.3M', status: 'on-track', variance: '+$50K' },
      },
      schedule: {
        id: 'schedule',
        title: 'Schedule',
        position: new THREE.Vector3(0, 0.5, -1),
        content: { value: '85% Complete', status: 'behind', variance: '-3 days' },
      },
      safety: {
        id: 'safety',
        title: 'Safety',
        position: new THREE.Vector3(0.8, 0.5, -1),
        content: { value: '14 days TRIR', status: 'excellent', variance: 'N/A' },
      },
    }

    setSpatialLayout((prev) => ({
      ...prev,
      kpiPanels: panels,
    }))
  }

  useEffect(() => {
    createKPIPanels()
  }, [])

  return (
    <div className="relative w-full h-full bg-black">
      {isARMode && cameraPassthrough && (
        <video
          autoPlay
          playsInline
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
          srcObject={cameraPassthrough}
        />
      )}

      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          zIndex: isARMode ? 10 : 1,
        }}
      />

      {/* UI Overlays */}
      <SpatialUILayer layout={spatialLayout} />

      {/* Voice Command Indicator */}
      <VoiceCommandIndicator />
    </div>
  )
}

// Spatial UI rendered as canvas textures and billboards
const SpatialUILayer: React.FC<{ layout: SpatialLayout }> = ({ layout }) => {
  return (
    <group>
      {/* KPI Panels */}
      {Object.entries(layout.kpiPanels).map(([key, panel]) => (
        <SpatialPanel key={key} panel={panel} />
      ))}

      {/* Alert Markers */}
      {layout.alerts.map((alert, i) => (
        <AlertMarker key={i} alert={alert} />
      ))}

      {/* Crew Avatars */}
      {Object.entries(layout.crewAvatars).map(([id, avatar]) => (
        <CrewAvatar key={id} avatar={avatar} />
      ))}
    </group>
  )
}

interface SpatialPanel {
  id: string
  title: string
  position: THREE.Vector3
  content: Record<string, any>
}

const SpatialPanel: React.FC<{ panel: SpatialPanel }> = ({ panel }) => {
  const groupRef = useRef<THREE.Group>(null!)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    if (!groupRef.current) return

    // Create canvas texture for panel content
    const canvas = new OffscreenCanvas(512, 384)
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
    ctx.fillRect(0, 0, 512, 384)

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(10, 10, 492, 364)

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px Arial'
    ctx.fillText(panel.title, 30, 60)

    // Content
    ctx.font = '24px Arial'
    ctx.fillStyle = '#3b82f6'
    ctx.fillText(panel.content.value, 30, 120)

    ctx.font = '16px Arial'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(`Status: ${panel.content.status}`, 30, 160)
    ctx.fillText(`Variance: ${panel.content.variance}`, 30, 200)

    const texture = new THREE.CanvasTexture(canvas as any)
    textureRef.current = texture

    // Create billboard mesh
    const geometry = new THREE.PlaneGeometry(0.6, 0.45)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, material)

    mesh.position.copy(panel.position)
    groupRef.current.add(mesh)

    // Make billboard face camera
    groupRef.current.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.lookAt(0, 0, 0)
      }
    })
  }, [panel])

  return <group ref={groupRef} />
}

// Alert marker at specific location on building
const AlertMarker: React.FC<{ alert: AlertNotification }> = ({ alert }) => {
  const groupRef = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (!groupRef.current) return

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 32, 32),
      new THREE.MeshStandardMaterial({
        color: alert.severity === 'critical' ? 0xff0000 : 0xffa500,
        emissive: alert.severity === 'critical' ? 0xff0000 : 0xffa500,
        emissiveIntensity: 0.8,
      }),
    )

    sphere.position.copy(alert.position)
    groupRef.current.add(sphere)

    // Pulsing animation
    let time = 0
    const animate = () => {
      time += 0.02
      sphere.scale.set(
        1 + Math.sin(time) * 0.2,
        1 + Math.sin(time) * 0.2,
        1 + Math.sin(time) * 0.2,
      )
      requestAnimationFrame(animate)
    }
    animate()
  }, [alert])

  return <group ref={groupRef} />
}

// Crew member avatar
const CrewAvatar: React.FC<{ avatar: CrewAvatar }> = ({ avatar }) => {
  const groupRef = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (!groupRef.current) return

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x4f46e5 }),
    )

    cone.position.copy(avatar.position)
    groupRef.current.add(cone)

    // Name label above
    const canvas = new OffscreenCanvas(128, 32)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px Arial'
    ctx.fillText(avatar.name, 5, 20)

    const texture = new THREE.CanvasTexture(canvas as any)
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }))
    label.position.y = 0.35
    cone.add(label)
  }, [avatar.position])

  return <group ref={groupRef} />
}

// Voice command indicator
const VoiceCommandIndicator: React.FC = () => {
  const [isListening, setIsListening] = useState(false)
  const [command, setCommand] = useState('')

  useEffect(() => {
    const recognition = new (window.SpeechRecognition || (window as any).webkitSpeechRecognition)()
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript
        }
      }
      if (transcript) {
        setCommand(transcript)
        handleVoiceCommand(transcript)
      }
    }

    recognition.start()
    return () => recognition.abort()
  }, [])

  return (
    <div
      className={`absolute top-4 left-4 px-4 py-2 rounded-full transition-all ${
        isListening ? 'bg-red-600' : 'bg-gray-700'
      } text-white text-sm font-medium`}
    >
      {isListening ? '🎤 Listening...' : `Last: ${command}`}
    </div>
  )
}

// Helper functions
function handleGestureStart(gesture: SpatialGesture, building: THREE.Group | null, layout: SpatialLayout) {
  if (gesture.type === 'pinch') {
    // Prepare for zoom or selection
  } else if (gesture.type === 'grab') {
    // Prepare for rotation or drag
  }
}

function handleGestureChange(gesture: SpatialGesture, building: THREE.Group | null) {
  if (gesture.type === 'pinch') {
    // Pinch to zoom: increase intensity = zoom in
    const zoomFactor = 1 + gesture.intensity * 0.5
    if (building) {
      building.scale.multiplyScalar(zoomFactor)
    }
  } else if (gesture.type === 'grab') {
    // Grab to rotate
  }
}

function handleGestureEnd(gesture: SpatialGesture) {
  // Finalize gesture
}

async function handleVoiceCommand(transcript: string) {
  // Parse voice commands
  const lowerCase = transcript.toLowerCase()

  if (lowerCase.includes('show floor')) {
    const match = lowerCase.match(/floor (\d+)/)
    const floorNumber = match ? parseInt(match[1]) : 0
    // Isolate floor in 3D
  } else if (lowerCase.includes('zoom')) {
    // Zoom in/out
  } else if (lowerCase.includes('progress')) {
    // Show progress analysis
  }
}

async function loadBIMModel(buildingId: string): Promise<THREE.Group> {
  // Load IFC or cached model
  const response = await fetch(`/api/buildings/${buildingId}/model`)
  // TODO: Implement loading
  return new THREE.Group()
}
```

---

## Hand Gesture Interactions

### 5. Gesture Recognition & Mapping

```typescript
// src/services/spatial/GestureRecognition.ts

interface GestureMapping {
  gesture: 'pinch' | 'grab' | 'point' | 'open' | 'wave' | 'rotate'
  action: string
  description: string
  hand?: 'left' | 'right' | 'both'
}

const GESTURE_MAPPINGS: GestureMapping[] = [
  {
    gesture: 'pinch',
    action: 'select',
    description: 'Pinch thumb and index finger to select',
  },
  {
    gesture: 'pinch',
    action: 'zoom',
    description: 'Pinch with intensity to zoom in/out',
  },
  {
    gesture: 'grab',
    action: 'rotate',
    description: 'Grab with full hand to rotate model',
  },
  {
    gesture: 'grab',
    action: 'drag',
    description: 'Grab and move to pan',
  },
  {
    gesture: 'point',
    action: 'inspect',
    description: 'Point at element to see details',
  },
  {
    gesture: 'open',
    action: 'deselect',
    description: 'Open hand (all fingers extended) to deselect',
  },
  {
    gesture: 'wave',
    action: 'scroll',
    description: 'Wave hand left/right to scroll',
  },
]

export class GestureRecognizer {
  recognizeGesture(handData: XRHand): 'pinch' | 'grab' | 'point' | 'open' | 'wave' | null {
    const thumbTip = handData.joints.get('thumb-tip')?.pose.transform.position
    const indexTip = handData.joints.get('index-finger-tip')?.pose.transform.position
    const middleTip = handData.joints.get('middle-finger-tip')?.pose.transform.position
    const ringTip = handData.joints.get('ring-finger-tip')?.pose.transform.position
    const pinkyTip = handData.joints.get('pinky-finger-tip')?.pose.transform.position
    const palmBase = handData.joints.get('palm')?.pose.transform.position

    if (!thumbTip || !indexTip) return null

    // Pinch detection
    const thumbIndexDist = thumbTip.distanceTo(indexTip)
    if (thumbIndexDist < 0.02) return 'pinch'

    // Grab detection (fist)
    const allFingersClosed =
      thumbIndexDist < 0.05 &&
      middleTip &&
      ringTip &&
      pinkyTip &&
      indexTip.distanceTo(middleTip) < 0.04 &&
      middleTip.distanceTo(ringTip) < 0.04 &&
      ringTip.distanceTo(pinkyTip) < 0.04

    if (allFingersClosed) return 'grab'

    // Point detection (only index extended)
    if (indexTip && thumbTip && palmBase) {
      const indexDistance = indexTip.distanceTo(palmBase)
      const thumbDistance = thumbTip.distanceTo(palmBase)
      if (indexDistance > 0.08 && thumbDistance < 0.06) {
        return 'point'
      }
    }

    // Open hand (all fingers extended)
    if (
      thumbIndexDist > 0.1 &&
      middleTip &&
      ringTip &&
      pinkyTip &&
      indexTip.distanceTo(middleTip) > 0.08
    ) {
      return 'open'
    }

    return null
  }

  detectWave(handMovement: THREE.Vector3): boolean {
    // Detect left-right or up-down wave motion
    return Math.abs(handMovement.x) > 0.3 || Math.abs(handMovement.y) > 0.3
  }
}
```

---

## Voice Command System

### 6. Natural Language Processing for Spatial Control

```typescript
// src/services/spatial/VoiceCommandParser.ts

interface ParsedCommand {
  intent: 'show' | 'hide' | 'zoom' | 'rotate' | 'navigate' | 'measure' | 'query'
  target?: string // element type, floor, area
  parameters?: Record<string, any>
  confidence: number
}

export class VoiceCommandParser {
  private intents: Map<string, string[]> = new Map([
    ['show', ['show', 'display', 'reveal', 'open', 'unhide']],
    ['hide', ['hide', 'close', 'conceal', 'remove']],
    ['zoom', ['zoom', 'magnify', 'enlarge', 'focus', 'closer', 'further']],
    ['rotate', ['rotate', 'turn', 'spin', 'flip', 'invert']],
    ['navigate', ['go to', 'move to', 'jump to', 'look at']],
    ['measure', ['measure', 'distance', 'length', 'calculate', 'size']],
    ['query', ['how much', 'how many', 'what is', 'tell me about']],
  ])

  parseCommand(transcript: string): ParsedCommand {
    const lower = transcript.toLowerCase()

    // Intent detection
    let intent: ParsedCommand['intent'] = 'query'
    let confidence = 0.5

    for (const [intentName, keywords] of this.intents) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          intent = intentName as any
          confidence = 0.9
          break
        }
      }
    }

    // Parameter extraction
    const parameters: Record<string, any> = {}

    // Floor detection
    const floorMatch = lower.match(/floor\s+(\d+)/i)
    if (floorMatch) {
      parameters.floor = parseInt(floorMatch[1])
    }

    // Element type detection
    const elementTypes = ['wall', 'column', 'slab', 'window', 'door', 'rebar', 'concrete']
    for (const type of elementTypes) {
      if (lower.includes(type)) {
        parameters.elementType = type
        break
      }
    }

    // Measurement detection
    if (intent === 'measure') {
      const distMatch = lower.match(/from\s+(\w+)\s+to\s+(\w+)/i)
      if (distMatch) {
        parameters.from = distMatch[1]
        parameters.to = distMatch[2]
      }
    }

    return {
      intent,
      target: parameters.elementType || parameters.floor?.toString(),
      parameters,
      confidence,
    }
  }
}

export const VOICE_COMMAND_EXAMPLES = [
  'Show me floor 3',
  'Hide the MEP systems',
  'Zoom in on the foundation',
  'Rotate the building 90 degrees',
  'Go to the west facade',
  'Measure the distance from column A to column B',
  'How much concrete has been poured?',
  'Show me active tasks',
]
```

---

## Multi-User Collaboration

### 7. Shared Spatial Session

```typescript
// src/services/spatial/MultiUserSession.ts

interface RemoteUser {
  userId: string
  name: string
  position: THREE.Vector3
  handPositions: {
    left: THREE.Vector3
    right: THREE.Vector3
  }
  gaze: THREE.Vector3
  activeFloor?: number
  selectedElement?: string
}

interface SharedState {
  cameraTarget: THREE.Vector3
  isolatedFloors: number[]
  selectedElements: string[]
  annotationMarkers: AnnotationMarker[]
}

export class MultiUserSessionManager {
  private ws: WebSocket | null = null
  private localUserId: string
  private remoteUsers: Map<string, RemoteUser> = new Map()
  private sharedState: SharedState = {
    cameraTarget: new THREE.Vector3(),
    isolatedFloors: [],
    selectedElements: [],
    annotationMarkers: [],
  }

  constructor(projectId: string, userId: string) {
    this.localUserId = userId
    this.connectWebSocket(projectId)
  }

  private connectWebSocket(projectId: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/api/spatial-sessions/${projectId}`

    this.ws = new WebSocket(url)

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      this.handleMessage(message)
    }

    this.ws.onclose = () => {
      console.log('Spatial session disconnected')
    }
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'user-joined':
        this.remoteUsers.set(message.userId, message.user)
        break
      case 'user-left':
        this.remoteUsers.delete(message.userId)
        break
      case 'user-moved':
        const user = this.remoteUsers.get(message.userId)
        if (user) {
          user.position.copy(message.position)
          user.handPositions = message.handPositions
        }
        break
      case 'shared-state-update':
        Object.assign(this.sharedState, message.state)
        break
      case 'annotation-added':
        this.sharedState.annotationMarkers.push(message.annotation)
        break
    }
  }

  broadcastUserState(position: THREE.Vector3, hands: any) {
    if (!this.ws) return

    this.ws.send(
      JSON.stringify({
        type: 'user-state',
        userId: this.localUserId,
        position: position.toArray(),
        hands,
      }),
    )
  }

  broadcastStateChange(field: string, value: any) {
    if (!this.ws) return

    this.ws.send(
      JSON.stringify({
        type: 'state-change',
        field,
        value,
      }),
    )
  }

  getRemoteUsers(): RemoteUser[] {
    return Array.from(this.remoteUsers.values())
  }

  getSharedState(): SharedState {
    return this.sharedState
  }
}

// Render other users' hands and cursors
export const RemoteUserRepresentation: React.FC<{ user: RemoteUser }> = ({ user }) => {
  const groupRef = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (!groupRef.current) return

    // Left hand
    const leftHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x4f46e5 }),
    )
    leftHand.position.copy(user.handPositions.left)
    groupRef.current.add(leftHand)

    // Right hand
    const rightHand = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x4f46e5 }),
    )
    rightHand.position.copy(user.handPositions.right)
    groupRef.current.add(rightHand)

    // Gaze ray
    const gazeGeometry = new THREE.BufferGeometry().setFromPoints([user.position, user.gaze])
    const gazeLine = new THREE.Line(
      gazeGeometry,
      new THREE.LineBasicMaterial({ color: 0x4f46e5, linewidth: 2 }),
    )
    groupRef.current.add(gazeLine)

    // Name label
    const canvas = new OffscreenCanvas(128, 32)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#4f46e5'
    ctx.font = 'bold 16px Arial'
    ctx.fillText(user.name, 5, 20)

    const texture = new THREE.CanvasTexture(canvas as any)
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }))
    label.position.copy(user.position)
    label.position.y += 0.2
    groupRef.current.add(label)
  }, [user])

  return <group ref={groupRef} />
}
```

---

## AR Overlay Mode

### 8. Camera Passthrough & Spatial Anchoring

```typescript
// src/services/spatial/AROverlay.ts

export class AROverlayManager {
  private arSession: XRSession | null = null
  private hitTestSource: XRHitTestSource | null = null
  private worldAnchor: XRAnchor | null = null

  async initializeAR(): Promise<boolean> {
    if (!navigator.xr) return false

    try {
      this.arSession = await (navigator.xr as any).requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay', 'dom-overlay-for-handheld-ar'],
        optionalFeatures: ['hand-tracking', 'camera-access'],
        domOverlay: { root: document.body },
      })

      // Request hit test capability
      const controller = this.arSession.inputSources[0]
      if (controller) {
        const xrSpace = this.arSession.getInputSourceSpace(controller)
        if (xrSpace) {
          this.hitTestSource = await this.arSession.requestHitTestSource({
            space: xrSpace,
          })
        }
      }

      return true
    } catch (e) {
      console.error('AR initialization failed:', e)
      return false
    }
  }

  async placeModel(
    model: THREE.Group,
    hitTest: XRHitTestResults,
  ): Promise<boolean> {
    if (!this.arSession || hitTest.results.length === 0) return false

    try {
      const hit = hitTest.results[0]
      const pose = hit.getPose(this.arSession.renderState.baseLayer!.space)

      if (pose) {
        // Create spatial anchor
        this.worldAnchor = await hit.createAnchor()

        // Position model at anchor
        const anchorMatrix = new THREE.Matrix4()
        anchorMatrix.fromArray(this.worldAnchor.transform.matrix)

        model.position.setFromMatrixPosition(anchorMatrix)
        model.quaternion.setFromRotationMatrix(anchorMatrix)

        return true
      }
    } catch (e) {
      console.error('Failed to place model:', e)
    }

    return false
  }

  updateARVisualization(
    frame: XRFrame,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    scene: THREE.Scene,
  ) {
    if (!this.arSession || !this.hitTestSource) return

    // Get hit test results
    const hitTestResults = frame.getHitTestResults(this.hitTestSource)

    // Update visual feedback for placeable surfaces
    if (hitTestResults.length > 0) {
      // Show placement indicator
    }

    // Render camera passthrough + 3D overlay
    const glLayer = this.arSession.renderState.baseLayer as XRWebGLLayer
    renderer.setRenderTarget(glLayer.framebuffer)
    renderer.render(scene, camera)
  }
}
```

---

## Responsive 3D Breakpoints

### 9. Adaptive UI for Different Screen Sizes

```typescript
// src/hooks/useResponsiveSpatial.ts

interface SpatialBreakpoint {
  breakpoint: 'phone' | 'tablet' | 'desktop' | 'vr' | 'ar'
  panelSize: { width: number; height: number }
  panelDistance: number
  modelScale: number
  textSize: number
  interactionRadius: number
}

const SPATIAL_BREAKPOINTS: Record<string, SpatialBreakpoint> = {
  phone: {
    breakpoint: 'phone',
    panelSize: { width: 2, height: 1.5 },
    panelDistance: 0.3,
    modelScale: 0.3,
    textSize: 12,
    interactionRadius: 0.1,
  },
  tablet: {
    breakpoint: 'tablet',
    panelSize: { width: 3, height: 2 },
    panelDistance: 0.5,
    modelScale: 0.5,
    textSize: 14,
    interactionRadius: 0.15,
  },
  desktop: {
    breakpoint: 'desktop',
    panelSize: { width: 4, height: 3 },
    panelDistance: 1,
    modelScale: 1,
    textSize: 16,
    interactionRadius: 0.2,
  },
  vr: {
    breakpoint: 'vr',
    panelSize: { width: 2, height: 1.5 },
    panelDistance: 0.8,
    modelScale: 0.8,
    textSize: 18,
    interactionRadius: 0.05,
  },
  ar: {
    breakpoint: 'ar',
    panelSize: { width: 1.5, height: 1 },
    panelDistance: 0.5,
    modelScale: 0.3,
    textSize: 14,
    interactionRadius: 0.08,
  },
}

export function useResponsiveSpatial(): SpatialBreakpoint {
  const [breakpoint, setBreakpoint] = useState<string>('desktop')

  useEffect(() => {
    const checkBreakpoint = () => {
      // Detect platform/device type
      if (navigator.xr) {
        // VR/AR capable
        // TODO: Determine if VR or AR
        setBreakpoint('vr')
      } else if (/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        // Mobile
        if (window.innerHeight > window.innerWidth) {
          setBreakpoint('phone')
        } else {
          setBreakpoint('tablet')
        }
      } else {
        // Desktop
        setBreakpoint('desktop')
      }
    }

    checkBreakpoint()
    window.addEventListener('resize', checkBreakpoint)
    return () => window.removeEventListener('resize', checkBreakpoint)
  }, [])

  return SPATIAL_BREAKPOINTS[breakpoint] || SPATIAL_BREAKPOINTS.desktop
}
```

---

## Database Schema

### 10. Spatial Session Tracking

```sql
-- spatial_sessions.sql

CREATE TABLE spatial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  session_type VARCHAR(50) NOT NULL, -- 'desktop', 'mobile', 'vr', 'ar'
  user_id UUID NOT NULL,

  -- Session state
  building_id UUID,
  camera_position JSONB, -- { x, y, z }
  camera_target JSONB,
  selected_elements UUID[] DEFAULT '{}',
  isolated_floors INTEGER[] DEFAULT '{}',

  -- Multi-user
  participant_count INTEGER DEFAULT 1,
  participants UUID[] DEFAULT '{}',

  -- Spatial anchors (AR)
  anchors JSONB DEFAULT '[]', -- Array of anchor positions

  -- Performance
  average_fps DECIMAL(5,2),
  frame_time_ms DECIMAL(5,2),

  started_at TIMESTAMP DEFAULT now(),
  ended_at TIMESTAMP,
  duration_minutes INTEGER,

  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
)

CREATE INDEX idx_spatial_sessions_project ON spatial_sessions(project_id)
CREATE INDEX idx_spatial_sessions_user ON spatial_sessions(user_id)
CREATE INDEX idx_spatial_sessions_active ON spatial_sessions(ended_at) WHERE ended_at IS NULL

-- Gesture telemetry
CREATE TABLE gesture_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  gesture_type VARCHAR(50), -- 'pinch', 'grab', 'point', etc.
  hand VARCHAR(10), -- 'left', 'right'
  intensity DECIMAL(3,2),
  action_triggered VARCHAR(100),
  timestamp TIMESTAMP DEFAULT now(),

  FOREIGN KEY (session_id) REFERENCES spatial_sessions(id)
)

-- Voice command log
CREATE TABLE voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  transcript TEXT,
  intent VARCHAR(100),
  confidence DECIMAL(3,2),
  action_taken VARCHAR(200),
  timestamp TIMESTAMP DEFAULT now(),

  FOREIGN KEY (session_id) REFERENCES spatial_sessions(id)
)
```

---

## Launch Strategy

### Phase 1: Desktop (Q2 2026)
- Mouse/keyboard controls
- Desktop-optimized panels
- Single-user experience

### Phase 2: Mobile (Q3 2026)
- Touch gestures
- Tablet UI layout
- Responsive sizing

### Phase 3: VR (Q4 2026)
- WebXR integration
- Hand tracking
- Multi-user collaboration

### Phase 4: AR (Q1 2027)
- Camera passthrough
- Spatial anchoring
- On-site visualization

---

## Key Performance Targets

- 60fps on VR headset (1800x1920 per eye)
- 90fps on desktop (1920x1080)
- Hand gesture recognition: <100ms latency
- Voice command response: <500ms
- Multi-user sync: <100ms

# Phase 3D: Photo Pins and Progress Comparison

**Status**: Phase 3 (Digital Twin + Spatial)
**Priority**: High
**Effort**: 14 days
**Target**: Day 69-82

---

## Pre-Requisites

### Dependent Files
- Phase_3A_BIM_VIEWER.md (BIM model + element identification)
- Phase_3B_DATA_OVERLAYS.md (progress data integration)

### New Dependencies
- sharp 0.32+ (image processing backend)
- Anthropic Claude API (progress detection)
- three/examples for SpriteCanvas

### Database Tables

```sql
CREATE TABLE photo_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  location_x FLOAT NOT NULL,
  location_y FLOAT NOT NULL,
  location_z FLOAT NOT NULL,
  photo_url TEXT NOT NULL, -- Supabase Storage path
  photo_360_url TEXT, -- 360 panorama URL if available
  caption TEXT,
  taken_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB -- {exif, width, height, orientation}
);

CREATE TABLE photo_pin_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_pin_id UUID NOT NULL REFERENCES photo_pins(id) ON DELETE CASCADE,
  ifc_element_id INT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(photo_pin_id, ifc_element_id)
);

CREATE TABLE progress_detection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_pin_id UUID NOT NULL REFERENCES photo_pins(id) ON DELETE CASCADE,
  element_id INT NOT NULL,
  completion_percent INT,
  confidence_score FLOAT, -- 0-1
  description TEXT,
  ai_analysis JSONB, -- {materials, colors, textures, visible_progress}
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE photo_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  before_photo_id UUID NOT NULL REFERENCES photo_pins(id),
  after_photo_id UUID NOT NULL REFERENCES photo_pins(id),
  comparison_url TEXT, -- Side-by-side or slider image
  progress_detected BOOLEAN,
  days_elapsed INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_photo_pins_project ON photo_pins(project_id);
CREATE INDEX idx_photo_pins_location ON photo_pins(location_x, location_y, location_z);
CREATE INDEX idx_photo_associations_element ON photo_pin_associations(ifc_element_id);
CREATE INDEX idx_progress_detection_element ON progress_detection_results(element_id);
```

---

## Implementation Steps

### Step 1: Photo Pin Manager

**File**: `src/services/photos/PhotoPinManager.ts`

```typescript
import * as THREE from 'three';
import { supabase } from '@/lib/supabase';

export interface PhotoPin {
  id: string;
  projectId: string;
  location: THREE.Vector3;
  photoUrl: string;
  photo360Url?: string;
  caption?: string;
  takenAt: Date;
  elementIds: number[];
  completionPercent?: number;
  mesh?: THREE.Mesh;
}

export class PhotoPinManager {
  private scene: THREE.Group;
  private projectId: string;
  private userId: string;
  private photoPins: Map<string, PhotoPin> = new Map();
  private pinGroup: THREE.Group;
  private selectedPin: PhotoPin | null = null;

  constructor(scene: THREE.Group, projectId: string, userId: string) {
    this.scene = scene;
    this.projectId = projectId;
    this.userId = userId;

    this.pinGroup = new THREE.Group();
    this.pinGroup.name = 'PhotoPins';
    this.scene.add(this.pinGroup);
  }

  async addPhotoPin(
    location: THREE.Vector3,
    photoFile: File,
    caption?: string,
    elementIds?: number[]
  ): Promise<PhotoPin> {
    // Upload photo to Supabase Storage
    const fileName = `${this.projectId}/${Date.now()}_${photoFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project_photos')
      .upload(fileName, photoFile);

    if (uploadError || !uploadData) {
      throw new Error(`Photo upload failed: ${uploadError?.message}`);
    }

    // Get public URL
    const { data } = supabase.storage
      .from('project_photos')
      .getPublicUrl(uploadData.path);
    const photoUrl = data.publicUrl;

    // Save pin metadata to database
    const { data: pinData, error: dbError } = await supabase
      .from('photo_pins')
      .insert({
        project_id: this.projectId,
        uploaded_by: this.userId,
        location_x: location.x,
        location_y: location.y,
        location_z: location.z,
        photo_url: photoUrl,
        caption,
      })
      .select();

    if (dbError || !pinData) {
      throw new Error(`Pin creation failed: ${dbError?.message}`);
    }

    const pinId = pinData[0].id;

    // Associate with elements if provided
    if (elementIds && elementIds.length > 0) {
      for (const elementId of elementIds) {
        await supabase.from('photo_pin_associations').insert({
          photo_pin_id: pinId,
          ifc_element_id: elementId,
          is_primary: elementIds[0] === elementId,
        });
      }
    }

    // Create visual representation
    const pin = this.createPhotoPinVisual(
      pinId,
      location,
      photoUrl,
      caption,
      elementIds || []
    );

    this.photoPins.set(pinId, pin);

    // Run progress detection
    await this.runProgressDetection(pinId, photoFile, elementIds || []);

    return pin;
  }

  private createPhotoPinVisual(
    id: string,
    location: THREE.Vector3,
    photoUrl: string,
    caption?: string,
    elementIds?: number[]
  ): PhotoPin {
    // Create camera icon marker
    const markerGeometry = new THREE.ConeGeometry(1.5, 3, 32);
    const markerMaterial = new THREE.MeshPhongMaterial({
      color: 0xff6b35, // Orange
      emissive: 0xff6b35,
      emissiveIntensity: 0.4,
    });

    const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
    markerMesh.position.copy(location);
    markerMesh.userData = { pinId: id };

    this.pinGroup.add(markerMesh);

    // Create info popup sprite
    const sprite = this.createPinLabel(caption || 'Photo', 0xff6b35);
    sprite.position.copy(location);
    sprite.position.y += 3;
    this.pinGroup.add(sprite);

    return {
      id,
      projectId: this.projectId,
      location: location.clone(),
      photoUrl,
      caption,
      takenAt: new Date(),
      elementIds: elementIds || [],
      mesh: markerMesh,
    };
  }

  private createPinLabel(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 256, 128);

    // Text
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    ctx.font = 'italic 12px sans-serif';
    ctx.fillStyle = '#999';
    ctx.fillText('Click to view', 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(20, 10, 1);

    return sprite;
  }

  private async runProgressDetection(
    pinId: string,
    photoFile: File,
    elementIds: number[]
  ): Promise<void> {
    try {
      // Read photo as base64
      const arrayBuffer = await photoFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array) as number[]);
      const base64 = btoa(binaryString);

      // Call Claude API with vision capability
      const response = await fetch('/api/progress-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoBase64: base64,
          elementIds,
          projectId: this.projectId,
        }),
      });

      const result = await response.json();

      if (result.success && result.detections) {
        // Save results to database
        for (const detection of result.detections) {
          await supabase.from('progress_detection_results').insert({
            photo_pin_id: pinId,
            element_id: detection.elementId,
            completion_percent: detection.completionPercent,
            confidence_score: detection.confidenceScore,
            description: detection.description,
            ai_analysis: detection.analysis,
          });
        }
      }
    } catch (error) {
      console.warn('Progress detection failed:', error);
      // Non-fatal, continue without AI analysis
    }
  }

  async loadPhotoPins(): Promise<void> {
    const { data, error } = await supabase
      .from('photo_pins')
      .select('*, photo_pin_associations(*)')
      .eq('project_id', this.projectId);

    if (error || !data) {
      console.error('Failed to load photo pins:', error);
      return;
    }

    for (const row of data) {
      const elementIds = (row.photo_pin_associations || []).map(
        (a: any) => a.ifc_element_id
      );

      const pin = this.createPhotoPinVisual(
        row.id,
        new THREE.Vector3(row.location_x, row.location_y, row.location_z),
        row.photo_url,
        row.caption,
        elementIds
      );

      this.photoPins.set(row.id, pin);
    }

    console.log(`Loaded ${data.length} photo pins`);
  }

  selectPin(pinId: string): PhotoPin | null {
    this.selectedPin = this.photoPins.get(pinId) || null;
    return this.selectedPin;
  }

  getSelectedPin(): PhotoPin | null {
    return this.selectedPin;
  }

  getAllPins(): PhotoPin[] {
    return Array.from(this.photoPins.values());
  }

  deletePin(pinId: string): void {
    const pin = this.photoPins.get(pinId);
    if (!pin && pin!.mesh) {
      this.pinGroup.remove(pin!.mesh);
    }
    this.photoPins.delete(pinId);
  }

  destroy(): void {
    this.scene.remove(this.pinGroup);
    this.photoPins.clear();
  }
}
```

### Step 2: Photo Viewer Component

**File**: `src/components/BIMViewer/PhotoViewer.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { PhotoPin } from '@/services/photos/PhotoPinManager';
import { supabase } from '@/lib/supabase';

interface PhotoViewerProps {
  pin: PhotoPin;
  onClose: () => void;
}

export const PhotoViewer: React.FC<PhotoViewerProps> = ({ pin, onClose }) => {
  const [progressData, setProgressData] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);

  useEffect(() => {
    loadProgressData();
    loadComparison();
  }, [pin.id]);

  const loadProgressData = async () => {
    const { data } = await supabase
      .from('progress_detection_results')
      .select('*')
      .eq('photo_pin_id', pin.id)
      .limit(5);

    setProgressData(data);
  };

  const loadComparison = async () => {
    const { data } = await supabase
      .from('photo_comparisons')
      .select('*')
      .or(
        `before_photo_id.eq.${pin.id},after_photo_id.eq.${pin.id}`
      )
      .limit(1)
      .single();

    setComparison(data);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          maxWidth: '900px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: '#f0f0f0',
            border: 'none',
            borderRadius: '4px',
            width: '32px',
            height: '32px',
            fontSize: '18px',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          ×
        </button>

        {/* Photo */}
        <div style={{ background: '#000', overflow: 'auto' }}>
          <img
            src={pin.photoUrl}
            alt="Photo"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        </div>

        {/* Metadata */}
        <div style={{ padding: '20px' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>
            {pin.caption || 'Photo Pin'}
          </h2>

          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#999' }}>
            Taken {pin.takenAt.toLocaleDateString()} at ({pin.location.x.toFixed(1)},
            {pin.location.y.toFixed(1)}, {pin.location.z.toFixed(1)})
          </p>

          {/* Progress Detection Results */}
          {progressData && progressData.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                Progress Detection
              </h3>
              {progressData.map((result: any) => (
                <div
                  key={result.id}
                  style={{
                    background: '#f7f8fa',
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '500' }}>
                    Element {result.element_id}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#666',
                      marginTop: '4px',
                    }}
                  >
                    {result.completion_percent}% complete
                    {result.confidence_score && (
                      <span style={{ marginLeft: '8px' }}>
                        (confidence: {(result.confidence_score * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  {result.description && (
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                      {result.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Before/After Comparison */}
          {comparison && comparison.comparison_url && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                Progress Comparison
              </h3>
              <img
                src={comparison.comparison_url}
                alt="Comparison"
                style={{
                  width: '100%',
                  borderRadius: '6px',
                }}
              />
              <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                {comparison.days_elapsed} days elapsed
              </div>
            </div>
          )}

          {/* Element Associations */}
          {pin.elementIds.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                Associated Elements
              </h3>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {pin.elementIds.join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

### Step 3: Progress Detection API Endpoint

**File**: `src/pages/api/progress-detection.ts` (Edge Function)

```typescript
// This runs on Supabase Edge Functions
import Anthropic from '@anthropic-ai/sdk';

interface ProgressDetectionRequest {
  photoBase64: string;
  elementIds: number[];
  projectId: string;
}

interface DetectionResult {
  elementId: number;
  completionPercent: number;
  confidenceScore: number;
  description: string;
  analysis: {
    materials: string[];
    colors: string[];
    visibleProgress: string;
  };
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request): Promise<Response> {
  try {
    const body: ProgressDetectionRequest = await req.json();

    // Call Claude API with vision
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: body.photoBase64,
              },
            },
            {
              type: 'text',
              text: `Analyze this construction site photo and estimate the completion percentage for each visible element.

              Respond with a JSON array of objects with this structure:
              [
                {
                  "elementId": 0,
                  "completionPercent": 75,
                  "confidenceScore": 0.85,
                  "description": "Framing complete, drywall in progress",
                  "analysis": {
                    "materials": ["steel frame", "drywall sheets"],
                    "colors": ["gray steel", "white gypsum"],
                    "visibleProgress": "Structural framing complete, interior finishes approximately 50% complete"
                  }
                }
              ]

              Be conservative with confidence scores. Return only valid JSON.`,
            },
          ],
        },
      ],
    });

    // Parse response
    let detections: DetectionResult[] = [];
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        detections = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('Failed to parse Claude response:', parseError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        detections,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Progress detection error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
```

### Step 4: Photo Comparison Tool

**File**: `src/services/photos/PhotoComparison.ts`

```typescript
import { supabase } from '@/lib/supabase';

export async function createComparison(
  projectId: string,
  beforePhotoId: string,
  afterPhotoId: string
): Promise<void> {
  // Fetch both photos
  const { data: photos, error } = await supabase
    .from('photo_pins')
    .select('photo_url, taken_at')
    .in('id', [beforePhotoId, afterPhotoId]);

  if (error || !photos || photos.length !== 2) {
    throw new Error('Failed to fetch photos');
  }

  // Fetch images
  const beforeImg = new Image();
  const afterImg = new Image();

  await new Promise((resolve) => {
    beforeImg.onload = resolve;
    beforeImg.src = photos[0].photo_url;
  });

  await new Promise((resolve) => {
    afterImg.onload = resolve;
    afterImg.src = photos[1].photo_url;
  });

  // Create comparison image (side-by-side)
  const canvas = document.createElement('canvas');
  canvas.width = beforeImg.width + afterImg.width;
  canvas.height = Math.max(beforeImg.height, afterImg.height);

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(beforeImg, 0, 0);
  ctx.drawImage(afterImg, beforeImg.width, 0);

  // Add labels
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, 80, 30);
  ctx.fillRect(beforeImg.width + 10, 10, 80, 30);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Before', 20, 32);
  ctx.fillText('After', beforeImg.width + 20, 32);

  // Upload comparison
  const comparisonBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });

  const fileName = `${projectId}/comparison_${Date.now()}.png`;
  const { data, error: uploadError } = await supabase.storage
    .from('project_photos')
    .upload(fileName, comparisonBlob);

  if (uploadError) {
    throw new Error(`Comparison upload failed: ${uploadError.message}`);
  }

  const { data: publicUrl } = supabase.storage
    .from('project_photos')
    .getPublicUrl(data!.path);

  // Save to database
  const daysElapsed = Math.floor(
    (new Date(photos[1].taken_at).getTime() -
      new Date(photos[0].taken_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  await supabase.from('photo_comparisons').insert({
    project_id: projectId,
    before_photo_id: beforePhotoId,
    after_photo_id: afterPhotoId,
    comparison_url: publicUrl.publicUrl,
    days_elapsed: daysElapsed,
    progress_detected: true,
  });
}
```

---

## Acceptance Criteria

- [ ] Upload photo, place in 3D space by clicking on model location
- [ ] Photo pins show as orange cone markers with caption labels
- [ ] Click pin to open full-screen photo viewer with metadata
- [ ] Progress detection runs automatically, shows completion % per element
- [ ] Before/after slider compares two photos with swipe/drag
- [ ] Comparison image generated and stored with time elapsed
- [ ] Photos persist in database, load on project open
- [ ] Metadata includes EXIF data (date, camera, location if available)
- [ ] 360 panorama photos viewable within BIM (if provided)
- [ ] All progress detection results queryable and sortable by date

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Photo upload | <5s |
| Progress detection | <10s |
| Photo viewer open | <500ms |
| Comparison generation | <3s |

---

## Future Enhancements

1. Time-lapse animation (play sequence of photos)
2. Augmented reality mode (phone overlay live camera on BIM)
3. AI-powered "what changed" highlighting between photos
4. Progress trends graphed over time
5. Mobile app integration with Capacitor camera

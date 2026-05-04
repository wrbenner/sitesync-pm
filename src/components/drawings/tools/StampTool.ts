import {
  Group as FabricGroup,
  Rect as FabricRect,
  IText as FabricIText,
  Line as FabricLine,
  type Canvas as FabricCanvas,
} from 'fabric';

export type StampType =
  | 'approved'
  | 'rejected'
  | 'revise_resubmit'
  | 'reviewed'
  | 'void'
  | 'not_for_construction'
  | 'preliminary';

export interface StampOptions {
  type: StampType;
  signerName: string;
  date: string;
  x: number;
  y: number;
  scale?: number;
}

export const STAMP_CONFIGS: Record<
  StampType,
  { label: string; color: string; borderColor: string }
> = {
  approved: { label: 'APPROVED', color: '#2E8B57', borderColor: '#2E8B57' },
  rejected: { label: 'REJECTED', color: '#D32F2F', borderColor: '#D32F2F' },
  revise_resubmit: { label: 'REVISE & RESUBMIT', color: '#E08A00', borderColor: '#E08A00' },
  reviewed: { label: 'REVIEWED', color: '#1565C0', borderColor: '#1565C0' },
  void: { label: 'VOID', color: '#D32F2F', borderColor: '#D32F2F' },
  not_for_construction: { label: 'NOT FOR CONSTRUCTION', color: '#D32F2F', borderColor: '#D32F2F' },
  preliminary: { label: 'PRELIMINARY', color: '#E08A00', borderColor: '#E08A00' },
};

const STAMP_PADDING = 14;
const LABEL_FONT_SIZE = 18;
const DETAIL_FONT_SIZE = 11;
const BORDER_WIDTH = 2;
const BORDER_RADIUS = 4;
const INNER_GAP = 3;

/**
 * Creates a construction approval stamp as a Fabric.js Group.
 * The stamp contains a double-bordered rectangle, the stamp label,
 * the signer name, and the date.
 */
export function createStamp(
  canvas: FabricCanvas,
  options: StampOptions
): FabricGroup {
  const { type, signerName, date, x, y, scale = 1 } = options;
  const config = STAMP_CONFIGS[type];

  // Estimate width from the longest text line
  const charWidth = LABEL_FONT_SIZE * 0.65;
  const stampWidth = Math.max(config.label.length * charWidth, 140) + STAMP_PADDING * 2;
  const stampHeight = LABEL_FONT_SIZE + DETAIL_FONT_SIZE * 2 + STAMP_PADDING * 3;

  // Outer border rectangle
  const outerRect = new FabricRect({
    width: stampWidth,
    height: stampHeight,
    rx: BORDER_RADIUS,
    ry: BORDER_RADIUS,
    fill: 'rgba(255,255,255,0.92)',
    stroke: config.borderColor,
    strokeWidth: BORDER_WIDTH,
    originX: 'center',
    originY: 'center',
  });

  // Inner border rectangle (double-line effect)
  const innerRect = new FabricRect({
    width: stampWidth - INNER_GAP * 4,
    height: stampHeight - INNER_GAP * 4,
    rx: BORDER_RADIUS - 1,
    ry: BORDER_RADIUS - 1,
    fill: 'transparent',
    stroke: config.borderColor,
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
  });

  // Label text
  const labelText = new FabricIText(config.label, {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: 'bold',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fill: config.color,
    originX: 'center',
    originY: 'center',
    top: -stampHeight / 2 + STAMP_PADDING + LABEL_FONT_SIZE / 2,
    editable: false,
  });

  // Signer name
  const signerText = new FabricIText(signerName, {
    fontSize: DETAIL_FONT_SIZE,
    fontFamily: 'Arial, Helvetica, sans-serif',
    fill: config.color,
    originX: 'center',
    originY: 'center',
    top: LABEL_FONT_SIZE / 2,
    editable: false,
  });

  // Date text
  const dateText = new FabricIText(date, {
    fontSize: DETAIL_FONT_SIZE,
    fontFamily: 'Arial, Helvetica, sans-serif',
    fill: config.color,
    originX: 'center',
    originY: 'center',
    top: LABEL_FONT_SIZE / 2 + DETAIL_FONT_SIZE + 4,
    editable: false,
  });

  const objects = [outerRect, innerRect, labelText, signerText, dateText];

  // For 'void' type, add a diagonal strike-through line
  if (type === 'void') {
    const diagonal = new FabricLine(
      [-stampWidth / 2 + 6, -stampHeight / 2 + 6, stampWidth / 2 - 6, stampHeight / 2 - 6],
      {
        stroke: config.color,
        strokeWidth: 2.5,
        originX: 'center',
        originY: 'center',
      }
    );
    objects.push(diagonal);
  }

  const group = new FabricGroup(objects, {
    left: x,
    top: y,
    scaleX: scale,
    scaleY: scale,
    selectable: true,
    evented: true,
    objectCaching: false,
  });

  canvas.add(group);
  canvas.renderAll();

  return group;
}

// Type declarations for OpenSeadragon v6
// Covers the subset of the API used by DrawingTiledViewer

declare module 'openseadragon' {
  interface Point {
    x: number;
    y: number;
    plus(point: Point): Point;
    minus(point: Point): Point;
    times(factor: number): Point;
    divide(factor: number): Point;
    distanceTo(point: Point): number;
    equals(point: Point): boolean;
  }

  interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
    getTopLeft(): Point;
    getBottomRight(): Point;
    getCenter(): Point;
    getSize(): Point;
    containsPoint(point: Point): boolean;
  }

  interface Viewport {
    getZoom(current?: boolean): number;
    setZoom(zoom: number): Viewport;
    zoomBy(factor: number, refPoint?: Point, immediately?: boolean): Viewport;
    zoomTo(zoom: number, refPoint?: Point, immediately?: boolean): Viewport;
    getCenter(current?: boolean): Point;
    panTo(center: Point, immediately?: boolean): Viewport;
    panBy(delta: Point, immediately?: boolean): Viewport;
    getBounds(current?: boolean): Rect;
    getBoundsNoRotate(current?: boolean): Rect;
    getHomeBounds(): Rect;
    goHome(immediately?: boolean): void;
    fitBounds(bounds: Rect, immediately?: boolean): Viewport;
    getMinZoom(): number;
    getMaxZoom(): number;
    setRotation(degrees: number): Viewport;
    getRotation(): number;
    viewportToImageCoordinates(viewportPoint: Point): Point;
    imageToViewportCoordinates(imagePoint: Point): Point;
    viewportToViewerElementCoordinates(viewportPoint: Point): Point;
    viewerElementToViewportCoordinates(viewerPoint: Point): Point;
    windowToViewportCoordinates(windowPoint: Point): Point;
    viewportToWindowCoordinates(viewportPoint: Point): Point;
    containerSize: Point;
    contentSize: Point;
  }

  interface TileSource {
    width: number;
    height: number;
    tileSize: number;
    minLevel: number;
    maxLevel: number;
  }

  interface TiledImage {
    source: TileSource;
    getBounds(current?: boolean): Rect;
    getContentSize(): Point;
  }

  interface World {
    getItemAt(index: number): TiledImage;
    getItemCount(): number;
  }

  interface EventData {
    originalEvent?: MouseEvent | TouchEvent | PointerEvent;
    position?: Point;
    quick?: boolean;
    shift?: boolean;
    preventDefaultAction?: boolean;
  }

  interface Overlay {
    element: HTMLElement;
    location: Point | Rect;
    placement?: string;
  }

  type EventHandler = (event: EventData) => void;

  interface ViewerOptions {
    id?: string;
    element?: HTMLElement;
    tileSources?: unknown;
    prefixUrl?: string;
    showNavigationControl?: boolean;
    showNavigator?: boolean;
    navigatorPosition?: string;
    navigatorAutoFade?: boolean;
    showZoomControl?: boolean;
    showHomeControl?: boolean;
    showFullPageControl?: boolean;
    showRotationControl?: boolean;
    showSequenceControl?: boolean;
    gestureSettingsMouse?: {
      clickToZoom?: boolean;
      dblClickToZoom?: boolean;
      scrollToZoom?: boolean;
      flickEnabled?: boolean;
    };
    gestureSettingsTouch?: {
      pinchToZoom?: boolean;
      flickEnabled?: boolean;
      flickMinSpeed?: number;
      flickMomentum?: number;
      clickToZoom?: boolean;
      dblClickToZoom?: boolean;
    };
    gestureSettingsPen?: {
      clickToZoom?: boolean;
      dblClickToZoom?: boolean;
    };
    zoomInButton?: string;
    zoomOutButton?: string;
    homeButton?: string;
    fullPageButton?: string;
    maxZoomPixelRatio?: number;
    minZoomImageRatio?: number;
    defaultZoomLevel?: number;
    minZoomLevel?: number;
    maxZoomLevel?: number;
    visibilityRatio?: number;
    constrainDuringPan?: boolean;
    wrapHorizontal?: boolean;
    wrapVertical?: boolean;
    animationTime?: number;
    springStiffness?: number;
    immediateRender?: boolean;
    imageLoaderLimit?: number;
    clickTimeThreshold?: number;
    clickDistThreshold?: number;
    crossOriginPolicy?: string | false;
    ajaxWithCredentials?: boolean;
    loadTilesWithAjax?: boolean;
    timeout?: number;
    debugMode?: boolean;
    preserveImageSizeOnResize?: boolean;
    placeholderFillStyle?: string;
    subPixelRoundingForTransparency?: number;
    drawer?: string;
    // Additional v6 options
    preserveViewport?: boolean;
    sequenceMode?: boolean;
  }

  class Viewer {
    constructor(options: ViewerOptions);
    viewport: Viewport;
    world: World;
    canvas: HTMLElement;
    container: HTMLElement;
    element: HTMLElement;
    drawer: unknown;

    addHandler(eventName: string, handler: EventHandler): void;
    removeHandler(eventName: string, handler: EventHandler): void;
    addOnceHandler(eventName: string, handler: EventHandler): void;

    open(tileSources: unknown): void;
    close(): void;
    destroy(): void;
    isOpen(): boolean;

    addOverlay(options: {
      element: HTMLElement;
      location?: Point | Rect;
      placement?: string;
      checkResize?: boolean;
    }): Viewer;
    removeOverlay(element: HTMLElement | string): Viewer;
    updateOverlay(element: HTMLElement | string, location: Point | Rect, placement?: string): Viewer;
    clearOverlays(): Viewer;

    setMouseNavEnabled(enabled: boolean): void;
    isMouseNavEnabled(): boolean;

    addTiledImage(options: { tileSource: unknown; index?: number; x?: number; y?: number; width?: number; success?: () => void; error?: () => void }): void;

    forceRedraw(): void;
    isFullPage(): boolean;
    setFullPage(fullPage: boolean): Viewer;
  }

  // Static constructors
  function Point(x: number, y: number): Point;
  function Rect(x: number, y: number, width: number, height: number): Rect;

  // Export viewer as default
  export default Viewer;
  export { Viewer, Point, Rect, Viewport, TileSource, TiledImage, World, Overlay, ViewerOptions, EventData, EventHandler };
}

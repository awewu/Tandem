declare module 'react-konva' {
  import * as React from 'react';
  import { KonvaEventObject } from 'konva/lib/Node';

  export interface StageProps {
    width: number;
    height: number;
    scaleX?: number;
    scaleY?: number;
    children?: React.ReactNode;
    onMouseDown?: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseMove?: (e: KonvaEventObject<MouseEvent>) => void;
    onMouseUp?: (e: KonvaEventObject<MouseEvent>) => void;
    className?: string;
  }
  export const Stage: React.FC<StageProps>;

  export interface LayerProps {
    children?: React.ReactNode;
  }
  export const Layer: React.FC<LayerProps>;

  export interface LineProps {
    points: number[];
    stroke?: string;
    strokeWidth?: number;
    dash?: number[];
    lineCap?: string;
    onClick?: () => void;
  }
  export const Line: React.FC<LineProps>;

  export interface RectProps {
    x: number;
    y: number;
    width: number;
    height: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    draggable?: boolean;
    onClick?: () => void;
  }
  export const Rect: React.FC<RectProps>;

  export interface CircleProps {
    x: number;
    y: number;
    radius: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    onClick?: () => void;
  }
  export const Circle: React.FC<CircleProps>;

  export interface ImageProps {
    image: HTMLImageElement | null;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    opacity?: number;
  }
  export const Image: React.FC<ImageProps>;
}

declare module 'konva/lib/Node' {
  export interface KonvaEventObject<E = MouseEvent> {
    target: any;
    getStage(): { getPointerPosition(): { x: number; y: number } | null } | null;
    evt: E;
  }
}

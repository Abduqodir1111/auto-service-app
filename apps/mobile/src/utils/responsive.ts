import { PixelRatio, useWindowDimensions } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return PixelRatio.roundToNearestPixel(value);
}

export function scale(size: number, width: number) {
  return round(size * (width / BASE_WIDTH));
}

export function verticalScale(size: number, height: number) {
  return round(size * (height / BASE_HEIGHT));
}

export function moderateScale(size: number, width: number, factor = 0.5) {
  return round(size + (scale(size, width) - size) * factor);
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const isTablet = shortSide >= 768;
  const isSmallPhone = shortSide < 360;
  const isLargePhone = shortSide >= 414 && !isTablet;
  const gutter = isTablet ? 28 : isSmallPhone ? 14 : isLargePhone ? 20 : 16;
  const contentMaxWidth = isTablet ? 720 : width;
  const contentWidth = Math.max(0, Math.min(width - gutter * 2, contentMaxWidth));

  return {
    width,
    height,
    shortSide,
    isTablet,
    isSmallPhone,
    isLargePhone,
    gutter,
    contentMaxWidth,
    contentWidth,
    scale: (size: number) => scale(size, width),
    verticalScale: (size: number) => verticalScale(size, height),
    moderateScale: (size: number, factor = 0.5) => moderateScale(size, width, factor),
    font: (size: number, factor = 0.35, min = size - 2, max = size + 3) =>
      clamp(moderateScale(size, width, factor), min, max),
  };
}

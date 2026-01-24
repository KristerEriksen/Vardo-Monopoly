export function mapPlotToGrid(position) {
  // Bottom row (right → left)
  if (position >= 0 && position <= 10) {
    return {
      row: 10,
      col: 10 - position
    };
  }

  // Left column (bottom → top)
  if (position >= 11 && position <= 19) {
    return {
      row: 10 - (position - 10),
      col: 0
    };
  }

  // Top row (left → right)
  if (position >= 20 && position <= 30) {
    return {
      row: 0,
      col: position - 20
    };
  }

  // Right column (top → bottom)
  if (position >= 31 && position <= 39) {
    return {
      row: position - 30,
      col: 10
    };
  }
}

import React from 'react';

// Generates a deterministically styled QR code grid representation for any Talko number
interface QRCodeProps {
  value: string;
  size?: number;
  color?: string;
  bgColor?: string;
}

export const TalkoQRCode: React.FC<QRCodeProps> = ({
  value,
  size = 200,
  color = '#2563EB',
  bgColor = '#FFFFFF',
}) => {
  // Deterministic 21x21 grid based on value hash
  const gridSize = 21;
  
  // Helper hash
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const hash = getHash(value);

  // Generate 21x21 matrix with standard QR finder patterns at corners
  const matrix: boolean[][] = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(false));

  // Finder pattern maker (7x7)
  const addFinderPattern = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startRow + r][startCol + c] = true;
        }
      }
    }
  };

  // Top-left, Top-right, Bottom-left finders
  addFinderPattern(0, 0);
  addFinderPattern(0, gridSize - 7);
  addFinderPattern(gridSize - 7, 0);

  // Center logo zone reservation (5x5 center)
  const centerStart = Math.floor(gridSize / 2) - 2;
  const centerEnd = Math.floor(gridSize / 2) + 2;

  // Fill in rest based on hash & position
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Skip finder areas
      if (r < 7 && c < 7) continue;
      if (r < 7 && c >= gridSize - 7) continue;
      if (r >= gridSize - 7 && c < 7) continue;
      // Skip center logo zone
      if (r >= centerStart && r <= centerEnd && c >= centerStart && c <= centerEnd) continue;

      // Seed pseudo-random bit
      const bit = ((hash * (r + 1) * 31 + (c + 1) * 17 + (r ^ c)) % 100) > 42;
      matrix[r][c] = bit;
    }
  }

  const cellSize = size / gridSize;

  return (
    <div
      className="relative flex items-center justify-center p-3 rounded-2xl bg-white shadow-inner border border-slate-100"
      style={{ width: size + 24, height: size + 24 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect width={size} height={size} fill={bgColor} rx={12} />
        {matrix.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize - 0.5}
                height={cellSize - 0.5}
                fill={color}
                rx={1.5}
              />
            );
          })
        )}
      </svg>
      {/* Center Talko Badge */}
      <div
        className="absolute bg-white rounded-full p-1.5 shadow-md flex items-center justify-center border border-blue-100"
        style={{
          width: cellSize * 5,
          height: cellSize * 5,
        }}
      >
        <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">
          T
        </div>
      </div>
    </div>
  );
};

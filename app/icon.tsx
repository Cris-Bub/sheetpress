import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a1a',
          color: '#fbf9f4',
          fontSize: 22,
          fontStyle: 'italic',
          fontWeight: 600,
          letterSpacing: '-0.04em',
          fontFamily: 'serif',
          borderRadius: 6,
        }}
      >
        sP
      </div>
    ),
    size,
  );
}

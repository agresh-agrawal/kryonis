import { ImageResponse } from 'next/og';

/**
 * The social preview card.
 *
 * Rendered by next/og at build time rather than shipped as a PNG, which keeps
 * the repository free of binary art and means the card can never drift out of
 * date with the copy it advertises - both come from the same source.
 */
export const runtime = 'nodejs';
export const alt = 'KRYONIS — build and run a self-sustaining colony on Mars';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '84px',
          background:
            'radial-gradient(1100px 620px at 74% 22%, #4a2c1c 0%, #221610 46%, #0c0a09 100%)',
          color: '#ece6dd',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* The crater, echoing the app icon. */}
        <div
          style={{
            position: 'absolute',
            top: -150,
            right: -120,
            width: 620,
            height: 620,
            borderRadius: '50%',
            border: '10px solid rgba(201,138,82,0.45)',
            background:
              'radial-gradient(circle at 45% 38%, rgba(138,90,56,0.55) 0%, rgba(58,36,26,0.5) 72%, rgba(12,10,9,0) 100%)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 46, height: 3, background: '#c98a52', display: 'flex' }} />
          <div
            style={{
              fontSize: 21,
              letterSpacing: 9,
              textTransform: 'uppercase',
              color: '#a49c92',
              display: 'flex',
            }}
          >
            Mars Colony Builder
          </div>
        </div>

        <div
          style={{
            fontSize: 128,
            letterSpacing: 26,
            marginTop: 26,
            fontWeight: 300,
            display: 'flex',
          }}
        >
          KRYONIS
        </div>

        <div
          style={{
            fontSize: 34,
            marginTop: 26,
            lineHeight: 1.4,
            color: '#c9c1b6',
            maxWidth: 760,
            display: 'flex',
          }}
        >
          Land in a crater with four colonists and a budget. Make it
          self-sustaining before the reserves run out.
        </div>

        <div
          style={{
            display: 'flex',
            gap: 30,
            marginTop: 52,
            fontSize: 23,
            color: '#8d857b',
          }}
        >
          <div style={{ display: 'flex' }}>Play free in the browser</div>
          <div style={{ display: 'flex', color: '#3a352f' }}>·</div>
          <div style={{ display: 'flex' }}>No install, no account</div>
        </div>
      </div>
    ),
    size,
  );
}

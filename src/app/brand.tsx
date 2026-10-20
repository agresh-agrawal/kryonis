/**
 * The KRYONIS mark, drawn for raster output.
 *
 * `icon.svg` is the canonical logo and is what browsers get, but two places
 * cannot use SVG at all: iOS home-screen icons, and Android maskable icons.
 * Both need PNG, so the mark is rebuilt here in the CSS subset that Satori
 * (next/og) understands - nested circles rather than paths - and rendered at
 * whatever size is asked for.
 *
 * Keeping it as one component means the favicon, the home-screen icon and the
 * install icon cannot drift apart.
 */

/** Palette shared with the SVG logo and the game's own dust accent. */
const RIM = '#c98a52';
const FLOOR_OUTER = '#3a241a';
const FLOOR_INNER = '#8a5a38';
const BONE = '#e8e2d9';
const VOID = '#12100e';

export function CraterMark({
  size,
  /**
   * Fraction of the canvas the mark occupies.
   *
   * Android crops a maskable icon to a circle or a squircle depending on the
   * launcher, and anything outside the inner 80% can be cut. Passing a smaller
   * scale pads the mark into that safe zone instead of letting the rim be
   * shaved off.
   */
  scale = 1,
  background = VOID,
}: {
  size: number;
  scale?: number;
  background?: string;
}) {
  const mark = size * scale;
  const unit = mark / 64;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
      }}
    >
      {/* Crater wall. */}
      <div
        style={{
          width: mark * 0.72,
          height: mark * 0.72,
          borderRadius: '50%',
          border: `${unit * 3.5}px solid ${RIM}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: `radial-gradient(circle at 50% 42%, ${FLOOR_INNER} 0%, #5d3a26 70%, ${FLOOR_OUTER} 100%)`,
        }}
      >
        {/* The colony: a lander flanked by two habitat domes. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            width: mark * 0.6,
            height: mark * 0.6,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: mark * 0.17,
              width: unit * 7.2,
              height: unit * 7.2,
              borderRadius: '50%',
              background: BONE,
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: mark * 0.33,
              left: mark * 0.08,
              width: unit * 4.2,
              height: unit * 4.2,
              borderRadius: '50%',
              background: '#cfc8bd',
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: mark * 0.33,
              right: mark * 0.08,
              width: unit * 4.2,
              height: unit * 4.2,
              borderRadius: '50%',
              background: '#cfc8bd',
              display: 'flex',
            }}
          />
        </div>
      </div>
    </div>
  );
}

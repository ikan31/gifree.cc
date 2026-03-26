package gif

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"

	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goitalic"
	"golang.org/x/image/font/gofont/gomono"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/gofont/gosmallcaps"
)

// AddText overlays text on every frame of the GIF and returns a new GIFFile
func AddText(g *GIFFile, opts TextOptions) (*GIFFile, error) {
	if opts.Size <= 0 {
		opts.Size = 20
	}
	if opts.Color == nil {
		opts.Color = color.White
	}

	var fontData []byte
	switch opts.Font {
	case "bold":
		fontData = gobold.TTF
	case "italic":
		fontData = goitalic.TTF
	case "mono":
		fontData = gomono.TTF
	case "smallcaps":
		fontData = gosmallcaps.TTF
	default:
		fontData = goregular.TTF
	}
	font, err := truetype.Parse(fontData)
	if err != nil {
		return nil, fmt.Errorf("parse font: %w", err)
	}

	newFrames := make([]*image.Paletted, len(g.Frames))
	for i, frame := range g.Frames {
		b := frame.Bounds()

		// Composite frame onto an RGBA canvas so we can draw text
		rgba := image.NewRGBA(b)
		draw.Draw(rgba, b, frame, b.Min, draw.Src)

		c := freetype.NewContext()
		c.SetDPI(72)
		c.SetFont(font)
		c.SetFontSize(opts.Size)
		c.SetClip(b)
		c.SetDst(rgba)
		c.SetSrc(image.NewUniform(opts.Color))

		// opts.X/Y are top-left in GIF pixels; freetype wants the baseline
		x := opts.X
		y := opts.Y + int(opts.Size*0.85)
		pt := freetype.Pt(x, y)
		if _, err := c.DrawString(opts.Text, pt); err != nil {
			return nil, fmt.Errorf("draw string frame %d: %w", i, err)
		}

		// Convert back to Paletted using the original palette
		dst := image.NewPaletted(b, frame.Palette)
		draw.FloydSteinberg.Draw(dst, b, rgba, b.Min)
		newFrames[i] = dst
	}

	delays := make([]int, len(g.Delays))
	copy(delays, g.Delays)

	return &GIFFile{
		Frames:    newFrames,
		Delays:    delays,
		LoopCount: g.LoopCount,
	}, nil
}

package gif

import (
	"fmt"
	"image"
	"image/color"
	gifstd "image/gif"

	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"golang.org/x/image/draw"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goitalic"
	"golang.org/x/image/font/gofont/gomono"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/gofont/gosmallcaps"
)

// TextOptions configures text overlay rendering
type TextOptions struct {
	Text  string
	Size  float64
	Color color.Color
	X     int // left edge in GIF pixels
	Y     int // top edge in GIF pixels
	Font  string
}

// AddText overlays text on every frame of the GIF and returns a new GIF.
func AddText(gif *gifstd.GIF, opts TextOptions) (*gifstd.GIF, error) {
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
		return nil, ErrLoadFont
	}

	newImages := make([]*image.Paletted, len(gif.Image))
	for index, sourceImage := range gif.Image {
		bounds := sourceImage.Bounds()

		// Composite frame onto an RGBA canvas so we can draw text.
		rgba := image.NewRGBA(bounds)
		draw.Copy(rgba, image.Point{X: 0, Y: 0}, sourceImage, bounds, draw.Src, nil)

		context := freetype.NewContext()
		context.SetDPI(72)
		context.SetFont(font)
		context.SetFontSize(opts.Size)
		context.SetClip(bounds)
		context.SetDst(rgba)
		context.SetSrc(image.NewUniform(opts.Color))

		// opts.X/Y are top-left in GIF pixels; freetype wants the baseline.
		x := opts.X
		y := opts.Y + int(opts.Size*0.85)
		pt := freetype.Pt(x, y)
		_, err := context.DrawString(opts.Text, pt)
		if err != nil {
			return nil, fmt.Errorf("Failed to draw string frame %d: %w", index, err)
		}

		// Convert back to paletted using the original palette.
		dst := image.NewPaletted(bounds, sourceImage.Palette)
		draw.FloydSteinberg.Draw(dst, bounds, rgba, bounds.Min)
		newImages[index] = dst
	}

	return &gifstd.GIF{
		Image:           newImages,
		Delay:           gif.Delay,
		LoopCount:       gif.LoopCount,
		Disposal:        gif.Disposal,
		Config:          gif.Config,
		BackgroundIndex: gif.BackgroundIndex,
	}, nil
}

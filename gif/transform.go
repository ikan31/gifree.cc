package gif

import (
	"image"
	gifstd "image/gif"
)

// Reverse returns a new GIF with frames in reverse order.
func Reverse(g *gifstd.GIF) (*gifstd.GIF, error) {
	n := len(g.Image)
	if n == 0 {
		return nil, ErrNoFrames
	}
	newImages := make([]*image.Paletted, n)
	newDelay := make([]int, n)
	newDisposal := make([]byte, n)
	for i := range n {
		newImages[i] = g.Image[n-1-i]
		newDelay[i] = g.Delay[n-1-i]
		newDisposal[i] = g.Disposal[n-1-i]
	}
	return &gifstd.GIF{
		Image:           newImages,
		Delay:           newDelay,
		LoopCount:       g.LoopCount,
		Disposal:        newDisposal,
		Config:          g.Config,
		BackgroundIndex: g.BackgroundIndex,
	}, nil
}

// FlipH returns a new GIF with every frame flipped horizontally.
func FlipH(g *gifstd.GIF) (*gifstd.GIF, error) {
	return applyToAllFrames(g, flipHFrame)
}

// FlipV returns a new GIF with every frame flipped vertically.
func FlipV(g *gifstd.GIF) (*gifstd.GIF, error) {
	return applyToAllFrames(g, flipVFrame)
}

// Rotate90CW returns a new GIF with every frame rotated 90° clockwise.
func Rotate90CW(g *gifstd.GIF) (*gifstd.GIF, error) {
	return applyToAllFrames(g, rotate90CWFrame)
}

// Rotate90CCW returns a new GIF with every frame rotated 90° counter-clockwise.
func Rotate90CCW(g *gifstd.GIF) (*gifstd.GIF, error) {
	return applyToAllFrames(g, rotate90CCWFrame)
}

// Rotate180 returns a new GIF with every frame rotated 180°.
func Rotate180(g *gifstd.GIF) (*gifstd.GIF, error) {
	return applyToAllFrames(g, rotate180Frame)
}

// applyToAllFrames applies fn to every frame and updates Config dimensions from the result.
func applyToAllFrames(g *gifstd.GIF, fn func(*image.Paletted) *image.Paletted) (*gifstd.GIF, error) {
	if len(g.Image) == 0 {
		return nil, ErrNoFrames
	}
	newImages := make([]*image.Paletted, len(g.Image))
	for i, frame := range g.Image {
		newImages[i] = fn(frame)
	}
	cfg := g.Config
	b := newImages[0].Bounds()
	cfg.Width = b.Dx()
	cfg.Height = b.Dy()
	return &gifstd.GIF{
		Image:           newImages,
		Delay:           g.Delay,
		LoopCount:       g.LoopCount,
		Disposal:        g.Disposal,
		Config:          cfg,
		BackgroundIndex: g.BackgroundIndex,
	}, nil
}

func flipHFrame(src *image.Paletted) *image.Paletted {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	dst := image.NewPaletted(image.Rect(0, 0, w, h), src.Palette)
	for y := range h {
		for x := range w {
			dst.SetColorIndex(x, y, src.ColorIndexAt(b.Min.X+w-1-x, b.Min.Y+y))
		}
	}
	return dst
}

func flipVFrame(src *image.Paletted) *image.Paletted {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	dst := image.NewPaletted(image.Rect(0, 0, w, h), src.Palette)
	for y := range h {
		for x := range w {
			dst.SetColorIndex(x, y, src.ColorIndexAt(b.Min.X+x, b.Min.Y+h-1-y))
		}
	}
	return dst
}

// rotate90CWFrame rotates a frame 90° clockwise — new width = old height, new height = old width.
// new pixel at (nx, ny) = old pixel at (ny, h-1-nx).
func rotate90CWFrame(src *image.Paletted) *image.Paletted {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	dst := image.NewPaletted(image.Rect(0, 0, h, w), src.Palette)
	for ny := range w {
		for nx := range h {
			dst.SetColorIndex(nx, ny, src.ColorIndexAt(b.Min.X+ny, b.Min.Y+h-1-nx))
		}
	}
	return dst
}

// rotate90CCWFrame rotates a frame 90° counter-clockwise — new width = old height, new height = old width.
// new pixel at (nx, ny) = old pixel at (w-1-ny, nx).
func rotate90CCWFrame(src *image.Paletted) *image.Paletted {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	dst := image.NewPaletted(image.Rect(0, 0, h, w), src.Palette)
	for ny := range w {
		for nx := range h {
			dst.SetColorIndex(nx, ny, src.ColorIndexAt(b.Min.X+w-1-ny, b.Min.Y+nx))
		}
	}
	return dst
}

func rotate180Frame(src *image.Paletted) *image.Paletted {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	dst := image.NewPaletted(image.Rect(0, 0, w, h), src.Palette)
	for y := range h {
		for x := range w {
			dst.SetColorIndex(x, y, src.ColorIndexAt(b.Min.X+w-1-x, b.Min.Y+h-1-y))
		}
	}
	return dst
}

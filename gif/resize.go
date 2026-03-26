package gif

import (
	"fmt"
	"image"
	"image/draw"

	xdraw "golang.org/x/image/draw"
)

// Resize scales every frame of the GIF to the given dimensions.
// Pass width=0 to auto-calculate from height, or height=0 to auto-calculate from width.
func Resize(g *GIFFile, width, height int) (*GIFFile, error) {
	if len(g.Frames) == 0 {
		return nil, fmt.Errorf("gif has no frames")
	}

	origW := g.Frames[0].Bounds().Dx()
	origH := g.Frames[0].Bounds().Dy()

	if origW == 0 || origH == 0 {
		return nil, fmt.Errorf("invalid source dimensions")
	}

	// Calculate missing dimension maintaining aspect ratio
	if width == 0 && height == 0 {
		return nil, fmt.Errorf("width or height must be specified")
	}
	if width == 0 {
		width = height * origW / origH
	}
	if height == 0 {
		height = width * origH / origW
	}
	if width < 1 {
		width = 1
	}
	if height < 1 {
		height = 1
	}

	newFrames := make([]*image.Paletted, len(g.Frames))
	dst := image.NewRGBA(image.Rect(0, 0, width, height))

	for i, frame := range g.Frames {
		// Scale frame onto RGBA canvas
		xdraw.BiLinear.Scale(dst, dst.Bounds(), frame, frame.Bounds(), xdraw.Src, nil)

		// Convert back to paletted using original palette
		out := image.NewPaletted(dst.Bounds(), frame.Palette)
		draw.FloydSteinberg.Draw(out, dst.Bounds(), dst, image.Point{})
		newFrames[i] = out
	}

	delays := make([]int, len(g.Delays))
	copy(delays, g.Delays)

	return &GIFFile{
		Frames:    newFrames,
		Delays:    delays,
		LoopCount: g.LoopCount,
	}, nil
}

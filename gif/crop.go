package gif

import (
	"fmt"
	"image"
	"image/draw"
)

type CropOptions struct {
	X, Y, Width, Height int
}

func Crop(g *GIFFile, opts CropOptions) (*GIFFile, error) {
	if opts.Width <= 0 || opts.Height <= 0 {
		return nil, fmt.Errorf("crop dimensions must be positive")
	}
	b := g.Frames[0].Bounds()
	if opts.X < 0 || opts.Y < 0 || opts.X+opts.Width > b.Max.X || opts.Y+opts.Height > b.Max.Y {
		return nil, fmt.Errorf("crop rect out of bounds")
	}
	srcRect := image.Rect(opts.X, opts.Y, opts.X+opts.Width, opts.Y+opts.Height)
	dstRect := image.Rect(0, 0, opts.Width, opts.Height)
	newFrames := make([]*image.Paletted, len(g.Frames))
	for i, frame := range g.Frames {
		dst := image.NewPaletted(dstRect, frame.Palette)
		draw.Draw(dst, dstRect, frame.SubImage(srcRect), srcRect.Min, draw.Src)
		newFrames[i] = dst
	}
	delays := make([]int, len(g.Delays))
	copy(delays, g.Delays)
	return &GIFFile{Frames: newFrames, Delays: delays, LoopCount: g.LoopCount}, nil
}

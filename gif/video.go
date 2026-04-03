package gif

import (
	"image"
	"image/color/palette"
	gifstd "image/gif"

	"golang.org/x/image/draw"
)

// FramesToGIF converts a sequence of raw RGBA frames into a GIF.
// Each frame must be width*height*4 bytes in RGBA order.
// fps must be between 1 and 60; the GIF frame delay is derived from it.
func FramesToGIF(frames [][]byte, width, height, fps int) (*gifstd.GIF, error) {
	if len(frames) == 0 {
		return nil, ErrNoVideoFrames
	}

	if fps < 1 || fps > 60 {
		return nil, ErrInvalidFPS
	}

	delayCs := 100 / fps

	bounds := image.Rect(0, 0, width, height)
	images := make([]*image.Paletted, len(frames))
	delays := make([]int, len(frames))
	disposals := make([]byte, len(frames))

	for i, frameData := range frames {
		rgba := image.NewRGBA(bounds)
		copy(rgba.Pix, frameData)

		dst := image.NewPaletted(bounds, palette.Plan9)
		draw.FloydSteinberg.Draw(dst, bounds, rgba, image.Point{X: 0, Y: 0})

		images[i] = dst
		delays[i] = delayCs
		disposals[i] = 0
	}

	return &gifstd.GIF{
		Image:           images,
		Delay:           delays,
		LoopCount:       0,
		Disposal:        disposals,
		Config:          image.Config{ColorModel: nil, Width: width, Height: height},
		BackgroundIndex: 0,
	}, nil
}

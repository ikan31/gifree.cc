package gif

import (
	"image"
	gifstd "image/gif"

	"golang.org/x/image/draw"
)

// Resize scales every frame of the GIF to the given dimensions.
// Pass width=0 to auto-calculate from height, or height=0 to auto-calculate from width.
func Resize(gif *gifstd.GIF, width, height int) (*gifstd.GIF, error) {
	if len(gif.Image) == 0 {
		return nil, ErrNoFrames
	}

	origW := gif.Image[0].Bounds().Dx()
	origH := gif.Image[0].Bounds().Dy()

	if origW == 0 || origH == 0 {
		return nil, ErrInvalidDimensions
	}

	// Calculate missing dimension maintaining aspect ratio
	if width == 0 && height == 0 {
		return nil, ErrResizeDimensions
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

	newImages := make([]*image.Paletted, len(gif.Image))

	// RGBA Image to do operations
	rgbaImage := image.NewRGBA(image.Rect(0, 0, width, height))

	for index, sourceImage := range gif.Image {
		// Scale frame onto RGBA canvas
		draw.BiLinear.Scale(
			rgbaImage,
			rgbaImage.Bounds(),
			sourceImage,
			sourceImage.Bounds(),
			draw.Src,
			nil,
		)

		// Convert back to paletted using original palette
		out := image.NewPaletted(rgbaImage.Bounds(), sourceImage.Palette)
		draw.FloydSteinberg.Draw(out, rgbaImage.Bounds(), rgbaImage, image.Point{X: 0, Y: 0})
		newImages[index] = out
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

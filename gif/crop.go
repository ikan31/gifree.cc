package gif

import (
	"image"
	gifstd "image/gif"

	"golang.org/x/image/draw"
)

// CropOptions defines the region to crop, in pixels relative to the top-left of the GIF.
type CropOptions struct {
	X, Y, Width, Height int
}

// Crop returns a new GIFFile where every frame is only selected portion.
func Crop(gif *gifstd.GIF, cropOptions CropOptions) (*gifstd.GIF, error) {
	if cropOptions.Width <= 0 || cropOptions.Height <= 0 {
		return nil, ErrCropDimensions
	}

	bounds := gif.Image[0].Bounds()

	if cropOptions.X < 0 || cropOptions.Y < 0 || cropOptions.X+cropOptions.Width > bounds.Max.X ||
		cropOptions.Y+cropOptions.Height > bounds.Max.Y {
		return nil, ErrCropOutOfBounds
	}

	// The region to cut out in the original GIFs coordinate space (aka the crop)
	sourceRectangle := image.Rect(
		cropOptions.X,
		cropOptions.Y,
		cropOptions.X+cropOptions.Width,
		cropOptions.Y+cropOptions.Height,
	)

	// The destination bounds for each new frame, always starting at (0,0)
	newRectangle := image.Rect(0, 0, cropOptions.Width, cropOptions.Height)

	newImages := make([]*image.Paletted, len(gif.Image))

	for i, sourceImage := range gif.Image {
		newImage := image.NewPaletted(newRectangle, sourceImage.Palette)
		// Copy the cropped region from the source frame into the new zero-origin frame.
		// sourceRectangle defines what to read from sourceImage; image.Point{} is the
		// destination origin.
		draw.Copy(newImage, image.Point{X: 0, Y: 0}, sourceImage, sourceRectangle, draw.Src, nil)
		newImages[i] = newImage
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

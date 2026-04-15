package gif

import (
	"image"
	"image/color"
	gifstd "image/gif"
	"math/rand"

	"golang.org/x/image/draw"
)

// grayPalette is a 256-shade grayscale palette
var grayPalette = func() color.Palette { //nolint: gochecknoglobals
	p := make(color.Palette, 256)
	for i := range p {
		v := uint8(i)
		p[i] = color.RGBA{R: v, G: v, B: v, A: 255}
	}

	return p
}()

// Grayscale converts every image to grayscale using luminance weights.
func Grayscale(gif *gifstd.GIF) (*gifstd.GIF, error) {
	newImages := make([]*image.Paletted, len(gif.Image))

	for i, sourceImage := range gif.Image {
		// Get the bounds of the image
		bounds := sourceImage.Bounds()

		// RGBA Image so we can do per pixel math
		rgba := image.NewRGBA(bounds)

		// Draw pixels to RGBA Image
		draw.Draw(rgba, bounds, sourceImage, bounds.Min, draw.Src)

		// For each Pixel - do adjustments
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				c := rgba.RGBAAt(x, y)
				lum := uint8(0.299*float64(c.R) + 0.587*float64(c.G) + 0.114*float64(c.B))
				rgba.SetRGBA(
					x,
					y,
					color.RGBA{R: lum, G: lum, B: lum, A: c.A},
				)
			}
		}

		// Create new Paletted Image
		finalImage := image.NewPaletted(bounds, grayPalette)

		// Draw to Paletted Image - each RGBA pixel is covenverted to nearest grayscale value
		draw.FloydSteinberg.Draw(finalImage, bounds, rgba, bounds.Min)

		newImages[i] = finalImage
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

// DeepFry applies an extreme saturation + contrast boost, warm tint, noise, and
// heavy sharpening to produce the classic "deep fried" meme look.
func DeepFry(gif *gifstd.GIF) (*gifstd.GIF, error) {
	newImages := make([]*image.Paletted, len(gif.Image))

	for i, sourceImage := range gif.Image {
		// Get the bounds of the image
		bounds := sourceImage.Bounds()

		// RGBA Image so we can do per pixel math
		rgbaImage := image.NewRGBA(bounds)

		// Draw pixels to RGBA Image
		draw.Draw(rgbaImage, bounds, sourceImage, bounds.Min, draw.Src)

		// Pass 1: saturation boost + contrast crush + warm tint + noise
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				c := rgbaImage.RGBAAt(x, y)
				r := float64(c.R)
				gv := float64(c.G)
				bl := float64(c.B)
				a32 := c.A

				r, gv, bl = applySaturationBoost(r, gv, bl)
				r, gv, bl = applyWarmTint(r, gv, bl)
				r, gv, bl = applyContrastCrush(r, gv, bl)
				r, gv, bl = applyNoise(r, gv, bl)

				rgbaImage.SetRGBA(x, y, color.RGBA{
					R: clampU8(r),
					G: clampU8(gv),
					B: clampU8(bl),
					A: a32,
				})
			}
		}

		// Pass 2: heavy sharpening
		editedImage := sharpenRGBA(rgbaImage, bounds)

		// Create new Palette Image
		finalImage := image.NewPaletted(bounds, sourceImage.Palette)

		// Draw to final image - each pixel is drawn to Palette
		draw.FloydSteinberg.Draw(finalImage, bounds, editedImage, bounds.Min)

		newImages[i] = finalImage
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

// sharpenRGBA applies a strong 3×3 sharpening kernel.
func sharpenRGBA(sourceImage *image.RGBA, bounds image.Rectangle) *image.RGBA {
	dst := image.NewRGBA(bounds)
	kernel := [3][3]float64{
		{-1, -1, -1},
		{-1, 9, -1},
		{-1, -1, -1},
	}
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			var r, gv, bl float64
			for ky := range 3 {
				for kx := range 3 {
					px := x + kx - 1
					py := y + ky - 1
					if px < bounds.Min.X {
						px = bounds.Min.X
					}
					if px >= bounds.Max.X {
						px = bounds.Max.X - 1
					}
					if py < bounds.Min.Y {
						py = bounds.Min.Y
					}
					if py >= bounds.Max.Y {
						py = bounds.Max.Y - 1
					}
					nc := sourceImage.RGBAAt(px, py)
					w := kernel[ky][kx]
					r += float64(nc.R) * w
					gv += float64(nc.G) * w
					bl += float64(nc.B) * w
				}
			}
			dst.SetRGBA(x, y, color.RGBA{
				R: clampU8(r),
				G: clampU8(gv),
				B: clampU8(bl),
				A: sourceImage.RGBAAt(x, y).A,
			})
		}
	}

	return dst
}

// applySaturationBoost pushes each channel away from the luminance value by a
// factor of 4, making colors appear more vivid.
func applySaturationBoost(r, g, b float64) (float64, float64, float64) {
	lum := 0.299*r + 0.587*g + 0.114*b

	return lum + (r-lum)*4.0, lum + (g-lum)*4.0, lum + (b-lum)*4.0
}

// applyWarmTint boosts red and suppresses blue to give the image a warm
// orange cast.
func applyWarmTint(r, g, b float64) (float64, float64, float64) {
	return r * 1.15, g * 1.0, b * 0.75
}

// applyContrastCrush stretches contrast by scaling each channel around the
// midpoint (128), clipping shadows and highlights toward the extremes.
func applyContrastCrush(r, g, b float64) (float64, float64, float64) {
	crush := func(v float64) float64 { return (v/255.0-0.5)*3.0*255 + 128 }

	return crush(r), crush(g), crush(b)
}

// applyNoise adds random per-pixel noise, with less intensity applied to green
// and blue to keep the warm tint dominant.
func applyNoise(r, g, b float64) (float64, float64, float64) {
	noise := (rand.Float64() - 0.5) * 40 //nolint:gosec

	return r + noise, g + noise*0.7, b + noise*0.5
}

func clampU8(v float64) uint8 {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}

	return uint8(v)
}

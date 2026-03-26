package gif

import (
	"image"
	"image/color"
	"image/draw"
	"math/rand"
)

// Grayscale converts every frame to grayscale using luminance weights.
func Grayscale(g *GIFFile) (*GIFFile, error) {
	// Build a proper 256-shade grayscale palette
	grayPalette := make(color.Palette, 256)
	for i := range grayPalette {
		v := uint8(i)
		grayPalette[i] = color.RGBA{R: v, G: v, B: v, A: 255}
	}

	newFrames := make([]*image.Paletted, len(g.Frames))
	for i, frame := range g.Frames {
		b := frame.Bounds()
		rgba := image.NewRGBA(b)
		draw.Draw(rgba, b, frame, b.Min, draw.Src)

		for y := b.Min.Y; y < b.Max.Y; y++ {
			for x := b.Min.X; x < b.Max.X; x++ {
				r, gv, bl, a := rgba.At(x, y).RGBA()
				lum := uint8((0.299*float64(r) + 0.587*float64(gv) + 0.114*float64(bl)) / 257)
				rgba.SetRGBA(x, y, color.RGBA{R: lum, G: lum, B: lum, A: uint8(a >> 8)})
			}
		}

		dst := image.NewPaletted(b, grayPalette)
		draw.FloydSteinberg.Draw(dst, b, rgba, b.Min)
		newFrames[i] = dst
	}

	delays := make([]int, len(g.Delays))
	copy(delays, g.Delays)
	return &GIFFile{Frames: newFrames, Delays: delays, LoopCount: g.LoopCount}, nil
}

// DeepFry applies an extreme saturation + contrast boost, warm tint, noise, and
// heavy sharpening to produce the classic "deep fried" meme look.
func DeepFry(g *GIFFile) (*GIFFile, error) {
	newFrames := make([]*image.Paletted, len(g.Frames))
	for i, frame := range g.Frames {
		b := frame.Bounds()
		rgba := image.NewRGBA(b)
		draw.Draw(rgba, b, frame, b.Min, draw.Src)

		// Pass 1: saturation boost + contrast crush + warm tint + noise
		for y := b.Min.Y; y < b.Max.Y; y++ {
			for x := b.Min.X; x < b.Max.X; x++ {
				r32, g32, bl32, a32 := rgba.At(x, y).RGBA()
				r := float64(r32 >> 8)
				gv := float64(g32 >> 8)
				bl := float64(bl32 >> 8)

				// Saturation boost
				lum := 0.299*r + 0.587*gv + 0.114*bl
				r = lum + (r-lum)*4.0
				gv = lum + (gv-lum)*4.0
				bl = lum + (bl-lum)*4.0

				// Warm tint (red/orange push)
				r *= 1.15
				gv *= 1.0
				bl *= 0.75

				// Contrast crush
				r = (r/255.0-0.5)*3.0*255 + 128
				gv = (gv/255.0-0.5)*3.0*255 + 128
				bl = (bl/255.0-0.5)*3.0*255 + 128

				// Noise
				noise := (rand.Float64() - 0.5) * 40
				r += noise
				gv += noise * 0.7
				bl += noise * 0.5

				rgba.SetRGBA(x, y, color.RGBA{
					R: clampU8(r),
					G: clampU8(gv),
					B: clampU8(bl),
					A: uint8(a32 >> 8),
				})
			}
		}

		// Pass 2: heavy sharpening
		sharpened := sharpenRGBA(rgba, b)

		dst := image.NewPaletted(b, frame.Palette)
		draw.FloydSteinberg.Draw(dst, b, sharpened, b.Min)
		newFrames[i] = dst
	}

	delays := make([]int, len(g.Delays))
	copy(delays, g.Delays)
	return &GIFFile{Frames: newFrames, Delays: delays, LoopCount: g.LoopCount}, nil
}

// sharpenRGBA applies a strong 3×3 sharpening kernel.
func sharpenRGBA(src *image.RGBA, b image.Rectangle) *image.RGBA {
	dst := image.NewRGBA(b)
	kernel := [3][3]float64{
		{-1, -1, -1},
		{-1, 9, -1},
		{-1, -1, -1},
	}
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			var r, gv, bl float64
			for ky := 0; ky < 3; ky++ {
				for kx := 0; kx < 3; kx++ {
					px := x + kx - 1
					py := y + ky - 1
					if px < b.Min.X {
						px = b.Min.X
					}
					if px >= b.Max.X {
						px = b.Max.X - 1
					}
					if py < b.Min.Y {
						py = b.Min.Y
					}
					if py >= b.Max.Y {
						py = b.Max.Y - 1
					}
					r32, g32, bl32, _ := src.At(px, py).RGBA()
					w := kernel[ky][kx]
					r += float64(r32>>8) * w
					gv += float64(g32>>8) * w
					bl += float64(bl32>>8) * w
				}
			}
			_, _, _, a32 := src.At(x, y).RGBA()
			dst.SetRGBA(x, y, color.RGBA{
				R: clampU8(r),
				G: clampU8(gv),
				B: clampU8(bl),
				A: uint8(a32 >> 8),
			})
		}
	}
	return dst
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

package gif

import (
	"image"
	"image/color"
	"math/bits"
	"slices"
)

// medianCutPalette builds a color.Palette tuned to the actual colors in img
// using median cut quantization. maxColors is rounded down to the nearest
// power of 2 (minimum 2, maximum 256).
func medianCutPalette(img *image.RGBA, maxColors int) color.Palette {
	// Round maxColors down to nearest power of 2, clamped to [2, 256]
	if maxColors > 256 {
		maxColors = 256
	}
	if maxColors < 2 {
		maxColors = 2
	}
	maxColors = 1 << (bits.Len(uint(maxColors)) - 1)

	unique := collectColors(img)

	// If the image has fewer unique colors than the target, use them directly
	if len(unique) <= maxColors {
		pal := make(color.Palette, len(unique))
		for i, c := range unique {
			pal[i] = c
		}

		return pal
	}

	depth := bits.Len(uint(maxColors)) - 1 //nolint:gosec
	buckets := medianCut(unique, depth)

	pal := make(color.Palette, len(buckets))
	for i, c := range buckets {
		pal[i] = c
	}

	return pal
}

// collectColors returns all unique opaque colors from img as a []color.RGBA.
// Pixels with alpha=0 are excluded.
func collectColors(img *image.RGBA) []color.RGBA {
	seen := make(map[color.RGBA]struct{})
	b := img.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			c := img.RGBAAt(x, y)
			if c.A == 0 {
				continue
			}
			seen[c] = struct{}{}
		}
	}
	result := make([]color.RGBA, 0, len(seen))
	for c := range seen {
		result = append(result, c)
	}

	return result
}

// medianCut recursively splits colors into 2^depth buckets by the widest
// color channel, returning one representative color per bucket.
func medianCut(colors []color.RGBA, depth int) []color.RGBA {
	if depth == 0 || len(colors) == 1 {
		return []color.RGBA{avgColor(colors)}
	}

	// Find the channel with the widest range
	var minR, minG, minB uint8 = 255, 255, 255
	var maxR, maxG, maxB uint8
	for _, c := range colors {
		if c.R < minR {
			minR = c.R
		}
		if c.R > maxR {
			maxR = c.R
		}
		if c.G < minG {
			minG = c.G
		}
		if c.G > maxG {
			maxG = c.G
		}
		if c.B < minB {
			minB = c.B
		}
		if c.B > maxB {
			maxB = c.B
		}
	}
	rRange := int(maxR) - int(minR)
	gRange := int(maxG) - int(minG)
	bRange := int(maxB) - int(minB)

	// Sort by widest channel
	switch {
	case rRange >= gRange && rRange >= bRange:
		slices.SortFunc(colors, func(a, b color.RGBA) int { return int(a.R) - int(b.R) })
	case gRange >= bRange:
		slices.SortFunc(colors, func(a, b color.RGBA) int { return int(a.G) - int(b.G) })
	default:
		slices.SortFunc(colors, func(a, b color.RGBA) int { return int(a.B) - int(b.B) })
	}

	mid := len(colors) / 2
	left := medianCut(colors[:mid], depth-1)
	right := medianCut(colors[mid:], depth-1)

	return append(left, right...)
}

// avgColor returns the average RGBA of a slice of colors.
func avgColor(colors []color.RGBA) color.RGBA {
	if len(colors) == 0 {
		return color.RGBA{R: 0, G: 0, B: 0, A: 0}
	}

	var r, g, b int
	for _, c := range colors {
		r += int(c.R)
		g += int(c.G)
		b += int(c.B)
	}
	n := len(colors)

	return color.RGBA{R: uint8(r / n), G: uint8(g / n), B: uint8(b / n), A: 255} //nolint:gosec
}

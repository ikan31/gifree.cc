// Package gif provides GIF decoding, encoding, and frame-level editing operations.
package gif

import (
	"image/color"
)

// ParseColor converts a color name or hex string to a color.Color.
func ParseColor(str string) color.Color {
	switch str {
	case "white":
		return color.White
	case "black":
		return color.Black
	default:
		return color.White
	}
}

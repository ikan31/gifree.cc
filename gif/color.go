package gif

import (
	"fmt"
	"image/color"
)

// ParseColor converts a color name or hex string to a color.Color.
func ParseColor(s string) color.Color {
	switch s {
	case "white", "#ffffff", "#fff", "":
		return color.White
	case "black", "#000000", "#000":
		return color.Black
	case "red":
		return color.RGBA{R: 255, A: 255}
	case "green":
		return color.RGBA{G: 255, A: 255}
	case "blue":
		return color.RGBA{B: 255, A: 255}
	case "yellow":
		return color.RGBA{R: 255, G: 255, A: 255}
	case "orange":
		return color.RGBA{R: 255, G: 136, A: 255}
	case "purple":
		return color.RGBA{R: 153, G: 51, B: 255, A: 255}
	case "pink":
		return color.RGBA{R: 255, G: 102, B: 170, A: 255}
	case "cyan":
		return color.RGBA{G: 204, B: 255, A: 255}
	}
	if len(s) == 7 && s[0] == '#' {
		var r, g, b uint8
		fmt.Sscanf(s[1:], "%02x%02x%02x", &r, &g, &b)
		return color.RGBA{R: r, G: g, B: b, A: 255}
	}
	return color.White
}

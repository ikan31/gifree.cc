package gif

import (
	"image"
	"image/color"
)

// GIFFile holds decoded GIF data
type GIFFile struct {
	Frames   []*image.Paletted
	Delays   []int // delay in 100ths of a second
	LoopCount int
}

// TextOptions configures text overlay rendering
type TextOptions struct {
	Text  string
	Size  float64
	Color color.Color
	X     int    // left edge in GIF pixels
	Y     int    // top edge in GIF pixels
	Font  string // "regular", "bold", "italic", "mono", "smallcaps"
}


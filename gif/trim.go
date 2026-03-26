package gif

import "fmt"

// Trim returns a new GIFFile containing only frames [start, end] (inclusive, 0-based)
func Trim(g *GIFFile, start, end int) (*GIFFile, error) {
	n := len(g.Frames)
	if start < 0 || end >= n || start > end {
		return nil, fmt.Errorf("invalid frame range [%d, %d] for GIF with %d frames", start, end, n)
	}
	return &GIFFile{
		Frames:    g.Frames[start : end+1],
		Delays:    g.Delays[start : end+1],
		LoopCount: g.LoopCount,
	}, nil
}

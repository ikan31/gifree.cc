package gif

import (
	"fmt"
	gifstd "image/gif"
)

// Trim returns a new GIF containing only frames [start, end] (inclusive, 0-based).
func Trim(gif *gifstd.GIF, start, end int) (*gifstd.GIF, error) {
	n := len(gif.Image)
	if start < 0 || end >= n || start > end {
		return nil, fmt.Errorf(
			"invalid frame range [%d, %d] for GIF with %d frames: %w",
			start,
			end,
			n,
			ErrInvalidFrameRange,
		)
	}

	return &gifstd.GIF{
		Image:           gif.Image[start : end+1],
		Delay:           gif.Delay[start : end+1],
		LoopCount:       gif.LoopCount,
		Disposal:        gif.Disposal[start : end+1],
		Config:          gif.Config,
		BackgroundIndex: gif.BackgroundIndex,
	}, nil
}

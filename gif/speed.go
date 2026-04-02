package gif

import (
	gifstd "image/gif"
)

// Speed returns a new GIF with frame delays divided by factor.
// factor > 1 = faster, factor < 1 = slower. Minimum delay is 2 (2/100s).
func Speed(gif *gifstd.GIF, factor float64) (*gifstd.GIF, error) {
	if factor <= 0 {
		return nil, ErrSpeedFactor
	}

	delays := make([]int, len(gif.Delay))

	for i, delay := range gif.Delay {
		newDelay := int(float64(delay) / factor)
		// GIF delays are in hundredths of a second. Browsers treat 0 or 1 inconsistently
		// (often rendering as fast as possible), so 2 (20ms) is the safe minimum.
		newDelay = max(newDelay, 2)
		delays[i] = newDelay
	}

	return &gifstd.GIF{
		Image:           gif.Image,
		Delay:           delays,
		LoopCount:       gif.LoopCount,
		Disposal:        gif.Disposal,
		Config:          gif.Config,
		BackgroundIndex: gif.BackgroundIndex,
	}, nil
}

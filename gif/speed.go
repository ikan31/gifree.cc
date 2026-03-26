package gif

import "fmt"

// Speed returns a new GIFFile with frame delays divided by factor.
// factor > 1 = faster, factor < 1 = slower. Minimum delay is 2 (2/100s).
func Speed(g *GIFFile, factor float64) (*GIFFile, error) {
	if factor <= 0 {
		return nil, fmt.Errorf("speed factor must be positive")
	}
	delays := make([]int, len(g.Delays))
	for i, d := range g.Delays {
		nd := int(float64(d) / factor)
		if nd < 2 {
			nd = 2
		}
		delays[i] = nd
	}
	return &GIFFile{Frames: g.Frames, Delays: delays, LoopCount: g.LoopCount}, nil
}

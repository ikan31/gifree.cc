package gif

import (
	"bytes"
	"fmt"
	gifstd "image/gif"
	"os"
)

// Encode writes a GIFFile to disk at the given path
func Encode(g *GIFFile, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	defer f.Close()

	out := &gifstd.GIF{
		Image:     g.Frames,
		Delay:     g.Delays,
		LoopCount: g.LoopCount,
	}

	if err := gifstd.EncodeAll(f, out); err != nil {
		return fmt.Errorf("encode %s: %w", path, err)
	}
	return nil
}

// EncodeBytes encodes a GIFFile to a byte slice
func EncodeBytes(g *GIFFile) ([]byte, error) {
	var buf bytes.Buffer
	out := &gifstd.GIF{
		Image:     g.Frames,
		Delay:     g.Delays,
		LoopCount: g.LoopCount,
	}
	if err := gifstd.EncodeAll(&buf, out); err != nil {
		return nil, fmt.Errorf("encode gif: %w", err)
	}
	return buf.Bytes(), nil
}

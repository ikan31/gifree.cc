package gif

import (
	"bytes"
	"fmt"
	gifstd "image/gif"
	"os"
)

// Decode reads a GIF file and returns a GIFFile struct
func Decode(path string) (*GIFFile, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	g, err := gifstd.DecodeAll(f)
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}

	return &GIFFile{
		Frames:    g.Image,
		Delays:    g.Delay,
		LoopCount: g.LoopCount,
	}, nil
}

// DecodeBytes decodes a GIF from a byte slice
func DecodeBytes(data []byte) (*GIFFile, error) {
	g, err := gifstd.DecodeAll(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("decode gif: %w", err)
	}
	return &GIFFile{
		Frames:    g.Image,
		Delays:    g.Delay,
		LoopCount: g.LoopCount,
	}, nil
}

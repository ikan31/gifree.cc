package gif

import (
	"bytes"
	gifstd "image/gif"
)

// DecodeBytes decodes a GIF from a byte slice.
func DecodeBytes(data []byte) (*gifstd.GIF, error) {
	gif, err := gifstd.DecodeAll(bytes.NewReader(data))
	if err != nil {
		return nil, ErrDecodeGIF
	}

	return gif, nil
}

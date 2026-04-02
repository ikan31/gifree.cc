package gif

import (
	"bytes"
	gifstd "image/gif"
)

// EncodeBytes encodes a GIF to a byte slice.
func EncodeBytes(gif *gifstd.GIF) ([]byte, error) {
	var buf bytes.Buffer

	err := gifstd.EncodeAll(&buf, gif)
	if err != nil {
		return nil, ErrEncodeGIF
	}

	return buf.Bytes(), nil
}

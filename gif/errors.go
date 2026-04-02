package gif

import "errors"

// Sentinel errors returned by gif processing functions.
var (
	ErrCropDimensions    = errors.New("crop dimensions must be positive")
	ErrCropOutOfBounds   = errors.New("crop out of bounds")
	ErrDecodeGIF         = errors.New("failed to decode GIF")
	ErrEncodeGIF         = errors.New("failed to encode GIF")
	ErrNoFrames          = errors.New("GIF has no frames")
	ErrInvalidDimensions = errors.New("GIF has invalid dimensions")
	ErrResizeDimensions  = errors.New("invalid resize dimensions")
	ErrSpeedFactor       = errors.New("speed factor must be positive")
	ErrLoadFont          = errors.New("failed to load font")
	ErrInvalidFrameRange = errors.New("invalid frame range")
)

//go:build js && wasm

// Package main is the WebAssembly entry point for gifree.
package main

import (
	"errors"
	"fmt"
	"syscall/js"

	stdgif "image/gif"

	"github.com/ikan31/gifree-app/gif"
)

var (
	current             *stdgif.GIF //nolint:gochecknoglobals // holds WASM working state between JS calls
	ErrUnknownEffect    = errors.New("unknown effect")
	ErrUnknownTransform = errors.New("unknown transform type")
)

func main() {
	js.Global().Set("gifLoad", js.FuncOf(jsLoad))
	js.Global().Set("gifTrim", js.FuncOf(jsTrim))
	js.Global().Set("gifCrop", js.FuncOf(jsCrop))
	js.Global().Set("gifSpeed", js.FuncOf(jsSpeed))
	js.Global().Set("gifText", js.FuncOf(jsText))
	js.Global().Set("gifEffect", js.FuncOf(jsEffect))
	js.Global().Set("gifResize", js.FuncOf(jsResize))
	js.Global().Set("gifFromFrames", js.FuncOf(jsFromFrames))
	js.Global().Set("gifReverse", js.FuncOf(jsReverse))
	js.Global().Set("gifTransform", js.FuncOf(jsTransform))
	js.Global().Call("gifWASMReady")
	select {}
}

func resultOK(g *stdgif.GIF) map[string]any {
	data, err := gif.EncodeBytes(g)
	if err != nil {
		return resultErr(err)
	}
	w, h := 0, 0
	if len(g.Image) > 0 {
		b := g.Image[0].Bounds()
		w, h = b.Dx(), b.Dy()
	}
	buf := js.Global().Get("Uint8Array").New(len(data))
	js.CopyBytesToJS(buf, data)

	return map[string]any{
		"ok":     true,
		"bytes":  buf,
		"frames": len(g.Image),
		"width":  w,
		"height": h,
		"size":   len(data),
	}
}

func resultErr(err error) map[string]any {
	return map[string]any{
		"ok":    false,
		"error": err.Error(),
	}
}

func jsLoad(_ js.Value, args []js.Value) any {
	src := args[0]
	data := make([]byte, src.Length())
	js.CopyBytesToGo(data, src)
	g, err := gif.DecodeBytes(data)
	if err != nil {
		return resultErr(err)
	}
	current = g

	return resultOK(g)
}

func jsTrim(_ js.Value, args []js.Value) any {
	start := args[0].Int()
	end := args[1].Int()
	result, err := gif.Trim(current, start, end)
	if err != nil {
		return resultErr(err)
	}
	current = result

	return resultOK(current)
}

func jsCrop(_ js.Value, args []js.Value) any {
	x := args[0].Int()
	y := args[1].Int()
	width := args[2].Int()
	height := args[3].Int()
	result, err := gif.Crop(current, gif.CropOptions{X: x, Y: y, Width: width, Height: height})
	if err != nil {
		return resultErr(err)
	}
	current = result

	return resultOK(current)
}

func jsSpeed(_ js.Value, args []js.Value) any {
	factor := args[0].Float()
	result, err := gif.Speed(current, factor)
	if err != nil {
		return resultErr(err)
	}
	current = result

	return resultOK(current)
}

func jsText(_ js.Value, args []js.Value) any {
	text := args[0].String()
	size := args[1].Float()
	clr := gif.ParseColor(args[2].String())
	font := args[3].String()
	x := args[4].Int()
	y := args[5].Int()
	result, err := gif.AddText(current, gif.TextOptions{
		Text:  text,
		Size:  size,
		Color: clr,
		Font:  font,
		X:     x,
		Y:     y,
	})
	if err != nil {
		return resultErr(err)
	}
	current = result

	return resultOK(current)
}

func jsEffect(_ js.Value, args []js.Value) any {
	effectType := args[0].String()
	var (
		result *stdgif.GIF
		err    error
	)
	switch effectType {
	case "grayscale":
		result, err = gif.Grayscale(current)
	case "deepfry":
		result, err = gif.DeepFry(current)
	default:
		return resultErr(fmt.Errorf("%w: %s", ErrUnknownEffect, effectType))
	}
	if err != nil {
		return resultErr(err)
	}
	current = result

	return resultOK(current)
}

func jsFromFrames(_ js.Value, args []js.Value) any {
	flatJS := args[0]
	width := args[1].Int()
	height := args[2].Int()
	frameCount := args[3].Int()
	fps := args[4].Int()

	flat := make([]byte, flatJS.Length())
	js.CopyBytesToGo(flat, flatJS)

	frameSize := width * height * 4
	frames := make([][]byte, frameCount)
	for i := range frameCount {
		start := i * frameSize
		frames[i] = flat[start : start+frameSize]
	}

	g, err := gif.FramesToGIF(frames, width, height, fps)
	if err != nil {
		return resultErr(err)
	}
	current = g

	return resultOK(g)
}

func jsReverse(_ js.Value, _ []js.Value) any {
	result, err := gif.Reverse(current)
	if err != nil {
		return resultErr(err)
	}
	current = result

	return resultOK(current)
}

func jsTransform(_ js.Value, args []js.Value) any {
	transformType := args[0].String()
	var (
		result *stdgif.GIF
		err    error
	)
	switch transformType {
	case "fliph":
		result, err = gif.FlipH(current)
	case "flipv":
		result, err = gif.FlipV(current)
	case "rotate90cw":
		result, err = gif.Rotate90CW(current)
	case "rotate90ccw":
		result, err = gif.Rotate90CCW(current)
	case "rotate180":
		result, err = gif.Rotate180(current)
	default:
		return resultErr(fmt.Errorf("%w: %s", ErrUnknownTransform, transformType))
	}
	if err != nil {
		return resultErr(err)
	}
	current = result

	return resultOK(current)
}

func jsResize(_ js.Value, args []js.Value) any {
	width := args[0].Int()
	height := args[1].Int()
	result, err := gif.Resize(current, width, height)
	if err != nil {
		return resultErr(err)
	}
	current = result

	return resultOK(current)
}

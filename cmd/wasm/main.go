//go:build js && wasm

package main

import (
	"fmt"
	"syscall/js"

	"github.com/ikan31/gifree-app/gif"
)

var current *gif.GIFFile

func main() {
	js.Global().Set("gifLoad", js.FuncOf(jsLoad))
	js.Global().Set("gifTrim", js.FuncOf(jsTrim))
	js.Global().Set("gifCrop", js.FuncOf(jsCrop))
	js.Global().Set("gifSpeed", js.FuncOf(jsSpeed))
	js.Global().Set("gifText", js.FuncOf(jsText))
	js.Global().Set("gifEffect", js.FuncOf(jsEffect))
	js.Global().Set("gifResize", js.FuncOf(jsResize))
	js.Global().Call("gifWASMReady")
	select {}
}

func resultOK(g *gif.GIFFile) map[string]interface{} {
	data, err := gif.EncodeBytes(g)
	if err != nil {
		return resultErr(err)
	}
	w, h := 0, 0
	if len(g.Frames) > 0 {
		b := g.Frames[0].Bounds()
		w, h = b.Dx(), b.Dy()
	}
	buf := js.Global().Get("Uint8Array").New(len(data))
	js.CopyBytesToJS(buf, data)
	return map[string]interface{}{
		"ok":     true,
		"bytes":  buf,
		"frames": len(g.Frames),
		"width":  w,
		"height": h,
		"size":   len(data),
	}
}

func resultErr(err error) map[string]interface{} {
	return map[string]interface{}{
		"ok":    false,
		"error": err.Error(),
	}
}

func jsLoad(this js.Value, args []js.Value) any {
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

func jsTrim(this js.Value, args []js.Value) any {
	start := args[0].Int()
	end := args[1].Int()
	result, err := gif.Trim(current, start, end)
	if err != nil {
		return resultErr(err)
	}
	current = result
	return resultOK(current)
}

func jsCrop(this js.Value, args []js.Value) any {
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

func jsSpeed(this js.Value, args []js.Value) any {
	factor := args[0].Float()
	result, err := gif.Speed(current, factor)
	if err != nil {
		return resultErr(err)
	}
	current = result
	return resultOK(current)
}

func jsText(this js.Value, args []js.Value) any {
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

func jsEffect(this js.Value, args []js.Value) any {
	effectType := args[0].String()
	var (
		result *gif.GIFFile
		err    error
	)
	switch effectType {
	case "grayscale":
		result, err = gif.Grayscale(current)
	case "deepfry":
		result, err = gif.DeepFry(current)
	default:
		return resultErr(fmt.Errorf("unknown effect: %s", effectType))
	}
	if err != nil {
		return resultErr(err)
	}
	current = result
	return resultOK(current)
}

func jsResize(this js.Value, args []js.Value) any {
	width := args[0].Int()
	height := args[1].Int()
	result, err := gif.Resize(current, width, height)
	if err != nil {
		return resultErr(err)
	}
	current = result
	return resultOK(current)
}
